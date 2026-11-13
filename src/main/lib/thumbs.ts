import { app, nativeImage, protocol } from 'electron'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { HistogramData, ImageMeta } from '@shared/types'
import type { ImageSize } from './dims'
import { planOrientation, readDisplaySize, readImageSize } from './dims'

export { readImageSize }

const MAX_PARALLEL = 3
let active = 0
const waiters: Array<() => void> = []
async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (active >= MAX_PARALLEL) await new Promise<void>((resolve) => waiters.push(resolve))
  active += 1
  try {
    return await task()
  } finally {
    active -= 1
    const next = waiters.shift()
    if (next) next()
  }
}
function cacheRoot(): string {
  return path.join(app.getPath('userData'), 'image-cache')
}
const jobs = new Map<string, Promise<string | null>>()
 
const CACHE_VERSION = 'v6'

function keyOf(absPath: string, maxEdge: number, quality: number, size: number, mtimeMs: number): string {
  return createHash('sha1')
    .update(`${CACHE_VERSION}|${absPath}|${size}|${Math.round(mtimeMs)}|${maxEdge}|${quality}`)
    .digest('hex')
}
async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}
async function makeThumbnail(absPath: string, maxEdge: number): Promise<Electron.NativeImage | null> {
  const plan = await planOrientation(absPath)
  const expected = plan.display
  try {
    const thumb = await nativeImage.createThumbnailFromPath(absPath, {
      width: maxEdge,
      height: maxEdge
    })
    if (!thumb.isEmpty()) {
      return fitWithin(enforceAspect(thumb, expected, plan.orientation), maxEdge)
    }
  } catch {
  }
  try {
    const image = nativeImage.createFromPath(absPath)
    if (image.isEmpty()) return null
    return fitWithin(enforceAspect(image, expected, plan.orientation), maxEdge)
  } catch {
    return null
  }
}
function enforceAspect(
  image: Electron.NativeImage,
  expected: ImageSize | null,
  orientation: number
): Electron.NativeImage {
  if (!expected) return image
  const { width, height } = image.getSize()
  if (!width || !height) return image
  const wantPortrait = expected.height > expected.width
  const isPortrait = height > width
  if (wantPortrait === isPortrait) return image
  return rotate90(image, orientation !== 7 && orientation !== 8)
}
function fitWithin(image: Electron.NativeImage, maxEdge: number): Electron.NativeImage {
  const { width, height } = image.getSize()
  const edge = Math.max(width, height)
  if (edge <= maxEdge) return image
  const scale = maxEdge / edge
  return image.resize({
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    quality: 'good'
  })
}
function rotate90(image: Electron.NativeImage, clockwise: boolean): Electron.NativeImage {
  const { width, height } = image.getSize()
  if (width === 0 || height === 0) return image
  const buffer = image.toBitmap()
  const src = new Uint32Array(buffer.buffer, buffer.byteOffset, width * height)
  const dst = new Uint32Array(width * height)
  for (let y = 0; y < height; y += 1) {
    const row = y * width
    for (let x = 0; x < width; x += 1) {
      const value = src[row + x]
      if (clockwise) dst[x * height + (height - 1 - y)] = value
      else dst[(width - 1 - x) * height + y] = value
    }
  }
  return nativeImage.createFromBitmap(Buffer.from(dst.buffer), { width: height, height: width })
}
export async function ensureDerived(
  absPath: string,
  maxEdge: number,
  quality = 82
): Promise<string | null> {
  let stat
  try {
    stat = await fs.stat(absPath)
  } catch {
    return null
  }
  if (!stat.isFile()) return null
  const key = keyOf(absPath, maxEdge, quality, stat.size, stat.mtimeMs)
  const dir = path.join(cacheRoot(), key.slice(0, 2))
  const target = path.join(dir, `${key}.jpg`)
  if (await exists(target)) return target
  const running = jobs.get(key)
  if (running) return running

  const task = withSlot(async () => {
    const image = await makeThumbnail(absPath, maxEdge)
    if (!image) return null
    const buffer = image.toJPEG(quality)
    if (buffer.length === 0) return null
    await fs.mkdir(dir, { recursive: true })
    const tmp = `${target}.${process.pid}.tmp`
    await fs.writeFile(tmp, buffer)
    await fs.rename(tmp, target).catch(async () => {
      await fs.writeFile(target, buffer)
      await fs.unlink(tmp).catch(() => undefined)
    })
    return target
  })
    .catch(() => null)
    .finally(() => jobs.delete(key))
  jobs.set(key, task)
  return task
}
const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff'
}
function decodePath(url: string): string | null {
  const parsed = new URL(url)
  let filePath = decodeURIComponent(parsed.pathname)
  if (/^\/[a-zA-Z]:/.test(filePath)) filePath = filePath.slice(1)
  return filePath || null
}
export function registerImageProtocols(): void {
  protocol.handle('thumb', async (request) => {
    const filePath = decodePath(request.url)
    if (!filePath) return new Response('bad request', { status: 400 })
    const target = await ensureDerived(filePath, 640, 78)
    if (!target) return new Response('not available', { status: 404 })
    const data = await fs.readFile(target)
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=604800'
      }
    })
  })
  protocol.handle('preview', async (request) => {
    const filePath = decodePath(request.url)
    if (!filePath) return new Response('bad request', { status: 400 })
    const target = await ensureDerived(filePath, 3072, 88)
    if (!target) return new Response('not available', { status: 404 })
    const data = await fs.readFile(target)
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=604800'
      }
    })
  })
  protocol.handle('media', async (request) => {
    const filePath = decodePath(request.url)
    if (!filePath) return new Response('bad request', { status: 400 })
    const ext = path.extname(filePath).toLowerCase()
    if (!MIME[ext]) return new Response('unsupported media type', { status: 415 })
    try {
      const data = await fs.readFile(filePath)
      return new Response(new Uint8Array(data), {
        headers: {
          'Content-Type': MIME[ext],
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        }
      })
    } catch {
      return new Response('not found', { status: 404 })
    }
  })
}
export async function computeHistogram(absPath: string): Promise<HistogramData | null> {
  const derived = await ensureDerived(absPath, 1400, 90)
  if (!derived) return null
  try {
    const image = nativeImage.createFromPath(derived)
    if (image.isEmpty()) return null
    const { width, height } = image.getSize()
    if (width === 0 || height === 0) return null
    const bitmap = image.toBitmap()
    const r = new Array<number>(256).fill(0)
    const g = new Array<number>(256).fill(0)
    const b = new Array<number>(256).fill(0)
    const l = new Array<number>(256).fill(0)
    const pixels = width * height
    const stride = Math.max(1, Math.floor(pixels / 400_000))
    let samples = 0
    for (let index = 0; index < pixels; index += stride) {
      const offset = index * 4
      const blue = bitmap[offset]
      const green = bitmap[offset + 1]
      const red = bitmap[offset + 2]
      r[red] += 1
      g[green] += 1
      b[blue] += 1
      l[Math.min(255, Math.round(0.2126 * red + 0.7152 * green + 0.0722 * blue))] += 1
      samples += 1
    }
    if (samples === 0) return null
    return { r, g, b, l, samples }
  } catch {
    return null
  }
}
export async function readImageMeta(absPath: string): Promise<ImageMeta | null> {
  try {
    const stat = await fs.stat(absPath)
    if (!stat.isFile()) return null
    const display = await readDisplaySize(absPath)
    if (!display) return null
    return {
      width: display.width,
      height: display.height,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      orientation: display.orientation
    }
  } catch {
    return null
  }
}
export async function cacheStats(): Promise<{ files: number; bytes: number; dir: string }> {
  const root = cacheRoot()
  let files = 0
  let bytes = 0
  let dirs: string[] = []
  try {
    dirs = await fs.readdir(root)
  } catch {
    return { files: 0, bytes: 0, dir: root }
  }
  for (const dir of dirs) {
    let entries: string[] = []
    try {
      entries = await fs.readdir(path.join(root, dir))
    } catch {
      continue
    }
    for (const entry of entries) {
      try {
        const stat = await fs.stat(path.join(root, dir, entry))
        files += 1
        bytes += stat.size
      } catch {
        continue
      }
    }
  }
  return { files, bytes, dir: root }
}
export async function clearCache(): Promise<{ removed: number }> {
  const root = cacheRoot()
  let removed = 0
  let dirs: string[] = []
  try {
    dirs = await fs.readdir(root)
  } catch {
    return { removed: 0 }
  }
  for (const dir of dirs) {
    const full = path.join(root, dir)
    try {
      const entries = await fs.readdir(full)
      removed += entries.length
      await fs.rm(full, { recursive: true, force: true })
    } catch {
      continue
    }
  }
  return { removed }
}
export async function pruneCache(): Promise<void> {
  const root = cacheRoot()
  const files: Array<{ file: string; mtimeMs: number }> = []
  let dirs: string[] = []
  try {
    dirs = await fs.readdir(root)
  } catch {
    return
  }
  for (const dir of dirs) {
    const full = path.join(root, dir)
    let entries: string[] = []
    try {
      entries = await fs.readdir(full)
    } catch {
      continue
    }
    for (const entry of entries) {
      const file = path.join(full, entry)
      try {
        const stat = await fs.stat(file)
        files.push({ file, mtimeMs: stat.mtimeMs })
      } catch {
        continue
      }
    }
  }
  if (files.length <= 20000) return
  files.sort((a, b) => a.mtimeMs - b.mtimeMs)
  const remove = files.slice(0, Math.floor(files.length / 2))
  for (const item of remove) {
    await fs.unlink(item.file).catch(() => undefined)
  }
}