import { app, BrowserWindow, dialog } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { AppSettings, BackgroundCandidate, SettingsPatch, SettingsState } from '@shared/types'
import { readDisplaySize } from './dims'
import { ensureDir, pathExists } from './fsx'

const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  theme: 'dark',
  background: null,
  backgroundOpacity: 28,
  backgroundBlur: 6,
  pageSize: 0,
  developerMode: false,
  denseSidebar: false
}
function settingsFile(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}
function themeDir(): string {
  return path.join(app.getPath('userData'), 'theme')
}
function normalize(raw: Partial<AppSettings> | null): AppSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS }
  const theme = raw.theme
  return {
    version: 1,
    theme:
      theme === 'light' || theme === 'graphite' || theme === 'nord' || theme === 'ember' || theme === 'violet'
        ? theme
        : 'dark',
    background: typeof raw.background === 'string' && raw.background ? raw.background : null,
    backgroundOpacity:
      typeof raw.backgroundOpacity === 'number' ? Math.min(100, Math.max(0, raw.backgroundOpacity)) : 28,
    backgroundBlur: typeof raw.backgroundBlur === 'number' ? Math.min(40, Math.max(0, raw.backgroundBlur)) : 6,
    pageSize: typeof raw.pageSize === 'number' ? Math.min(120, Math.max(0, Math.round(raw.pageSize))) : 0,
    developerMode: Boolean(raw.developerMode),
    denseSidebar: Boolean(raw.denseSidebar)
  }
}
export async function readSettings(): Promise<SettingsState> {
  let parsed: Partial<AppSettings> | null = null
  try {
    parsed = JSON.parse(await fs.readFile(settingsFile(), 'utf8')) as Partial<AppSettings>
  } catch {
    parsed = null
  }
  const settings = normalize(parsed)
  const backgroundPath = settings.background ? path.join(themeDir(), settings.background) : null
  const alive = backgroundPath ? await pathExists(backgroundPath) : false
  return {
    settings: alive || !backgroundPath ? settings : { ...settings, background: null },
    backgroundPath: alive ? backgroundPath : null
  }
}
async function persist(settings: AppSettings): Promise<void> {
  const dir = app.getPath('userData')
  await ensureDir(dir)
  const tmp = path.join(dir, 'settings.json.tmp')
  await fs.writeFile(tmp, JSON.stringify(settings, null, 2), 'utf8')
  await fs.rename(tmp, settingsFile())
}
export async function saveSettings(patch: SettingsPatch): Promise<SettingsState> {
  const current = await readSettings()
  const next = normalize({ ...current.settings, ...patch })
  await persist(next)
  const backgroundPath = next.background ? path.join(themeDir(), next.background) : null
  const alive = backgroundPath ? await pathExists(backgroundPath) : false
  return { settings: next, backgroundPath: alive ? backgroundPath : null }
}
export async function chooseBackground(): Promise<BackgroundCandidate | null> {
  const window = BrowserWindow.getFocusedWindow() ?? undefined
  const options: Electron.OpenDialogOptions = {
    title: '选择背景图片',
    buttonLabel: '使用这张',
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tif', 'tiff'] }]
  }
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return null
  const target = result.filePaths[0]
  const stat = await fs.stat(target)
  const size = await readDisplaySize(target)
  if (!size) throw new Error('无法读取这张图片，换一张试试')
  return { path: target, width: size.width, height: size.height, size: stat.size }
}
export async function saveBackground(data: ArrayBuffer): Promise<SettingsState> {
  const bytes = Buffer.from(new Uint8Array(data))
  if (bytes.length < 256) throw new Error('背景数据为空')
  if (bytes.length > 40 * 1024 * 1024) throw new Error('背景图过大（>40MB），请降低分辨率')
  await ensureDir(themeDir())
  const name = 'background.jpg'
  await fs.writeFile(path.join(themeDir(), name), bytes)
  return saveSettings({ background: name })
}
export async function clearBackground(): Promise<SettingsState> {
  await fs.rm(themeDir(), { recursive: true, force: true }).catch(() => undefined)
  return saveSettings({ background: null })
}