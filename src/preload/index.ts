import { contextBridge, ipcRenderer } from 'electron'
import type { WorkstationApi, WindowStatePayload } from '@shared/api'
import type {
  BackgroundCandidate,
  CacheInfo,
  CreateRoundRequest,
  DisplayInfo,
  DriveInfo,
  EditDoc,
  ExifInfo,
  HistogramData,
  ImageMeta,
  ImportProgress,
  ImportRequest,
  ImportResult,
  LaunchResult,
  PickFileOptions,
  PickFolderOptions,
  PluginInfo,
  PrepareMode,
  ResetResult,
  SaveEditRequest,
  SaveEditResult,
  SaveExportRequest,
  SaveExportResult,
  ScanReport,
  SettingsPatch,
  SettingsState,
  Stage,
  StageFile,
  VerifyRequest,
  VerifyResult,
  Workspace
} from '@shared/types'

interface IpcEnvelope<T> {
  ok: boolean
  data?: T
  error?: string
}

async function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  const envelope = (await ipcRenderer.invoke(channel, payload)) as IpcEnvelope<T>
  if (!envelope?.ok) throw new Error(envelope?.error || '操作失败')
  return envelope.data as T
}

const api: WorkstationApi = {
  platform: process.platform,
  desktop: true,
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggleMaximize'),
    close: () => ipcRenderer.send('window:close'),
    onState: (callback: (state: WindowStatePayload) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: WindowStatePayload): void => callback(state)
      ipcRenderer.on('window:state', listener)
      return () => ipcRenderer.off('window:state', listener)
    }
  },
  pickFolder: (options?: PickFolderOptions) => invoke<string | null>('dialog:pickFolder', options),
  pickFile: (options?: PickFileOptions) => invoke<string | null>('dialog:pickFile', options),
  reveal: (target: string) => invoke<void>('shell:reveal', { target }),
  openFolder: (target: string) => invoke<void>('shell:openFolder', { target }),
  clipboard: {
    write: (text: string) => invoke<void>('clipboard:write', { text })
  },
  readFile: (target: string) => invoke<ArrayBuffer>('file:read', target),
  scan: (input) => invoke<ScanReport>('scan:run', input),
  workspace: {
    prepare: (root: string, mode?: PrepareMode) => invoke<Workspace>('workspace:prepare', { root, mode }),
    read: (root: string) => invoke<Workspace>('workspace:read', root),
    resetImgt: (root: string) => invoke<ResetResult>('workspace:resetImgt', root),
    imgtUsage: (root: string) => invoke<{ files: number; bytes: number }>('workspace:imgtUsage', root),
    listStage: (root: string, stage: Stage) => invoke<StageFile[]>('workspace:listStage', { root, stage }),
    removePick: (root: string, stem: string) => invoke<Workspace>('workspace:removePick', { root, stem })
  },
  importPicks: (request: ImportRequest) => invoke<ImportResult>('import:run', request),
  onImportProgress: (callback: (progress: ImportProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: ImportProgress): void => callback(progress)
    ipcRenderer.on('import:progress', listener)
    return () => ipcRenderer.off('import:progress', listener)
  },
  round: {
    create: (request: CreateRoundRequest) => invoke<Workspace>('round:create', request),
    verify: (request: VerifyRequest) => invoke<VerifyResult>('round:verify', request),
    cancel: (root: string, roundId: string) => invoke<Workspace>('round:cancel', { root, roundId })
  },
  exportImage: (request: SaveExportRequest) => invoke<SaveExportResult>('export:image', request),
  edit: {
    read: (root: string, sourceName: string) => invoke<EditDoc | null>('edit:read', { root, sourceName }),
    save: (request: SaveEditRequest) => invoke<SaveEditResult>('edit:save', request),
    clear: (root: string, sourceName: string) => invoke<void>('edit:clear', { root, sourceName })
  },
  exif: (target: string) => invoke<ExifInfo | null>('exif:read', target),
  histogram: (target: string) => invoke<HistogramData | null>('histogram:read', target),
  imageMeta: (target: string) => invoke<ImageMeta | null>('image:meta', target),
  fonts: () => invoke<string[]>('fonts:list'),
  drive: (target: string) => invoke<DriveInfo>('drive:info', target),
  editor: {
    detect: () => invoke<{ photoshop: string | null; lightroom: string | null }>('editor:detect'),
    choose: (kind, root) => invoke<string | null>('editor:choose', { kind, root }),
    launch: (input) => invoke<LaunchResult>('editor:launch', input)
  },
  plugins: {
    list: () => invoke<PluginInfo[]>('plugins:list'),
    reload: () => invoke<PluginInfo[]>('plugins:reload'),
    openFolder: () => invoke<void>('plugins:openFolder')
  },
  settings: {
    read: () => invoke<SettingsState>('settings:read'),
    save: (patch: SettingsPatch) => invoke<SettingsState>('settings:save', patch),
    chooseBackground: () => invoke<BackgroundCandidate | null>('settings:chooseBackground'),
    saveBackground: (data: ArrayBuffer) => invoke<SettingsState>('settings:saveBackground', data),
    clearBackground: () => invoke<SettingsState>('settings:clearBackground'),
    display: () => invoke<DisplayInfo>('settings:display'),
    cache: () => invoke<CacheInfo>('settings:cache'),
    clearCache: () => invoke<{ removed: number }>('settings:clearCache')
  }
}

contextBridge.exposeInMainWorld('workstation', api)
