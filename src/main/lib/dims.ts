import { nativeImage } from 'electron'
import { promises as fs } from 'node:fs'
import { readOrientation, readPixelSize } from './exif'

export interface ImageSize {
  width: number
  height: number
}
export function swapsAxes(orientation: number): boolean {
  return orientation >= 5 && orientation <= 8
}
export function displaySize(size: ImageSize, orientation: number): ImageSize {
  return swapsAxes(orientation) ? { width: size.height, height: size.width } : { ...size }
}
export async function readImageSize(absPath: string): Promise<ImageSize | null> {
  let handle
  try {
    handle = await fs.open(absPath, 'r')
    const buffer = Buffer.alloc(262144)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    if (bytesRead < 32) return null
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
    }
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
      const kind = buffer.toString('ascii', 8, 12)
      if (kind === 'WEBP') {
        const chunk = buffer.toString('ascii', 12, 16)
        if (chunk === 'VP8 ') {
          const start = 26
          if (buffer[start + 3] === 0x9d && buffer[start + 4] === 0x01 && buffer[start + 5] === 0x2a) {
            return {
              width: buffer.readUInt16LE(start + 6) & 0x3fff,
              height: buffer.readUInt16LE(start + 8) & 0x3fff
            }
          }
        }
        if (chunk === 'VP8X') {
          return {
            width: 1 + buffer.readUIntLE(24, 3),
            height: 1 + buffer.readUIntLE(27, 3)
          }
        }
      }
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2
      while (offset + 9 < bytesRead) {
        if (buffer[offset] !== 0xff) {
          offset += 1
          continue
        }
        const marker = buffer[offset + 1]
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          offset += 2
          continue
        }
        const length = buffer.readUInt16BE(offset + 2)
        const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
        if (isSof) {
          return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) }
        }
        offset += 2 + Math.max(2, length)
      }
    }
  } catch {
    return null
  } finally {
    await handle?.close().catch(() => undefined)
  }
  return null
}
export function decodeSize(target: string): ImageSize | null {
  try {
    const image = nativeImage.createFromPath(target)
    if (image.isEmpty()) return null
    const { width, height } = image.getSize()
    return width && height ? { width, height } : null
  } catch {
    return null
  }
}
export interface OrientationPlan {
  orientation: number
   
  apply: number
  decoderHandled: boolean
  display: ImageSize | null
}
export async function planOrientation(
  absPath: string,
  decodedSize?: ImageSize | null
): Promise<OrientationPlan> {
  const orientation = await readOrientation(absPath).catch(() => 1)
  const stored = (await readImageSize(absPath)) ?? (await readPixelSize(absPath))
  if (!orientation || orientation === 1) {
    return { orientation: 1, apply: 1, decoderHandled: true, display: stored ?? decodedSize ?? null }
  }
  const decoded = decodedSize ?? decodeSize(absPath)
  const expected = stored ? displaySize(stored, orientation) : null

  let decoderHandled = false
  if (decoded && stored) {
    if (swapsAxes(orientation)) {
      decoderHandled = decoded.width === stored.height && decoded.height === stored.width
    } else if (decoded.width !== stored.width || decoded.height !== stored.height) {
      decoderHandled = true
    }
  }
  return {
    orientation,
    apply: decoderHandled ? 1 : orientation,
    decoderHandled,
    display: expected ?? decoded ?? null
  }
}
 
export async function readDisplaySize(
  absPath: string
): Promise<{ width: number; height: number; orientation: number } | null> {
  const [orientation, headerSize] = await Promise.all([
    readOrientation(absPath).catch(() => 1),
    readImageSize(absPath)
  ])
  const stored = headerSize ?? (await readPixelSize(absPath))
  if (stored) {
    const size = displaySize(stored, orientation)
    return { ...size, orientation }
  }
  const decoded = decodeSize(absPath)
  if (!decoded) return null
  const size = displaySize(decoded, 1)
  return { ...size, orientation }
}