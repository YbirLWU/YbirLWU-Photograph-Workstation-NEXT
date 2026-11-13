import { promises as fs, createReadStream, createWriteStream } from 'node:fs'
import path from 'node:path'
import type { ConflictMode, FileEntry } from '@shared/types'

const JUNK_FILES = new Set(['desktop.ini', 'thumbs.db', 'ehthumbs.db', '.ds_store'])
const MAX_FILES = 60000
const MAX_DEPTH = 12

export function isJunkFile(name: string): boolean {
  return JUNK_FILES.has(name.toLowerCase())
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

export async function assertDirectory(dir: string, label: string): Promise<void> {
  if (!dir || typeof dir !== 'string') throw new Error(`${label}未设置`)
  let stat
  try {
    stat = await fs.stat(dir)
  } catch {
    throw new Error(`${label}不存在或无法访问：${dir}`)
  }
  if (!stat.isDirectory()) throw new Error(`${label}不是文件夹：${dir}`)
}

export async function walkFiles(root: string): Promise<FileEntry[]> {
  const found: Array<{ name: string; abs: string }> = []

  const visit = async (dir: string, depth: number): Promise<void> => {
    if (depth > MAX_DEPTH || found.length >= MAX_FILES) return
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (found.length >= MAX_FILES) return
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await visit(abs, depth + 1)
        continue
      }
      if (!entry.isFile() || isJunkFile(entry.name)) continue
      found.push({ name: entry.name, abs })
    }
  }

  await visit(root, 0)

  const files: FileEntry[] = []
  const BATCH = 32
  for (let start = 0; start < found.length; start += BATCH) {
    const slice = found.slice(start, start + BATCH)
    const stats = await Promise.all(
      slice.map((item) => fs.stat(item.abs).catch(() => null))
    )
    slice.forEach((item, index) => {
      const stat = stats[index]
      if (!stat) return
      files.push({
        name: item.name,
        relPath: path.relative(root, item.abs).split(path.sep).join('/'),
        absPath: item.abs,
        ext: path.extname(item.name).toLowerCase(),
        size: stat.size,
        mtimeMs: stat.mtimeMs
      })
    })
  }

  return files
}

export async function dirSummary(dir: string): Promise<{ files: number; bytes: number }> {
  if (!(await pathExists(dir))) return { files: 0, bytes: 0 }
  const files = await walkFiles(dir)
  return { files: files.length, bytes: files.reduce((sum, file) => sum + file.size, 0) }
}

export async function clearDir(dir: string): Promise<number> {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  let removed = 0
  for (const entry of entries) {
    const target = path.join(dir, entry.name)
    try {
      await fs.rm(target, { recursive: true, force: true })
      removed += 1
    } catch {
    }
  }
  return removed
}

export async function uniquePath(dir: string, fileName: string): Promise<string> {
  const ext = path.extname(fileName)
  const base = fileName.slice(0, fileName.length - ext.length)
  for (let i = 2; i <= 999; i += 1) {
    const candidate = path.join(dir, `${base} (${i})${ext}`)
    if (!(await pathExists(candidate))) return candidate
  }
  return path.join(dir, `${base} (${Date.now()})${ext}`)
}

export interface PlaceResult {
  outcome: 'copied' | 'skipped' | 'renamed'
  dest: string
  bytes: number
}

export async function placeFile(
  src: string,
  destDir: string,
  fileName: string,
  conflict: ConflictMode,
  move = false,
  onBytes?: (delta: number) => void
): Promise<PlaceResult> {
  await ensureDir(destDir)
  let dest = path.join(destDir, fileName)
  let outcome: PlaceResult['outcome'] = 'copied'

  if (await pathExists(dest)) {
    if (conflict === 'skip') return { outcome: 'skipped', dest, bytes: 0 }
    if (conflict === 'rename') {
      dest = await uniquePath(destDir, fileName)
      outcome = 'renamed'
    }
  }

  const stat = await fs.stat(src)
  if (move) {
    if (await pathExists(dest)) await fs.unlink(dest).catch(() => undefined)
    try {
      await fs.rename(src, dest)
      onBytes?.(stat.size)
      return { outcome, dest, bytes: stat.size }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code
      if (code !== 'EXDEV') throw error
    }
  }

  const bytes = await copyWithProgress(src, dest, onBytes)
  if (move) await fs.unlink(src).catch(() => undefined)
  return { outcome, dest, bytes }
}

export async function readFileBytes(target: string, maxBytes = 320 * 1024 * 1024): Promise<Buffer> {
  const stat = await fs.stat(target)
  if (!stat.isFile()) throw new Error('目标不是文件')
  if (stat.size > maxBytes) throw new Error(`文件过大（${Math.round(stat.size / 1024 / 1024)}MB）`)
  return fs.readFile(target)
}

export async function copyWithProgress(
  src: string,
  dest: string,
  onBytes?: (delta: number) => void
): Promise<number> {
  const stat = await fs.stat(src)
  if (!onBytes || stat.size < 1_500_000) {
    await fs.copyFile(src, dest)
    onBytes?.(stat.size)
    return stat.size
  }

  return new Promise<number>((resolve, reject) => {
    const read = createReadStream(src, { highWaterMark: 1024 * 1024 })
    const write = createWriteStream(dest)
    let copied = 0
    let reported = 0
    let last = 0

    const flush = (): void => {
      if (copied > reported) {
        onBytes(copied - reported)
        reported = copied
      }
    }

    read.on('data', (chunk: string | Buffer) => {
      copied += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length
      const now = Date.now()
      if (now - last > 80) {
        last = now
        flush()
      }
    })
    read.on('error', reject)
    write.on('error', reject)
    write.on('finish', () => {
      flush()
      resolve(copied)
    })
    read.pipe(write)
  })
}
