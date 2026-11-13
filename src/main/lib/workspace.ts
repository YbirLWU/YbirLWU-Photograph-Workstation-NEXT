import { promises as fs } from 'node:fs'
import path from 'node:path'
import type {
  CreateRoundRequest,
  ImportIndexEntry,
  ImportProgress,
  ImportRequest,
  ImportResult,
  ImportedItem,
  PrepareMode,
  ResetResult,
  Round,
  RoundItem,
  SaveExportRequest,
  SaveExportResult,
  Stage,
  StageFile,
  TransferResult,
  VerifyRequest,
  VerifyResult,
  Workspace,
  WorkspacePaths
} from '@shared/types'
import { clearDir, dirSummary, ensureDir, isJunkFile, pathExists, placeFile } from './fsx'
import { ensureStructure, readSession, workspacePaths, writeSession } from './store'
import { dedupeStem, endName, matchKey, originalBase, splitName } from './names'
import { getDriveInfo } from './drives'
import { detectEditors, setPreferredEditor } from './editors'
import { readDisplaySize } from './dims'
import { BITMAP_EXTS } from '@shared/media'
import { listPlugins } from './plugins'

const MAX_ROUND = 10
const EDP_EXTS = BITMAP_EXTS
const IMAGE_EXTS = BITMAP_EXTS

interface RawFile {
  name: string
  absPath: string
  ext: string
  size: number
  mtimeMs: number
}

async function listDirFiles(dir: string): Promise<RawFile[]> {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const files: RawFile[] = []
  for (const entry of entries) {
    if (!entry.isFile() || isJunkFile(entry.name)) continue
    const abs = path.join(dir, entry.name)
    let stat
    try {
      stat = await fs.stat(abs)
    } catch {
      continue
    }
    files.push({
      name: entry.name,
      absPath: abs,
      ext: path.extname(entry.name).toLowerCase(),
      size: stat.size,
      mtimeMs: stat.mtimeMs
    })
  }
  return files
}

async function countFiles(dir: string): Promise<number> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    return entries.filter((entry) => entry.isFile() && !isJunkFile(entry.name)).length
  } catch {
    return 0
  }
}

export async function buildWorkspace(root: string): Promise<Workspace> {
  const paths = await ensureStructure(root)
  const session = await readSession(root)
  if (session.photoshopPath) setPreferredEditor('ps', session.photoshopPath)
  if (session.lightroomPath) setPreferredEditor('lr', session.lightroomPath)

  const [raw, jpg, choRaw, choJpg, edp, end, drive, editors] = await Promise.all([
    countFiles(paths.raw),
    countFiles(paths.jpg),
    countFiles(paths.choRaw),
    countFiles(paths.choJpg),
    countFiles(paths.edp),
    countFiles(paths.end),
    getDriveInfo(root),
    detectEditors()
  ])

  return {
    ...paths,
    drive,
    counts: { raw, jpg, choRaw, choJpg, edp, end },
    session,
    photoshopPath: session.photoshopPath ?? editors.photoshop,
    lightroomPath: session.lightroomPath ?? editors.lightroom,
    importIndex: await buildImportIndex(paths),
    plugins: listPlugins()
  }
}

async function buildImportIndex(paths: WorkspacePaths): Promise<Record<string, ImportIndexEntry>> {
  const [rawFiles, jpgFiles] = await Promise.all([listDirFiles(paths.choRaw), listDirFiles(paths.choJpg)])
  const map = new Map<string, ImportIndexEntry>()
  const ensure = (stem: string): ImportIndexEntry => {
    const key = stem.toLowerCase()
    const existing = map.get(key)
    if (existing) return existing
    const entry: ImportIndexEntry = { stem, rawName: '', jpgName: '', rawSize: 0, jpgSize: 0, at: 0 }
    map.set(key, entry)
    return entry
  }
  for (const file of rawFiles) {
    const { stem } = splitName(file.name)
    const entry = ensure(stem)
    entry.rawName = file.name
    entry.rawSize = file.size
    entry.at = Math.max(entry.at, file.mtimeMs)
  }
  for (const file of jpgFiles) {
    const { stem } = splitName(file.name)
    const entry = ensure(stem)
    entry.jpgName = file.name
    entry.jpgSize = file.size
    entry.at = Math.max(entry.at, file.mtimeMs)
  }
  return Object.fromEntries(map)
}

export async function imgtUsage(root: string): Promise<{ files: number; bytes: number }> {
  const summary = await dirSummary(workspacePaths(root).imgt)
  return { files: summary.files, bytes: summary.bytes }
}

export async function resetImgt(root: string): Promise<ResetResult> {
  const paths = await ensureStructure(root)
  let removed = 0
  for (const dir of [paths.cho, paths.edp, paths.end]) {
    removed += await clearDir(dir)
  }
  const session = await readSession(root)
  await writeSession(root, {
    ...session,
    imported: [],
    rounds: [],
    exports: []
  })
  return { removed, workspace: await buildWorkspace(root) }
}

export async function prepareWorkspace(root: string, mode: PrepareMode = 'ask'): Promise<Workspace> {
  await ensureStructure(root)
  const usage = await imgtUsage(root)
  if (usage.files > 0) {
    if (mode === 'ask') {
      return { ...(await buildWorkspace(root)), pending: usage }
    }
    if (mode === 'reset') {
      await resetImgt(root)
    }
  }
  return buildWorkspace(root)
}
export async function listStage(root: string, stage: Stage): Promise<StageFile[]> {
  const paths = workspacePaths(root)
  const dir =
    stage === 'choRaw' ? paths.choRaw : stage === 'choJpg' ? paths.choJpg : stage === 'edp' ? paths.edp : paths.end
  if (!(await pathExists(dir))) return []
  let files = await listDirFiles(dir)
  if (stage === 'edp' || stage === 'end') {
    files = files.filter((file) => IMAGE_EXTS.has(file.ext))
  }
  const xmlStems = new Set<string>()
  if (stage === 'edp') {
    let entries: string[] = []
    try {
      entries = await fs.readdir(paths.edp)
    } catch {
      entries = []
    }
    for (const entry of entries) {
      if (entry.toLowerCase().endsWith('.xml')) xmlStems.add(entry.slice(0, -4).toLowerCase())
    }
  }
  const result: StageFile[] = []
  for (const file of files) {
    const { stem } = splitName(file.name)
    let size: { width: number; height: number; orientation: number } | null = null
    if (IMAGE_EXTS.has(file.ext)) {
      size = await readDisplaySize(file.absPath)
    }
    result.push({
      name: file.name,
      stem,
      base: originalBase(stem),
      absPath: file.absPath,
      ext: file.ext,
      size: file.size,
      mtimeMs: file.mtimeMs,
      width: size?.width,
      height: size?.height,
      orientation: size?.orientation,
      edited: stage === 'edp' ? xmlStems.has(stem.toLowerCase()) : undefined
    })
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true }))
}

export async function importPicks(
  request: ImportRequest,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  if (!request.root) throw new Error('请先指定工作区')
  if (!request.pairs?.length) throw new Error('请先勾选要入库的图片')
  const paths = await ensureStructure(request.root)
  const move = request.mode === 'move'

  const choRawFiles = await listDirFiles(paths.choRaw)
  const choJpgFiles = await listDirFiles(paths.choJpg)
  const taken = new Set<string>()
  const existing = new Map<string, { rawSize: number; jpgSize: number }>()
  for (const file of choRawFiles) {
    const stem = splitName(file.name).stem.toLowerCase()
    taken.add(stem)
    existing.set(stem, { rawSize: file.size, jpgSize: existing.get(stem)?.jpgSize ?? 0 })
  }
  for (const file of choJpgFiles) {
    const stem = splitName(file.name).stem.toLowerCase()
    taken.add(stem)
    existing.set(stem, { rawSize: existing.get(stem)?.rawSize ?? 0, jpgSize: file.size })
  }
  const bytesTotal = request.pairs.reduce((sum, pair) => sum + pair.raw.size + pair.jpg.size, 0)
  const startedAt = Date.now()
  const total = request.pairs.length * 2
  let done = 0
  let bytesDone = 0
  let lastEmit = 0
  let lastBytes = 0
  let lastTime = startedAt
  const emit = (current: string, force = false): void => {
    const now = Date.now()
    if (!force && now - lastEmit < 110) return
    lastEmit = now
    const elapsed = Math.max(1, now - lastTime)
    const speed = ((bytesDone - lastBytes) / elapsed) * 1000
    lastBytes = bytesDone
    lastTime = now
    onProgress?.({
      phase: done >= total ? 'done' : 'working',
      done,
      total,
      bytesDone,
      bytesTotal,
      current,
      speed
    })
  }
  const result: TransferResult = { bytes: 0, transferred: 0, skipped: 0, failed: [], durationMs: 0 }
  const items: ImportedItem[] = []
  const skippedExisting: string[] = []
  emit('准备中…', true)
  for (const pair of request.pairs) {
    const rawExt = pair.raw.ext || '.nef'
    const jpgExt = pair.jpg.ext || '.jpg'
    const baseStem = (pair.baseName || splitName(pair.raw.name).stem).toLowerCase()
    const already = existing.get(baseStem)
    if (already && already.rawSize === pair.raw.size && (already.jpgSize === 0 || already.jpgSize === pair.jpg.size)) {
      skippedExisting.push(pair.baseName || splitName(pair.raw.name).stem)
      done += 2
      emit('已跳过重复项', true)
      continue
    }
    const stem = dedupeStem(taken, pair.baseName || splitName(pair.raw.name).stem)
    taken.add(stem.toLowerCase())
    const rawName = `${stem}${rawExt}`
    const jpgName = `${stem}${jpgExt}`
    let ok = true
    try {
      const placed = await placeFile(pair.raw.absPath, paths.choRaw, rawName, 'rename', move, (delta) => {
        bytesDone += delta
        emit(rawName)
      })
      result.transferred += 1
      result.bytes += placed.bytes
    } catch (error) {
      ok = false
      result.failed.push({ path: pair.raw.absPath, reason: (error as Error).message })
    }
    done += 1
    emit(rawName, true)
    try {
      const placed = await placeFile(pair.jpg.absPath, paths.choJpg, jpgName, 'rename', move, (delta) => {
        bytesDone += delta
        emit(jpgName)
      })
      result.transferred += 1
      result.bytes += placed.bytes
    } catch (error) {
      ok = false
      result.failed.push({ path: pair.jpg.absPath, reason: (error as Error).message })
    }
    done += 1
    emit(jpgName, true)
    if (ok) {
      items.push({
        base: stem,
        rawName,
        jpgName,
        at: Date.now(),
        rawSize: pair.raw.size,
        jpgSize: pair.jpg.size
      })
      existing.set(stem.toLowerCase(), { rawSize: pair.raw.size, jpgSize: pair.jpg.size })
    } else {
      result.skipped += 2
    }
  }
  const session = await readSession(request.root)
  session.source = { rawDir: request.rawDir ?? '', jpgDir: request.jpgDir ?? '' }
  for (const item of items) {
    const index = session.imported.findIndex((entry) => entry.base.toLowerCase() === item.base.toLowerCase())
    if (index >= 0) session.imported[index] = item
    else session.imported.push(item)
  }
  await writeSession(request.root, session)
  result.durationMs = Date.now() - startedAt
  onProgress?.({
    phase: 'done',
    done: total,
    total,
    bytesDone: bytesTotal,
    bytesTotal,
    current: '',
    speed: 0
  })
  return { ...result, items, skippedExisting, workspace: await buildWorkspace(request.root) }
}
export async function createRound(request: CreateRoundRequest): Promise<Workspace> {
  const items = request.items ?? []
  if (items.length === 0) throw new Error('本轮没有选择图片')
  if (items.length > MAX_ROUND) throw new Error(`每轮最多 ${MAX_ROUND} 张，请分批挂起`)
  const paths = await ensureStructure(request.root)
  for (const item of items) {
    if (!(await pathExists(path.join(paths.choRaw, item.rawName)))) {
      throw new Error(`CHO/RAW 中找不到 ${item.rawName}，请刷新后再试`)
    }
  }
  const session = await readSession(request.root)
  const no = session.rounds.length + 1
  const round: Round = {
    id: `R${no}-${Date.now().toString(36)}`,
    no,
    createdAt: Date.now(),
    editor: request.editor,
    items,
    status: 'pending'
  }
  session.rounds.push(round)
  session.editor = request.editor
  await writeSession(request.root, session)
  return buildWorkspace(request.root)
}
export async function verifyRound(request: VerifyRequest): Promise<VerifyResult> {
  const paths = await ensureStructure(request.root)
  const session = await readSession(request.root)
  const round = session.rounds.find((item) => item.id === request.roundId)
  if (!round) throw new Error('找不到该轮次记录，请重新挂起')
  const files = (await listDirFiles(paths.edp)).filter((file) => EDP_EXTS.has(file.ext))
  const byKey = new Map<string, RawFile[]>()
  for (const file of files) {
    const key = matchKey(file.name)
    const bucket = byKey.get(key)
    if (bucket) bucket.push(file)
    else byKey.set(key, [file])
  }
  const found: Record<string, string> = {}
  const missing: string[] = []

  for (const item of round.items as RoundItem[]) {
    const key = matchKey(item.base)
    const bucket = byKey.get(key)
    if (!bucket || bucket.length === 0) {
      missing.push(item.base)
      continue
    }
    bucket.sort((a, b) => b.mtimeMs - a.mtimeMs)
    found[item.base] = bucket[0].name
  }
  round.verification = { checkedAt: Date.now(), found, missing }
  round.status = missing.length === 0 ? 'verified' : 'pending'
  await writeSession(request.root, session)
  return { verification: round.verification, workspace: await buildWorkspace(request.root) }
}
export async function saveExport(request: SaveExportRequest): Promise<SaveExportResult> {
  if (!request.root) throw new Error('请先指定工作区')
  if (!request.sourceName) throw new Error('缺少来源文件名')
  const bytes =
    request.data instanceof ArrayBuffer
      ? Buffer.from(new Uint8Array(request.data))
      : Buffer.from(request.data as unknown as Uint8Array)
  if (bytes.length < 256) throw new Error('画布内容为空，导出失败')
  if (bytes.length > 260 * 1024 * 1024) throw new Error('导出文件过大（>260MB），请降低画布尺寸')
  const paths = await ensureStructure(request.root)
  await ensureDir(paths.end)
  const taken = new Set((await listDirFiles(paths.end)).map((file) => file.name.toLowerCase()))
  const name = endName(request.sourceName, taken)
  const target = path.join(paths.end, name)
  await fs.writeFile(target, bytes)
  const session = await readSession(request.root)
  session.exports = [
    {
      source: request.sourceName,
      output: name,
      at: Date.now(),
      format: request.format,
      width: request.width,
      height: request.height,
      padTop: request.padTop,
      padBottom: request.padBottom
    },
    ...session.exports
  ].slice(0, 800)
  await writeSession(request.root, session)
  return { name, path: target, workspace: await buildWorkspace(request.root) }
}

export async function cancelRound(root: string, roundId: string): Promise<Workspace> {
  const session = await readSession(root)
  const existed = session.rounds.some((round) => round.id === roundId)
  if (!existed) throw new Error('找不到该轮次记录，可能已被撤销')
  session.rounds = session.rounds.filter((round) => round.id !== roundId)
  await writeSession(root, session)
  return buildWorkspace(root)
}
export async function removePick(root: string, stem: string): Promise<Workspace> {
  if (!stem) throw new Error('缺少要移出的文件名')
  const paths = await ensureStructure(root)
  const key = stem.toLowerCase()
  let removed = 0
  for (const dir of [paths.choRaw, paths.choJpg]) {
    let entries: string[] = []
    try {
      entries = await fs.readdir(dir)
    } catch {
      continue
    }
    for (const entry of entries) {
      if (splitName(entry).stem.toLowerCase() !== key) continue
      await fs.unlink(path.join(dir, entry)).catch(() => undefined)
      removed += 1
    }
  }
  if (removed === 0) throw new Error(`CHO 中找不到 ${stem}`)
  const session = await readSession(root)
  session.imported = session.imported.filter((item) => item.base.toLowerCase() !== key)
  await writeSession(root, session)
  return buildWorkspace(root)
}
export async function rememberEditor(root: string | undefined, kind: 'ps' | 'lr', exe: string): Promise<string> {
  setPreferredEditor(kind, exe)
  if (root) {
    const session = await readSession(root)
    if (kind === 'ps') session.photoshopPath = exe
    else session.lightroomPath = exe
    await writeSession(root, session)
  }
  return exe
}