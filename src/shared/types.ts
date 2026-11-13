
export type ConflictMode = 'skip' | 'overwrite' | 'rename'

export type Stage = 'choRaw' | 'choJpg' | 'edp' | 'end'

export interface FileEntry {
  name: string
  relPath: string
  absPath: string
  ext: string
  size: number
  mtimeMs: number
  previewUrl?: string
}

export interface PairEntry {
  key: string
  baseName: string
  raw: FileEntry
  jpg: FileEntry
}

export type IssueKind = 'rawOnly' | 'jpgOnly' | 'badExtRaw' | 'badExtJpg' | 'duplicate'

export interface Issue {
  kind: IssueKind
  name: string
  relPath: string
  absPath: string
  ext: string
  size: number
  note: string
}

export interface ScanStats {
  rawFiles: number
  jpgFiles: number
  rawValid: number
  jpgValid: number
  matched: number
  rawOnly: number
  jpgOnly: number
  badExtRaw: number
  badExtJpg: number
  formats: Array<{ ext: string; label: string; count: number }>
  mixedRaw: boolean
}

export interface ScanReport {
  root: string
  rawDir: string
  jpgDir: string
  scannedAt: number
  durationMs: number
  pairs: PairEntry[]
  issues: Issue[]
  stats: ScanStats
  passed: boolean
  warnings: string[]
}


export type DriveKind = 'fixed' | 'removable' | 'network' | 'cdrom' | 'unknown'

export interface DriveInfo {
  root: string
  kind: DriveKind
  bus: string
  model: string
  volume: string
  total: number
  free: number
  external: boolean
  warning: string | null
  pageSize: number
}


export interface WorkspacePaths {
  root: string
  raw: string
  jpg: string
  imgt: string
  cho: string
  choRaw: string
  choJpg: string
  edp: string
  end: string
}

export interface WorkspaceCounts {
  raw: number
  jpg: number
  choRaw: number
  choJpg: number
  edp: number
  end: number
}

export interface ImportedItem {
  base: string
  rawName: string
  jpgName: string
  at: number
  rawSize?: number
  jpgSize?: number
}

export interface RoundItem {
  base: string
  rawName: string
  jpgName: string
}

export interface RoundVerification {
  checkedAt: number
  found: Record<string, string>
  missing: string[]
}

export interface Round {
  id: string
  no: number
  createdAt: number
  editor: 'ps' | 'lr'
  items: RoundItem[]
  status: 'pending' | 'verified'
  verification?: RoundVerification
}

export interface ExportRecord {
  source: string
  output: string
  at: number
  format: 'jpeg' | 'png'
  width: number
  height: number
  padTop: number
  padBottom: number
}

export interface SessionFile {
  version: number
  createdAt: number
  updatedAt: number
  source?: { rawDir: string; jpgDir: string }
  imported: ImportedItem[]
  rounds: Round[]
  exports: ExportRecord[]
  photoshopPath?: string
  lightroomPath?: string
  editor: 'ps' | 'lr'
}

export interface Workspace extends WorkspacePaths {
  drive: DriveInfo
  counts: WorkspaceCounts
  session: SessionFile
  photoshopPath: string | null
  lightroomPath: string | null
  importIndex: Record<string, ImportIndexEntry>
  plugins: PluginInfo[]
  pending?: { files: number; bytes: number }
}

export type PrepareMode = 'ask' | 'keep' | 'reset'

export interface StageFile {
  name: string
  stem: string
  base: string
  absPath: string
  ext: string
  size: number
  mtimeMs: number
  width?: number
  height?: number
  previewUrl?: string
  orientation?: number
  edited?: boolean
}

export interface ImportIndexEntry {
  stem: string
  rawName: string
  jpgName: string
  rawSize: number
  jpgSize: number
  at: number
}


export interface TransferResult {
  bytes: number
  transferred: number
  skipped: number
  failed: Array<{ path: string; reason: string }>
  durationMs: number
}

export interface ImportProgress {
  phase: 'working' | 'done'
  done: number
  total: number
  bytesDone: number
  bytesTotal: number
  current: string
  speed: number
}

export interface ImportRequest {
  root: string
  rawDir?: string
  jpgDir?: string
  pairs: PairEntry[]
  mode: 'copy' | 'move'
}

export interface ImportResult extends TransferResult {
  items: ImportedItem[]
  skippedExisting: string[]
  workspace: Workspace
}

export interface CreateRoundRequest {
  root: string
  items: RoundItem[]
  editor: 'ps' | 'lr'
}

export interface VerifyRequest {
  root: string
  roundId: string
}

export interface VerifyResult {
  verification: RoundVerification
  workspace: Workspace
}

export interface SaveExportRequest {
  root: string
  sourceName: string
  data: ArrayBuffer
  format: 'jpeg' | 'png'
  width: number
  height: number
  padTop: number
  padBottom: number
}

export interface SaveExportResult {
  name: string
  path: string
  workspace: Workspace
}

export interface ResetResult {
  removed: number
  workspace: Workspace
}

export interface ImageMeta {
  width: number
  height: number
  size: number
  mtimeMs: number
  orientation?: number
}


export interface ExifInfo {
  width?: number
  height?: number
  make?: string
  model?: string
  lens?: string
  iso?: number
  shutter?: string
  aperture?: string
  focalLength?: string
  dateTaken?: string
  orientation?: number
  software?: string
  exposureBias?: string
  meteringMode?: string
  whiteBalance?: string
  colorSpace?: string
}

export interface HistogramData {
  r: number[]
  g: number[]
  b: number[]
  l: number[]
  samples: number
}


export interface PickFolderOptions {
  title?: string
  defaultPath?: string
  allowCreate?: boolean
}

export interface PickFileOptions {
  title?: string
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
}

export interface LaunchResult {
  launched: boolean
  exe: string | null
  fallback: boolean
  editor: 'ps' | 'lr'
}


export interface DevelopParams {
  exposure: number
  contrast: number
  highlights: number
  shadows: number
  whites: number
  blacks: number
  temperature: number
  tint: number
  vibrance: number
  saturation: number
  clarity: number
  sharpness: number
  vignette: number
  rotate: 0 | 90 | 180 | 270
  flipH: boolean
}

export interface EditDoc {
  version: number
  source: string
  updatedAt: number
  params: DevelopParams
  output?: string
}

export interface SaveEditRequest {
  root: string
  sourceName: string
  format: 'jpeg' | 'png'
  quality: number
  width: number
  height: number
  params: DevelopParams
  data: ArrayBuffer
}

export interface SaveEditResult {
  name: string
  xmlName: string
  path: string
  workspace: Workspace
}


export type PluginHook =
  | 'workspace:opened'
  | 'import:after'
  | 'round:verified'
  | 'export:after'
  | 'edit:saved'

export interface PluginInfo {
  id: string
  name: string
  version: string
  description?: string
  hooks: PluginHook[]
  enabled: boolean
  error?: string
  dir?: string
}


export type ThemeName = 'dark' | 'graphite' | 'light' | 'nord' | 'ember' | 'violet'

export interface AppSettings {
  version: number
  theme: ThemeName
  background: string | null
  backgroundOpacity: number
  backgroundBlur: number
  pageSize: number
  developerMode: boolean
  denseSidebar: boolean
}

export type SettingsPatch = Partial<Omit<AppSettings, 'version'>>

export interface SettingsState {
  settings: AppSettings
  backgroundPath: string | null
}

export interface BackgroundCandidate {
  path: string
  width: number
  height: number
  size: number
}

export interface DisplayInfo {
  workArea: { x: number; y: number; width: number; height: number }
  size: { width: number; height: number }
  scaleFactor: number
}

export interface CacheInfo {
  files: number
  bytes: number
  dir: string
}
