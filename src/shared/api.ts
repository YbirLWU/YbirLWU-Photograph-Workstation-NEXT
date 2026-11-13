import type {
  BackgroundCandidate,
  CacheInfo,
  CreateRoundRequest,
  DisplayInfo,
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
} from './types'

export interface WindowStatePayload {
  maximized: boolean
}

export interface WorkstationApi {
  readonly platform: string
  readonly desktop: boolean
  window: {
    minimize(): void
    toggleMaximize(): void
    close(): void
    onState(callback: (state: WindowStatePayload) => void): () => void
  }
  pickFolder(options?: PickFolderOptions): Promise<string | null>
  pickFile(options?: PickFileOptions): Promise<string | null>
  reveal(target: string): Promise<void>
  openFolder(target: string): Promise<void>
  clipboard: {
    write(text: string): Promise<void>
  }

  readFile(path: string): Promise<ArrayBuffer>

  scan(input: { root: string; rawDir: string; jpgDir: string }): Promise<ScanReport>

  workspace: {
    prepare(root: string, mode?: PrepareMode): Promise<Workspace>
    read(root: string): Promise<Workspace>
    resetImgt(root: string): Promise<ResetResult>
    imgtUsage(root: string): Promise<{ files: number; bytes: number }>
    listStage(root: string, stage: Stage): Promise<StageFile[]>
    removePick(root: string, stem: string): Promise<Workspace>
  }
  importPicks(request: ImportRequest): Promise<ImportResult>
  onImportProgress(callback: (progress: ImportProgress) => void): () => void

  round: {
    create(request: CreateRoundRequest): Promise<Workspace>
    verify(request: VerifyRequest): Promise<VerifyResult>
    cancel(root: string, roundId: string): Promise<Workspace>
  }
  exportImage(request: SaveExportRequest): Promise<SaveExportResult>

  edit: {
    read(root: string, sourceName: string): Promise<EditDoc | null>
    save(request: SaveEditRequest): Promise<SaveEditResult>
    clear(root: string, sourceName: string): Promise<void>
  }
  exif(path: string): Promise<ExifInfo | null>
  histogram(path: string): Promise<HistogramData | null>
  imageMeta(path: string): Promise<ImageMeta | null>
  fonts(): Promise<string[]>
  drive(path: string): Promise<import('./types').DriveInfo>
  editor: {
    detect(): Promise<{ photoshop: string | null; lightroom: string | null }>
    choose(kind: 'ps' | 'lr', root?: string): Promise<string | null>
    launch(input: {
      files: string[]
      editor: 'ps' | 'lr'
      root?: string
    }): Promise<LaunchResult>
  }
  plugins: {
    list(): Promise<PluginInfo[]>
    reload(): Promise<PluginInfo[]>
    openFolder(): Promise<void>
  }
  settings: {
    read(): Promise<SettingsState>
    save(patch: SettingsPatch): Promise<SettingsState>
    chooseBackground(): Promise<BackgroundCandidate | null>
    saveBackground(data: ArrayBuffer): Promise<SettingsState>
    clearBackground(): Promise<SettingsState>
    display(): Promise<DisplayInfo>
    cache(): Promise<CacheInfo>
    clearCache(): Promise<{ removed: number }>
  }
}
declare global {
  interface Window {
    workstation?: WorkstationApi
  }
}