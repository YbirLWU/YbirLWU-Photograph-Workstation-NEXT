import type { DevelopParams } from '@shared/types'

type Lut = [Uint8ClampedArray, Uint8ClampedArray, Uint8ClampedArray]
function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

function buildLut(params: DevelopParams): Lut {
  const exposure = Math.pow(2, params.exposure)
  const temp = params.temperature / 100
  const tint = params.tint / 100
  const rGain = (1 + 0.3 * temp) * (1 + 0.05 * tint)
  const gGain = 1 - 0.22 * tint
  const bGain = (1 - 0.3 * temp) * (1 + 0.05 * tint)

  const gains = [rGain, gGain, bGain]
  const shadows = (params.shadows / 100) * 0.24
  const highlights = (params.highlights / 100) * 0.24
  const blacks = (params.blacks / 100) * 0.17
  const whites = (params.whites / 100) * 0.17
  const contrast = 1 + (params.contrast / 100) * 0.8
  return gains.map((gain) => {
    const lut = new Uint8ClampedArray(256)
    for (let i = 0; i < 256; i += 1) {
      let v = (i / 255) * exposure * gain
      v = clamp01(v)
      const shadowMask = (1 - v) * (1 - v)
      const highlightMask = v * v
      const blackMask = (1 - v) ** 4
      const whiteMask = v ** 4
      v += shadows * shadowMask + highlights * highlightMask + blacks * blackMask + whites * whiteMask
      v = clamp01(v)
      v = 0.5 + (v - 0.5) * contrast
      lut[i] = Math.round(clamp01(v) * 255)
    }
    return lut
  }) as Lut
}
function boxBlur(src: Float32Array, width: number, height: number, radius: number): Float32Array {
  if (radius < 1) return src.slice()
  const temp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  const window = radius * 2 + 1
  for (let y = 0; y < height; y += 1) {
    const row = y * width
    let sum = 0
    for (let x = -radius; x <= radius; x += 1) sum += src[row + Math.min(width - 1, Math.max(0, x))]
    for (let x = 0; x < width; x += 1) {
      temp[row + x] = sum / window
      const add = src[row + Math.min(width - 1, x + radius + 1)]
      const remove = src[row + Math.max(0, x - radius)]
      sum += add - remove
    }
  }
  for (let x = 0; x < width; x += 1) {
    let sum = 0
    for (let y = -radius; y <= radius; y += 1) sum += temp[Math.min(height - 1, Math.max(0, y)) * width + x]
    for (let y = 0; y < height; y += 1) {
      out[y * width + x] = sum / window
      const add = temp[Math.min(height - 1, y + radius + 1) * width + x]
      const remove = temp[Math.max(0, y - radius) * width + x]
      sum += add - remove
    }
  }
  return out
}
export interface RenderOptions {
  maxEdge?: number

  chunkRows?: number
  onProgress?: (ratio: number) => void
}
export async function renderDevelop(
  canvas: HTMLCanvasElement,
  source: ImageBitmap | HTMLImageElement,
  params: DevelopParams,
  options: RenderOptions = {}
): Promise<{ width: number; height: number }> {
  const naturalWidth = source.width || (source as HTMLImageElement).naturalWidth
  const naturalHeight = source.height || (source as HTMLImageElement).naturalHeight
  if (!naturalWidth || !naturalHeight) throw new Error('图片解码失败')
  const quarter = params.rotate === 90 || params.rotate === 270
  const portrait = quarter
  const baseWidth = portrait ? naturalHeight : naturalWidth
  const baseHeight = portrait ? naturalWidth : naturalHeight
  const maxEdge = options.maxEdge ?? Math.max(baseWidth, baseHeight)
  const scale = Math.min(1, maxEdge / Math.max(baseWidth, baseHeight))
  const width = Math.max(1, Math.round(baseWidth * scale))
  const height = Math.max(1, Math.round(baseHeight * scale))
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('无法创建绘图上下文')
  ctx.save()
  ctx.translate(width / 2, height / 2)
  ctx.rotate((params.rotate * Math.PI) / 180)
  if (params.flipH) ctx.scale(-1, 1)
  const drawWidth = portrait ? height : width
  const drawHeight = portrait ? width : height
  ctx.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
  ctx.restore()
  const image = ctx.getImageData(0, 0, width, height)
  await applyDevelop(image, params, options.onProgress)
  ctx.putImageData(image, 0, 0)
  return { width, height }
}
export async function applyDevelop(
  image: ImageData,
  params: DevelopParams,
  onProgress?: (ratio: number) => void
): Promise<void> {
  const { data, width, height } = image
  const pixels = width * height
  const [lutR, lutG, lutB] = buildLut(params)
  const sat = 1 + params.saturation / 100
  const vib = params.vibrance / 100
  const clarity = params.clarity / 100
  const sharpness = params.sharpness / 100
  const vignette = params.vignette / 100
  const needLocal = Math.abs(clarity) > 0.001 || Math.abs(sharpness) > 0.001
  const luma = needLocal ? new Float32Array(pixels) : null
  const chunkRows = Math.max(16, Math.min(height || 16, 128))
  let rowStart = 0

  while (rowStart < height) {
    const rowEnd = Math.min(height, rowStart + chunkRows)
    for (let y = rowStart; y < rowEnd; y += 1) {
      let offset = y * width * 4
      let lumaIndex = y * width
      for (let x = 0; x < width; x += 1, offset += 4, lumaIndex += 1) {
        let r = lutR[data[offset]]
        let g = lutG[data[offset + 1]]
        let b = lutB[data[offset + 2]]
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
        if (sat !== 1 || vib !== 0) {
          const max = r > g ? (r > b ? r : b) : g > b ? g : b
          const min = r < g ? (r < b ? r : b) : g < b ? g : b
          const currentSat = max > 0 ? (max - min) / max : 0
          let factor = sat
          if (vib !== 0) factor *= 1 + vib * 0.75 * (1 - currentSat)
          r = l + (r - l) * factor
          g = l + (g - l) * factor
          b = l + (b - l) * factor
        }
        data[offset] = r
        data[offset + 1] = g
        data[offset + 2] = b
        if (luma) luma[lumaIndex] = 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
    }
    rowStart = rowEnd
    if (height > 512) {
      onProgress?.(Math.min(0.85, (rowStart / height) * 0.7))
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
  if (needLocal || vignette !== 0) {
    const radius = Math.max(2, Math.round(Math.min(width, height) * 0.006))
    const base = luma ? boxBlur(luma, width, height, radius) : null
    const fine = luma && Math.abs(sharpness) > 0.001 ? boxBlur(luma, width, height, 1) : null
    const cx = (width - 1) / 2
    const cy = (height - 1) / 2
    const maxR2 = cx * cx + cy * cy || 1

    rowStart = 0
    while (rowStart < height) {
      const rowEnd = Math.min(height, rowStart + chunkRows)
      for (let y = rowStart; y < rowEnd; y += 1) {
        let offset = y * width * 4
        let index = y * width
        for (let x = 0; x < width; x += 1, offset += 4, index += 1) {
          if (luma) {
            let delta = 0
            if (base && clarity !== 0) delta += (luma[index] - base[index]) * clarity * 1.25
            if (fine && sharpness !== 0) delta += (luma[index] - fine[index]) * sharpness * 0.95
            if (delta !== 0) {
              data[offset] += delta
              data[offset + 1] += delta
              data[offset + 2] += delta
            }
          }
          if (vignette !== 0) {
            const dx = x - cx
            const dy = y - cy
            const ratio = (dx * dx + dy * dy) / maxR2
            const factor = Math.max(0, 1 - vignette * 0.62 * ratio)
            data[offset] *= factor
            data[offset + 1] *= factor
            data[offset + 2] *= factor
          }
        }
      }
      rowStart = rowEnd
      if (height > 512) {
        onProgress?.(0.7 + Math.min(0.28, (rowStart / height) * 0.28))
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }
  }
  onProgress?.(1)
}