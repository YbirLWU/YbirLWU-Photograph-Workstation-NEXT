import type { DevelopParams } from './types'

export const DEFAULT_DEVELOP: DevelopParams = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  saturation: 0,
  clarity: 0,
  sharpness: 0,
  vignette: 0,
  rotate: 0,
  flipH: false
}

export type DevelopKey = keyof Omit<DevelopParams, 'rotate' | 'flipH'>

export const DEVELOP_RANGE: Record<DevelopKey, { min: number; max: number; step: number; label: string; group: string }> = {
  exposure: { min: -3, max: 3, step: 0.05, label: '曝光', group: 'light' },
  contrast: { min: -100, max: 100, step: 1, label: '对比度', group: 'light' },
  highlights: { min: -100, max: 100, step: 1, label: '高光', group: 'light' },
  shadows: { min: -100, max: 100, step: 1, label: '阴影', group: 'light' },
  whites: { min: -100, max: 100, step: 1, label: '白色色阶', group: 'light' },
  blacks: { min: -100, max: 100, step: 1, label: '黑色色阶', group: 'light' },
  temperature: { min: -100, max: 100, step: 1, label: '色温', group: 'color' },
  tint: { min: -100, max: 100, step: 1, label: '色调', group: 'color' },
  vibrance: { min: -100, max: 100, step: 1, label: '自然饱和度', group: 'color' },
  saturation: { min: -100, max: 100, step: 1, label: '饱和度', group: 'color' },
  clarity: { min: -100, max: 100, step: 1, label: '清晰度', group: 'detail' },
  sharpness: { min: -100, max: 100, step: 1, label: '锐化', group: 'detail' },
  vignette: { min: -100, max: 100, step: 1, label: '暗角', group: 'effect' }
}

export const DEVELOP_KEYS = Object.keys(DEVELOP_RANGE) as DevelopKey[]

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min > 0 ? min : 0
  return Math.min(max, Math.max(min, value))
}

export function normalizeDevelop(input?: Partial<DevelopParams> | null): DevelopParams {
  const next: DevelopParams = { ...DEFAULT_DEVELOP }
  if (!input) return next
  for (const key of DEVELOP_KEYS) {
    const raw = input[key]
    const range = DEVELOP_RANGE[key]
    if (typeof raw === 'number') next[key] = clampNumber(raw, range.min, range.max)
  }
  const rotate = Number(input.rotate)
  next.rotate = rotate === 90 || rotate === 180 || rotate === 270 ? rotate : 0
  next.flipH = Boolean(input.flipH)
  return next
}

export function hasEdits(params: DevelopParams): boolean {
  return (
    params.rotate !== 0 ||
    params.flipH ||
    DEVELOP_KEYS.some((key) => Math.abs(params[key]) > 0.0001)
  )
}

export function describeEdits(params: DevelopParams): string {
  const parts: string[] = []
  for (const key of DEVELOP_KEYS) {
    const value = params[key]
    if (Math.abs(value) < 0.0001) continue
    const range = DEVELOP_RANGE[key]
    parts.push(`${range.label} ${value > 0 ? '+' : ''}${Number(value.toFixed(2))}`)
  }
  if (params.rotate) parts.push(`旋转 ${params.rotate}°`)
  if (params.flipH) parts.push('水平翻转')
  return parts.length > 0 ? parts.join(' · ') : '原样输出'
}
