import type { WorkstationApi } from '@shared/api'
import { readLocalTheme } from './theme'
import type {
  DriveInfo,
  EditDoc,
  ExifInfo,
  HistogramData,
  ImportIndexEntry,
  ImportRequest,
  ImportResult,
  PluginInfo,
  ScanReport,
  SessionFile,
  StageFile,
  Workspace
} from '@shared/types'
const ROOT = 'D:\\Shoot\\2026-11-08_Elinshoot'
const PS_PATH = 'C:\\Program Files\\Adobe\\Adobe Photoshop 2025\\Photoshop.exe'
const LR_PATH = 'C:\\Program Files\\Adobe\\Adobe Lightroom Classic\\Lightroom.exe'
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
function scene(label: string, hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="hsl(${hue},58%,74%)"/>
      <stop offset="0.55" stop-color="hsl(${(hue + 18) % 360},44%,54%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 40) % 360},34%,28%)"/>
    </linearGradient>
    <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="rgba(255,246,214,.95)"/>
      <stop offset="1" stop-color="rgba(255,246,214,0)"/>
    </radialGradient>
  </defs>
  <rect width="900" height="600" fill="url(#sky)"/>
  <circle cx="640" cy="190" r="150" fill="url(#sun)"/>
  <circle cx="640" cy="190" r="42" fill="rgba(255,252,236,.92)"/>
  <path d="M0 430 L180 300 L320 400 L460 280 L620 420 L760 330 L900 440 L900 600 L0 600 Z" fill="rgba(20,24,34,.45)"/>
  <path d="M0 500 L140 420 L300 500 L470 410 L640 505 L820 430 L900 470 L900 600 L0 600 Z" fill="rgba(10,13,20,.66)"/>
  <text x="40" y="556" font-family="Segoe UI, sans-serif" font-size="24" fill="rgba(255,255,255,.82)">${label}</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
const IDS = [
  4801, 4802, 4803, 4804, 4805, 4806, 4807, 4808, 4809, 4810, 4811, 4812, 4813, 4814, 4815, 4816,
  4817, 4818, 4819, 4820, 4821, 4822, 4823, 4824, 4825, 4826
]
function fileEntry(dir: string, name: string, size: number, previewUrl: string, width = 8256, height = 5504) {
  return {
    name,
    relPath: name,
    absPath: `${dir}\\${name}`,
    ext: name.slice(name.lastIndexOf('.')).toLowerCase(),
    size,
    mtimeMs: Date.now() - 1000 * 60 * 90,
    previewUrl,
    width,
    height
  }
}
const pairs = IDS.map((id, index) => {
  const label = `IMG_${id}`
  const preview = scene(label, (index * 27) % 360)
  const raw = fileEntry(`${ROOT}\\RAW`, `${label}.NEF`, 48_200_000 + index * 130_000, preview)
  const jpg = fileEntry(`${ROOT}\\JPG`, `${label}.JPG`, 21_400_000 + index * 90_000, preview)
  return { key: label.toLowerCase(), baseName: label, raw, jpg }
})
const report: ScanReport = {
  root: ROOT,
  rawDir: `${ROOT}\\RAW`,
  jpgDir: `${ROOT}\\JPG`,
  scannedAt: Date.now(),
  durationMs: 1840,
  pairs,
  issues: [
    {
      kind: 'rawOnly',
      name: 'IMG_4798.NEF',
      relPath: 'IMG_4798.NEF',
      absPath: `${ROOT}\\RAW\\IMG_4798.NEF`,
      ext: '.nef',
      size: 47_300_000,
      note: '缺少同名 JPG 成片'
    },
    {
      kind: 'badExtRaw',
      name: '_MG_4901.CR2',
      relPath: '_MG_4901.CR2',
      absPath: `${ROOT}\\RAW\\_MG_4901.CR2`,
      ext: '.cr2',
      size: 31_200_000,
      note: 'RAW 文件夹中不应出现的 CR2 文件'
    },
    {
      kind: 'badExtJpg',
      name: 'DSC_0031.PNG',
      relPath: 'DSC_0031.PNG',
      absPath: `${ROOT}\\JPG\\DSC_0031.PNG`,
      ext: '.png',
      size: 8_400_000,
      note: 'JPG 文件夹中不应出现的 PNG 文件'
    }
  ],
  stats: {
    rawFiles: 27,
    jpgFiles: 26,
    rawValid: 26,
    jpgValid: 25,
    matched: 26,
    rawOnly: 1,
    jpgOnly: 0,
    badExtRaw: 1,
    badExtJpg: 1,
    formats: [
      { ext: '.nef', label: 'NEF', count: 18 },
      { ext: '.arw', label: 'ARW', count: 6 },
      { ext: '.cr3', label: 'CR3', count: 2 }
    ],
    mixedRaw: true
  },
  passed: false,
  warnings: []
}
const drive: DriveInfo = {
  root: 'D:',
  kind: 'fixed',
  bus: 'NVMe',
  model: 'Samsung SSD 990 PRO 2TB',
  volume: 'Work',
  total: 2_000_000_000_000,
  free: 612_000_000_000,
  external: false,
  warning: null,
  pageSize: 20
}
function stageFile(dir: string, name: string, size: number, previewUrl: string, width = 8256, height = 5504): StageFile {
  const stem = name.slice(0, name.lastIndexOf('.'))
  return {
    name,
    stem,
    base: stem.replace(/_(SEL|POL|FRM)\d+$/i, '').replace(/END$/i, ''),
    absPath: `${dir}\\${name}`,
    ext: name.slice(name.lastIndexOf('.')).toLowerCase(),
    size,
    mtimeMs: Date.now() - 1000 * 60 * 60 * 3,
    width,
    height,
    previewUrl
  }
}
const choRaw: StageFile[] = pairs.slice(0, 18).map((pair, index) =>
  stageFile(`${ROOT}\\IMGT\\CHO\\RAW`, `${pair.baseName}.NEF`, 48_200_000 + index * 130_000, pair.raw.previewUrl!, 8256, 5504)
)
const choJpg: StageFile[] = pairs.slice(0, 18).map((pair, index) =>
  stageFile(`${ROOT}\\IMGT\\CHO\\JPG`, `${pair.baseName}.JPG`, 21_400_000 + index * 90_000, pair.jpg.previewUrl!, 8256, 5504)
)
const edpFiles: StageFile[] = pairs.slice(0, 11).map((pair, index) =>
  stageFile(
    `${ROOT}\\IMGT\\EDP`,
    `${pair.baseName}.jpg`,
    26_800_000 + index * 70_000,
    scene(`${pair.baseName} · EDP`, (index * 27 + 18) % 360),
    8256,
    5504
  )
)
const endFiles: StageFile[] = pairs.slice(0, 4).map((pair, index) =>
  stageFile(
    `${ROOT}\\IMGT\\END`,
    `${pair.baseName}END.jpg`,
    24_600_000 + index * 60_000,
    scene(`${pair.baseName} · END`, (index * 27 + 40) % 360),
    8256,
    6004
  )
)
const session: SessionFile = {
  version: 2,
  createdAt: Date.now() - 1000 * 60 * 60 * 30,
  updatedAt: Date.now(),
  source: { rawDir: `${ROOT}\\RAW`, jpgDir: `${ROOT}\\JPG` },
  imported: pairs.slice(0, 18).map((pair) => ({
    base: pair.baseName,
    rawName: `${pair.baseName}.NEF`,
    jpgName: `${pair.baseName}.JPG`,
    at: Date.now() - 1000 * 60 * 60 * 20
  })),
  rounds: [
    {
      id: 'R1',
      no: 1,
      createdAt: Date.now() - 1000 * 60 * 60 * 26,
      editor: 'ps',
      status: 'verified',
      items: pairs.slice(0, 6).map((pair) => ({
        base: pair.baseName,
        rawName: `${pair.baseName}.NEF`,
        jpgName: `${pair.baseName}.JPG`
      })),
      verification: {
        checkedAt: Date.now() - 1000 * 60 * 60 * 25,
        found: Object.fromEntries(pairs.slice(0, 6).map((pair) => [pair.baseName, `${pair.baseName}.jpg`])),
        missing: []
      }
    },
    {
      id: 'R2',
      no: 2,
      createdAt: Date.now() - 1000 * 60 * 40,
      editor: 'ps',
      status: 'pending',
      items: pairs.slice(6, 13).map((pair) => ({
        base: pair.baseName,
        rawName: `${pair.baseName}.NEF`,
        jpgName: `${pair.baseName}.JPG`
      })),
      verification: {
        checkedAt: Date.now() - 1000 * 60 * 30,
        found: Object.fromEntries(pairs.slice(6, 11).map((pair) => [pair.baseName, `${pair.baseName}.jpg`])),
        missing: pairs.slice(11, 13).map((pair) => pair.baseName)
      }
    }
  ],
  exports: endFiles.map((file) => ({
    source: file.name.replace(/END/i, ''),
    output: file.name,
    at: Date.now() - 1000 * 60 * 20,
    format: 'jpeg' as const,
    width: 8256,
    height: 6004,
    padTop: 300,
    padBottom: 300
  })),
  photoshopPath: PS_PATH,
  lightroomPath: LR_PATH,
  editor: 'ps'
}
function workspace(): Workspace {
  return {
    root: ROOT,
    raw: `${ROOT}\\RAW`,
    jpg: `${ROOT}\\JPG`,
    imgt: `${ROOT}\\IMGT`,
    cho: `${ROOT}\\IMGT\\CHO`,
    choRaw: `${ROOT}\\IMGT\\CHO\\RAW`,
    choJpg: `${ROOT}\\IMGT\\CHO\\JPG`,
    edp: `${ROOT}\\IMGT\\EDP`,
    end: `${ROOT}\\IMGT\\END`,
    drive,
    counts: { raw: 26, jpg: 26, choRaw: 18, choJpg: 18, edp: edpFiles.length, end: endFiles.length },
    session,
    photoshopPath: PS_PATH,
    lightroomPath: LR_PATH,
    importIndex: buildImportIndex(choRaw, choJpg),
    plugins: DEMO_PLUGINS
  }
}
function buildImportIndex(rawList: StageFile[], jpgList: StageFile[]): Record<string, ImportIndexEntry> {
  const map = new Map<string, ImportIndexEntry>()
  for (const file of rawList) {
    map.set(file.stem.toLowerCase(), {
      stem: file.stem,
      rawName: file.name,
      jpgName: '',
      rawSize: file.size,
      jpgSize: 0,
      at: file.mtimeMs
    })
  }
  for (const file of jpgList) {
    const key = file.stem.toLowerCase()
    const entry = map.get(key)
    if (entry) {
      entry.jpgName = file.name
      entry.jpgSize = file.size
    } else {
      map.set(key, { stem: file.stem, rawName: '', jpgName: file.name, rawSize: 0, jpgSize: file.size, at: file.mtimeMs })
    }
  }
  return Object.fromEntries(map)
}
const DEMO_PLUGINS: PluginInfo[] = [
  {
    id: 'sample-lens-tag',
    name: '镜头标签（示例）',
    version: '1.0.0',
    description: '导入后自动按镜头名写一份 CSV，演示插件钩子。',
    hooks: ['import:after'],
    enabled: true
  }
]
let currentSession = session
const edits = new Map<string, EditDoc>()

const progressListeners = new Set<(progress: import('@shared/types').ImportProgress) => void>()
const EXIF_TEMPLATE: ExifInfo = {
  width: 8256,
  height: 5504,
  make: 'NIKON CORPORATION',
  model: 'NIKON Z 8',
  lens: 'NIKKOR Z 85mm f/1.8 S',
  iso: 200,
  shutter: '1/640s',
  aperture: 'f/1.8',
  focalLength: '85mm',
  dateTaken: '2026-11-08 14:22:31'
}
function demoHistogram(): HistogramData {
  const r = new Array(256).fill(0)
  const g = new Array(256).fill(0)
  const b = new Array(256).fill(0)
  const l = new Array(256).fill(0)
  for (let i = 0; i < 256; i += 1) {
    const base = Math.exp(-((i - 96) ** 2) / (2 * 46 ** 2))
    r[i] = Math.round(base * 12000 + Math.exp(-((i - 180) ** 2) / (2 * 18 ** 2)) * 3000)
    g[i] = Math.round(base * 10000 + Math.exp(-((i - 120) ** 2) / (2 * 30 ** 2)) * 2600)
    b[i] = Math.round(base * 7800 + Math.exp(-((i - 70) ** 2) / (2 * 26 ** 2)) * 2100)
    l[i] = Math.round((r[i] + g[i] + b[i]) / 3)
  }
  return { r, g, b, l, samples: 240000 }
}
function demoSettings() {
  return {
    version: 1,
    theme: readLocalTheme(),
    background: null,
    backgroundOpacity: 28,
    backgroundBlur: 6,
    pageSize: 0,
    developerMode: false,
    denseSidebar: false
  }
}
export function createMockApi(): WorkstationApi {
  return {
    platform: 'win32',
    desktop: false,
    window: {
      minimize: () => undefined,
      toggleMaximize: () => undefined,
      close: () => undefined,
      onState: () => () => undefined
    },
    pickFolder: async () => {
      await wait(80)
      return ROOT
    },
    pickFile: async () => {
      await wait(80)
      return PS_PATH
    },
    reveal: async () => {
      await wait(40)
    },
    openFolder: async () => {
      await wait(40)
    },
    clipboard: { write: async () => undefined },
    readFile: async () => new ArrayBuffer(0),
    scan: async () => {
      await wait(600)
      return { ...report, scannedAt: Date.now() }
    },
    workspace: {
      prepare: async () => {
        await wait(120)
        return workspace()
      },
      read: async () => {
        await wait(80)
        return workspace()
      },
      resetImgt: async () => {
        await wait(200)
        return { removed: 12, workspace: workspace() }
      },
      imgtUsage: async () => ({ files: 12, bytes: 400_000_000 }),
      listStage: async (_root: string, stage) => {
        await wait(140)
        if (stage === 'choRaw') return choRaw
        if (stage === 'choJpg') return choJpg
        if (stage === 'edp') return edpFiles
        return endFiles
      },
      removePick: async (_root, _stem) => {
        await wait(160)
        return workspace()
      }
    },
    importPicks: async (request: ImportRequest): Promise<ImportResult> => {
      const total = request.pairs.length * 2
      const bytesTotal = request.pairs.reduce((sum, pair) => sum + pair.raw.size + pair.jpg.size, 0)
      for (let i = 1; i <= total; i += 1) {
        await wait(60)
        const pair = request.pairs[Math.min(request.pairs.length - 1, Math.ceil(i / 2) - 1)]
        progressListeners.forEach((listener) =>
          listener({
            phase: i === total ? 'done' : 'working',
            done: i,
            total,
            bytesDone: Math.round((bytesTotal * i) / total),
            bytesTotal,
            current: i % 2 === 0 ? `${pair.baseName}.JPG` : `${pair.baseName}.NEF`,
            speed: 180 * 1024 * 1024
          })
        )
      }
      const items = request.pairs.map((pair) => ({
        base: pair.baseName,
        rawName: `${pair.baseName}.NEF`,
        jpgName: `${pair.baseName}.JPG`,
        at: Date.now()
      }))
      return {
        bytes: bytesTotal,
        transferred: total,
        skipped: 0,
        failed: [],
        durationMs: 2400,
        items,
        skippedExisting: [],
        workspace: workspace()
      }
    },
    onImportProgress: (listener) => {
      progressListeners.add(listener)
      return () => progressListeners.delete(listener)
    },
    round: {
      create: async ({ items, editor }) => {
        await wait(160)
        const no = currentSession.rounds.length + 1
        currentSession = {
          ...currentSession,
          editor,
          rounds: [
            ...currentSession.rounds,
            { id: `R${no}`, no, createdAt: Date.now(), editor, items, status: 'pending' }
          ]
        }
        return workspace()
      },
      verify: async ({ roundId }) => {
        await wait(420)
        const round = currentSession.rounds.find((item) => item.id === roundId)
        const found: Record<string, string> = {}
        const missing: string[] = []
        round?.items.forEach((item) => {
          const hit = edpFiles.find((file) => file.base.toLowerCase() === item.base.toLowerCase())
          if (hit) found[item.base] = hit.name
          else missing.push(item.base)
        })
        const verification = { checkedAt: Date.now(), found, missing }
        currentSession = {
          ...currentSession,
          rounds: currentSession.rounds.map((item) =>
            item.id === roundId
              ? { ...item, verification, status: missing.length === 0 ? ('verified' as const) : ('pending' as const) }
              : item
          )
        }
        return { verification, workspace: workspace() }
      },
      cancel: async (_root, roundId) => {
        await wait(120)
        currentSession = {
          ...currentSession,
          rounds: currentSession.rounds.filter((round) => round.id !== roundId)
        }
        return workspace()
      }
    },
    edit: {
      read: async (_root, sourceName) => {
        await wait(120)
        const hit = edits.get(sourceName)
        return hit ?? null
      },
      save: async (request) => {
        await wait(420)
        const stem = request.sourceName.replace(/\.[^.]+$/, '')
        const name = `${stem}${request.format === 'png' ? '.png' : '.jpg'}`
        const doc: EditDoc = {
          version: 1,
          source: request.sourceName,
          updatedAt: Date.now(),
          params: request.params,
          output: name
        }
        edits.set(request.sourceName, doc)
        return { name, xmlName: `${stem}.xml`, path: `${ROOT}\\IMGT\\EDP\\${name}`, workspace: workspace() }
      },
      clear: async (_root, sourceName) => {
        edits.delete(sourceName)
      }
    },
    exportImage: async (request) => {
      await wait(320)
      const stem = request.sourceName.replace(/\.[^.]+$/, '')
      const name = `${stem}END${request.format === 'png' ? '.png' : '.jpg'}`
      return { name, path: `${ROOT}\\IMGT\\END\\${name}`, workspace: workspace() }
    },
    exif: async () => {
      await wait(90)
      return EXIF_TEMPLATE
    },
    histogram: async () => {
      await wait(120)
      return demoHistogram()
    },
    imageMeta: async () => ({ width: 8256, height: 5504, size: 26_800_000, mtimeMs: Date.now() }),
    fonts: async () => [
      'Microsoft YaHei UI',
      '微软雅黑',
      '思源黑体',
      'Segoe UI',
      'Arial',
      'Georgia',
      'Times New Roman',
      'Consolas',
      'SimSun',
      'KaiTi',
      'Impact'
    ],
    drive: async () => drive,
    settings: {
      read: async () => ({ settings: demoSettings(), backgroundPath: null }),
      save: async (patch) => {
        await wait(60)
        if (patch.theme) {
          try {
            window.localStorage.setItem('ybirlwu.theme', patch.theme)
          } catch {
          }
        }
        const next = { ...demoSettings(), ...patch }
        return { settings: next, backgroundPath: null }
      },
      chooseBackground: async () => null,
      saveBackground: async () => ({ settings: demoSettings(), backgroundPath: null }),
      clearBackground: async () => ({ settings: demoSettings(), backgroundPath: null }),
      display: async () => ({
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
        size: { width: 1920, height: 1080 },
        scaleFactor: 1
      }),
      cache: async () => ({ files: 128, bytes: 24_000_000, dir: 'demo/cache' }),
      clearCache: async () => ({ removed: 128 })
    },
    plugins: {
      list: async () => DEMO_PLUGINS,
      reload: async () => DEMO_PLUGINS,
      openFolder: async () => undefined
    },
    editor: {
      detect: async () => ({ photoshop: PS_PATH, lightroom: LR_PATH }),
      choose: async () => PS_PATH,
      launch: async ({ files, editor }) => {
        await wait(200)
        return {
          launched: files.length > 0,
          exe: editor === 'ps' ? PS_PATH : LR_PATH,
          fallback: false,
          editor
        }
      }
    }
  }
}