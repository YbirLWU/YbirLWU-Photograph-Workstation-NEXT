import path from 'node:path'
import type { FileEntry, Issue, IssueKind, PairEntry, ScanReport, ScanStats } from '@shared/types'
import { JPG_EXTS, RAW_EXTS, countFormats, formatName } from '@shared/media'
import { assertDirectory, walkFiles } from './fsx'

function pairKey(relPath: string): string {
  const slash = relPath.lastIndexOf('/')
  const dir = slash >= 0 ? relPath.slice(0, slash + 1) : ''
  const name = relPath.slice(dir.length)
  const dot = name.lastIndexOf('.')
  return (dir + (dot > 0 ? name.slice(0, dot) : name)).toLowerCase()
}

function baseNameOf(relPath: string): string {
  const name = relPath.slice(relPath.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

interface SplitResult {
  map: Map<string, FileEntry[]>
  invalid: FileEntry[]
}

function splitByExt(files: FileEntry[], validExts: Set<string>): SplitResult {
  const map = new Map<string, FileEntry[]>()
  const invalid: FileEntry[] = []

  for (const file of files) {
    if (!validExts.has(file.ext)) {
      invalid.push(file)
      continue
    }
    const key = pairKey(file.relPath)
    const bucket = map.get(key)
    if (bucket) bucket.push(file)
    else map.set(key, [file])
  }

  return { map, invalid }
}

function extNote(ext: string, side: 'raw' | 'jpg'): string {
  const readable = ext ? formatName(ext) : '无后缀文件'
  if (side === 'raw') {
    if (JPG_EXTS.has(ext)) return '成片放错目录：JPG 文件出现在 RAW 文件夹'
    return `RAW 文件夹中不应出现的 ${readable} 文件`
  }
  if (RAW_EXTS.has(ext)) return `底片放错目录：${readable} 文件出现在 JPG 文件夹`
  return `JPG 文件夹中不应出现的 ${readable} 文件`
}

function makeIssue(kind: IssueKind, file: FileEntry, note: string): Issue {
  return {
    kind,
    name: file.name,
    relPath: file.relPath,
    absPath: file.absPath,
    ext: file.ext,
    size: file.size,
    note
  }
}

export async function scanFolders(input: {
  root?: string
  rawDir: string
  jpgDir: string
}): Promise<ScanReport> {
  const { rawDir, jpgDir } = input
  const startedAt = Date.now()
  await assertDirectory(rawDir, 'RAW 文件夹')
  await assertDirectory(jpgDir, 'JPG 文件夹')

  if (path.resolve(rawDir) === path.resolve(jpgDir)) {
    throw new Error('RAW 文件夹与 JPG 文件夹不能是同一个目录')
  }

  const [rawFiles, jpgFiles] = await Promise.all([walkFiles(rawDir), walkFiles(jpgDir)])
  const raw = splitByExt(rawFiles, RAW_EXTS)
  const jpg = splitByExt(jpgFiles, JPG_EXTS)

  const issues: Issue[] = []
  const pairs: PairEntry[] = []

  for (const [key, entries] of raw.map) {
    const counterparts = jpg.map.get(key)
    if (!counterparts) {
      issues.push(makeIssue('rawOnly', entries[0], '缺少同名 JPG 成片'))
      continue
    }
    pairs.push({ key, baseName: baseNameOf(entries[0].relPath), raw: entries[0], jpg: counterparts[0] })

    entries.slice(1).forEach((extra) => {
      issues.push(makeIssue('duplicate', extra, `同名 ${formatName(extra.ext)} 重复出现，无法判断哪一张是主文件`))
    })
    counterparts.slice(1).forEach((extra) => {
      issues.push(makeIssue('duplicate', extra, '同名 JPG 重复出现，无法判断哪一张是主文件'))
    })
  }

  for (const [key, entries] of jpg.map) {
    if (raw.map.has(key)) continue
    entries.forEach((entry) => {
      issues.push(makeIssue('jpgOnly', entry, '缺少同名底片'))
    })
  }

  raw.invalid.forEach((file) => issues.push(makeIssue('badExtRaw', file, extNote(file.ext, 'raw'))))
  jpg.invalid.forEach((file) => issues.push(makeIssue('badExtJpg', file, extNote(file.ext, 'jpg'))))

  const stats: ScanStats = {
    rawFiles: rawFiles.length,
    jpgFiles: jpgFiles.length,
    rawValid: rawFiles.length - raw.invalid.length,
    jpgValid: jpgFiles.length - jpg.invalid.length,
    matched: pairs.length,
    rawOnly: issues.filter((issue) => issue.kind === 'rawOnly').length,
    jpgOnly: issues.filter((issue) => issue.kind === 'jpgOnly').length,
    badExtRaw: raw.invalid.length,
    badExtJpg: jpg.invalid.length,
    formats: countFormats(pairs.map((pair) => pair.raw.name)),
    mixedRaw: new Set(pairs.map((pair) => pair.raw.ext)).size > 1
  }

  const warnings: string[] = []
  if (rawFiles.length === 0) warnings.push('RAW 文件夹里没有任何文件')
  if (jpgFiles.length === 0) warnings.push('JPG 文件夹里没有任何文件')
  if (rawFiles.length + jpgFiles.length > 20000) warnings.push('文件数量较多，扫描可能耗时，建议先按日期拆分目录')
  if (stats.mixedRaw) warnings.push('检测到多种 RAW 格式混装，已按文件名正常配对（导出/验收不受影响）')

  pairs.sort((a, b) => a.key.localeCompare(b.key, 'zh-Hans-CN', { numeric: true }))
  const order: IssueKind[] = ['rawOnly', 'jpgOnly', 'badExtRaw', 'badExtJpg', 'duplicate']
  issues.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.relPath.localeCompare(b.relPath, 'zh-Hans-CN', { numeric: true }))

  return {
    root: input.root ?? rawDir,
    rawDir,
    jpgDir,
    scannedAt: Date.now(),
    durationMs: Date.now() - startedAt,
    pairs,
    issues,
    stats,
    passed: pairs.length > 0 && issues.length === 0 && rawFiles.length === pairs.length && jpgFiles.length === pairs.length,
    warnings
  }
}
