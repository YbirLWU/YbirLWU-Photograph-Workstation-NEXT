import { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, protocol, screen, shell } from 'electron'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import type {
  AppSettings,
  CreateRoundRequest,
  ImportProgress,
  ImportRequest,
  PickFileOptions,
  PickFolderOptions,
  PrepareMode,
  SaveEditRequest,
  SaveExportRequest,
  Stage,
  VerifyRequest
} from '@shared/types'
import { scanFolders } from './lib/scan'
import {
  buildWorkspace,
  cancelRound,
  createRound,
  imgtUsage,
  importPicks,
  listStage,
  prepareWorkspace,
  rememberEditor,
  removePick,
  resetImgt,
  saveExport,
  verifyRound
} from './lib/workspace'
import { clearEdit, readEdit, saveEdit } from './lib/edits'
import { readExif } from './lib/exif'
import { listSystemFonts } from './lib/fonts'
import { detectEditors, launchEditor } from './lib/editors'
import { getDriveInfo } from './lib/drives'
import { computeHistogram, readImageMeta, registerImageProtocols, pruneCache, cacheStats, clearCache } from './lib/thumbs'
import { ensureDir, pathExists, readFileBytes } from './lib/fsx'
import { loadPlugins, pluginsDir, runHook } from './lib/plugins'
import { chooseBackground, clearBackground, readSettings, saveBackground, saveSettings } from './lib/settings'
import { APP_NAME, APP_SHORT, APP_VERSION_LABEL, BUILD_CHANNEL_LABEL } from '@shared/version'

const RENDERER_URL = process.env['ELECTRON_RENDERER_URL']
const SMOKE = process.argv.includes('--smoke')

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true
    }
  },
  {
    scheme: 'thumb',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true, corsEnabled: true }
  },
  {
    scheme: 'preview',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true, corsEnabled: true }
  }
])

let mainWindow: BrowserWindow | null = null
let isFitted = false

function workAreaOf(window?: BrowserWindow | null): Electron.Rectangle {
  const display = window ? screen.getDisplayMatching(window.getBounds()) : screen.getPrimaryDisplay()
  return display.workArea
}

function fitWorkArea(window: BrowserWindow): void {
  const area = workAreaOf(window)
  window.setBounds({ x: area.x, y: area.y, width: area.width, height: area.height })
}

function restoreWindow(window: BrowserWindow): void {
  const area = workAreaOf(window)
  const width = Math.min(1560, Math.max(1180, area.width - 160))
  const height = Math.min(980, Math.max(720, area.height - 140))
  window.setBounds({
    x: area.x + Math.round((area.width - width) / 2),
    y: area.y + Math.round((area.height - height) / 2),
    width,
    height
  })
}

function createWindow(): BrowserWindow {
  const area = screen.getPrimaryDisplay().workArea
  const width = Math.min(area.width, Math.max(1180, Math.round(area.width * 0.75)))
  const height = Math.min(area.height, Math.max(720, Math.round(area.height * 0.78)))
  const window = new BrowserWindow({
    width,
    height,
    x: area.x + Math.round((area.width - width) / 2),
    y: area.y + Math.round((area.height - height) / 2),
    minWidth: 1180,
    minHeight: 720,
    show: false,
    frame: false,
    backgroundColor: '#0f1115',
    title: APP_NAME,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      webSecurity: true
    }
  })

  window.setMenuBarVisibility(false)

  const emitState = (): void => {
    if (window.isDestroyed()) return
    window.webContents.send('window:state', { maximized: isFitted })
  }
  window.on('maximize', emitState)
  window.on('unmaximize', emitState)
  window.on('resize', () => {
    if (window.isDestroyed() || isFitted) return
    const bounds = window.getBounds()
    const area = workAreaOf(window)
    isFitted =
      Math.abs(bounds.width - area.width) < 4 && Math.abs(bounds.height - area.height) < 4
  })

  window.once('ready-to-show', () => {
    window.show()
    emitState()
  })

  screen.on('display-metrics-changed', () => {
    if (!mainWindow || mainWindow.isDestroyed() || !isFitted) return
    fitWorkArea(mainWindow)
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (RENDERER_URL) void window.loadURL(RENDERER_URL)
  else void window.loadFile(path.join(__dirname, '../renderer/index.html'))

  if (SMOKE) {
    window.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const image = await window.webContents.capturePage()
          const out = path.join(process.cwd(), 'tmp', 'smoke.png')
          await ensureDir(path.dirname(out))
          await fs.writeFile(out, image.toPNG())
          console.log('[smoke] screenshot saved:', out)
        } catch (error) {
          console.error('[smoke] capture failed', error)
        } finally {
          app.quit()
        }
      }, 1800)
    })
  }

  return window
}

type Handler<TReq, TRes> = (req: TReq, event: Electron.IpcMainInvokeEvent) => Promise<TRes> | TRes

function handle<TReq, TRes>(channel: string, fn: Handler<TReq, TRes>): void {
  ipcMain.handle(channel, async (event, req: TReq) => {
    try {
      return { ok: true as const, data: await fn(req, event) }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false as const, error: message }
    }
  })
}

function registerIpc(): void {
  handle<PickFolderOptions | undefined, string | null>('dialog:pickFolder', async (options) => {
    const window = BrowserWindow.getFocusedWindow() ?? mainWindow
    const dialogOptions: Electron.OpenDialogOptions = {
      title: options?.title ?? '选择文件夹',
      defaultPath: options?.defaultPath || undefined,
      buttonLabel: '选择此文件夹',
      properties: options?.allowCreate
        ? ['openDirectory', 'createDirectory', 'promptToCreate']
        : ['openDirectory']
    }
    const result = window
      ? await dialog.showOpenDialog(window, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  handle<PickFileOptions | undefined, string | null>('dialog:pickFile', async (options) => {
    const window = BrowserWindow.getFocusedWindow() ?? mainWindow
    const dialogOptions: Electron.OpenDialogOptions = {
      title: options?.title ?? '选择文件',
      defaultPath: options?.defaultPath || undefined,
      buttonLabel: '选择',
      properties: ['openFile'],
      filters: options?.filters
    }
    const result = window
      ? await dialog.showOpenDialog(window, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  handle<{ target: string }, void>('shell:reveal', async ({ target }) => {
    if (!target) throw new Error('路径为空')
    if (!(await pathExists(target))) throw new Error('路径不存在，可能已被移动或删除')
    const stat = await fs.stat(target)
    if (stat.isDirectory()) await shell.openPath(target)
    else shell.showItemInFolder(target)
  })

  handle<{ target: string }, void>('shell:openFolder', async ({ target }) => {
    if (!(await pathExists(target))) throw new Error('文件夹不存在')
    const error = await shell.openPath(target)
    if (error) throw new Error(error)
  })

  handle<{ text: string }, void>('clipboard:write', ({ text }) => {
    clipboard.writeText(text ?? '')
  })

  handle<string, ArrayBuffer>('file:read', async (target) => {
    const buffer = await readFileBytes(target)
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
  })

  handle<{ root: string; rawDir: string; jpgDir: string }, unknown>('scan:run', async (input) =>
    scanFolders(input)
  )

  handle<{ root: string; mode?: PrepareMode }, unknown>('workspace:prepare', async (input) => {
    const workspace = await prepareWorkspace(input.root, input.mode)
    if (!workspace.pending) {
      void runHook('workspace:opened', { root: workspace.root, counts: workspace.counts })
    }
    return workspace
  })
  handle<string, unknown>('workspace:read', async (root) => buildWorkspace(root))
  handle<string, unknown>('workspace:resetImgt', async (root) => resetImgt(root))
  handle<string, unknown>('workspace:imgtUsage', async (root) => imgtUsage(root))
  handle<{ root: string; stage: Stage }, unknown>('workspace:listStage', async ({ root, stage }) =>
    listStage(root, stage)
  )
  handle<{ root: string; stem: string }, unknown>('workspace:removePick', async ({ root, stem }) =>
    removePick(root, stem)
  )

  handle<ImportRequest, unknown>('import:run', async (request, event) => {
    const result = await importPicks(request, (progress: ImportProgress) => {
      if (!event.sender.isDestroyed()) event.sender.send('import:progress', progress)
    })
    void runHook('import:after', {
      root: request.root,
      items: result.items,
      skippedExisting: result.skippedExisting,
      failed: result.failed
    })
    return result
  })

  handle<CreateRoundRequest, unknown>('round:create', async (request) => createRound(request))
  handle<VerifyRequest, unknown>('round:verify', async (request) => {
    const result = await verifyRound(request)
    void runHook('round:verified', { root: request.root, ...result.verification })
    return result
  })
  handle<{ root: string; roundId: string }, unknown>('round:cancel', async ({ root, roundId }) =>
    cancelRound(root, roundId)
  )
  handle<SaveExportRequest, unknown>('export:image', async (request) => {
    const result = await saveExport(request)
    void runHook('export:after', { root: request.root, name: result.name, source: request.sourceName })
    return result
  })

  handle<{ root: string; sourceName: string }, unknown>('edit:read', async ({ root, sourceName }) =>
    readEdit(root, sourceName)
  )
  handle<SaveEditRequest, unknown>('edit:save', async (request) => {
    const result = await saveEdit(request)
    void runHook('edit:saved', { root: request.root, name: result.name, xml: result.xmlName })
    return result
  })
  handle<{ root: string; sourceName: string }, void>('edit:clear', async ({ root, sourceName }) =>
    clearEdit(root, sourceName)
  )

  handle<string, unknown>('exif:read', async (target) => readExif(target))
  handle<string, unknown>('histogram:read', async (target) => computeHistogram(target))
  handle<string, unknown>('image:meta', async (target) => readImageMeta(target))
  handle<undefined, unknown>('fonts:list', async () => listSystemFonts())
  handle<string, unknown>('drive:info', async (target) => getDriveInfo(target))

  handle<undefined, unknown>('editor:detect', async () => detectEditors(true))
  handle<{ kind: 'ps' | 'lr'; root?: string } | undefined, unknown>('editor:choose', async (payload) => {
    const kind = payload?.kind === 'lr' ? 'lr' : 'ps'
    const window = BrowserWindow.getFocusedWindow() ?? mainWindow
    const dialogOptions: Electron.OpenDialogOptions = {
      title: kind === 'ps' ? '选择 Photoshop.exe' : '选择 Lightroom.exe',
      buttonLabel: '使用该程序',
      properties: ['openFile'],
      filters: [{ name: kind === 'ps' ? 'Photoshop' : 'Lightroom', extensions: ['exe'] }]
    }
    const result = window
      ? await dialog.showOpenDialog(window, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)
    if (result.canceled || result.filePaths.length === 0) return null
    return rememberEditor(payload?.root, kind, result.filePaths[0])
  })
  handle<{ files: string[]; editor: 'ps' | 'lr'; root?: string }, unknown>('editor:launch', async (input) =>
    launchEditor(input.files, input.editor === 'lr' ? 'lr' : 'ps')
  )

  handle<undefined, unknown>('plugins:list', async () => loadPlugins())
  handle<undefined, unknown>('plugins:reload', async () => loadPlugins(true))
  handle<undefined, void>('plugins:openFolder', async () => {
    const dir = pluginsDir()
    await ensureDir(dir)
    const error = await shell.openPath(dir)
    if (error) throw new Error(error)
  })

  handle<undefined, unknown>('settings:read', async () => readSettings())
  handle<Partial<AppSettings>, unknown>('settings:save', async (patch) => saveSettings(patch ?? {}))
  handle<undefined, unknown>('settings:chooseBackground', async () => chooseBackground())
  handle<ArrayBuffer, unknown>('settings:saveBackground', async (data) => saveBackground(data))
  handle<undefined, unknown>('settings:clearBackground', async () => clearBackground())
  handle<undefined, unknown>('settings:display', async () => {
    const display = screen.getPrimaryDisplay()
    return { workArea: display.workArea, size: display.size, scaleFactor: display.scaleFactor }
  })
  handle<undefined, unknown>('settings:cache', async () => cacheStats())
  handle<undefined, unknown>('settings:clearCache', async () => clearCache())

  ipcMain.on('window:minimize', () => BrowserWindow.getFocusedWindow()?.minimize())
  ipcMain.on('window:toggleMaximize', () => {
    const window = BrowserWindow.getFocusedWindow() ?? mainWindow
    if (!window || window.isDestroyed()) return
    if (isFitted) {
      isFitted = false
      restoreWindow(window)
    } else {
      isFitted = true
      fitWorkArea(window)
    }
    window.webContents.send('window:state', { maximized: isFitted })
  })
  ipcMain.on('window:close', () => BrowserWindow.getFocusedWindow()?.close())
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.ybirlwu.workstation')
    Menu.setApplicationMenu(null)
    console.log(`[${APP_SHORT}] ${APP_NAME} · ${APP_VERSION_LABEL} · ${BUILD_CHANNEL_LABEL}`)
    registerImageProtocols()
    registerIpc()
    await loadPlugins()
    mainWindow = createWindow()
    void pruneCache()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
