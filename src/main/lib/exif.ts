import { promises as fs } from 'node:fs'
import * as exifrModule from 'exifr'
import type { ExifInfo } from '@shared/types'

type ExifrLike = { parse: (input: string, options?: Record<string, unknown>) => Promise<Record<string, unknown> | undefined> }

const raw = exifrModule as any
const exifr: ExifrLike = (raw?.parse ? raw : raw?.default) as ExifrLike

const asNumber = (value: unknown): number | undefined => {
  const num = typeof value === 'string' ? Number.parseFloat(value) : value
  return typeof num === 'number' && Number.isFinite(num) ? num : undefined
}

const asText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const text = value.replace(/\u0000/g, '').trim()
  return text.length > 0 ? text : undefined
}

function formatShutter(value: number | undefined): string | undefined {
  if (!value || value <= 0) return undefined
  if (value >= 1) return `${Number(value.toFixed(1))}s`
  return `1/${Math.round(1 / value)}s`
}

function formatDate(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const pad = (n: number): string => String(n).padStart(2, '0')
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  }
  return asText(value)
}

export async function readExif(target: string): Promise<ExifInfo | null> {
  try {
    const stat = await fs.stat(target)
    if (!stat.isFile()) return null
  } catch {
    return null
  }

  try {
    const data = await exifr.parse(target, {
      tiff: true,
      exif: true,
      ifd0: true,
      gps: false,
      interop: false,
      makerNote: false,
      userComment: false,
      translateValues: false
    })
    if (!data) return null

    const widths = [data.ExifImageWidth, data.ImageWidth, data.PixelXDimension]
      .map(asNumber)
      .filter((value): value is number => !!value && value > 0)
    const heights = [data.ExifImageHeight, data.ImageHeight, data.PixelYDimension]
      .map(asNumber)
      .filter((value): value is number => !!value && value > 0)

    const info: ExifInfo = {
      width: widths.length > 0 ? Math.max(...widths) : undefined,
      height: heights.length > 0 ? Math.max(...heights) : undefined,
      make: asText(data.Make),
      model: asText(data.Model),
      lens: asText(data.LensModel) ?? asText(data.Lens) ?? asText(data.LensInfo),
      iso: asNumber(data.ISO),
      shutter: formatShutter(asNumber(data.ExposureTime)),
      aperture: asNumber(data.FNumber) ? `f/${Number(asNumber(data.FNumber)!.toFixed(1))}` : undefined,
      focalLength: asNumber(data.FocalLength) ? `${Math.round(asNumber(data.FocalLength)!)}mm` : undefined,
      dateTaken: formatDate(data.DateTimeOriginal) ?? formatDate(data.CreateDate) ?? formatDate(data.ModifyDate),
      orientation: asNumber(data.Orientation),
      software: asText(data.Software)
    }

    const hasAny = Object.values(info).some((value) => value !== undefined)
    return hasAny ? info : null
  } catch {
    return null
  }
}

export async function readOrientation(target: string): Promise<number> {
  try {
    const data = await exifr.parse(target, { pick: ['Orientation'], translateValues: false })
    const value = asNumber(data?.Orientation)
    return value && value >= 1 && value <= 8 ? value : 1
  } catch {
    return 1
  }
}

export async function readPixelSize(target: string): Promise<{ width: number; height: number } | null> {
  try {
    const data = await exifr.parse(target, {
      pick: ['ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight', 'PixelXDimension', 'PixelYDimension']
    })
    if (!data) return null
    const pairs: Array<[unknown, unknown]> = [
      [data.PixelXDimension, data.PixelYDimension],
      [data.ExifImageWidth, data.ExifImageHeight],
      [data.ImageWidth, data.ImageHeight]
    ]
    let best: { width: number; height: number } | null = null
    for (const [rawWidth, rawHeight] of pairs) {
      const width = asNumber(rawWidth)
      const height = asNumber(rawHeight)
      if (!width || !height || width < 2 || height < 2) continue
      if (!best || width * height > best.width * best.height) best = { width, height }
    }
    return best
  } catch {
    return null
  }
}
