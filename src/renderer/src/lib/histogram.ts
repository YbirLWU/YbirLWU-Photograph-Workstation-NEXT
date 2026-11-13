export type { HistogramData } from '@shared/types'

export function toAreaPath(bins: number[], peak: number, height = 80): string {
  const step = 256 / bins.length
  let path = `M0 ${height}`
  for (let i = 0; i < bins.length; i += 1) {
    const value = Math.min(1, bins[i] / peak)
    const x = i * step
    path += ` L${x.toFixed(2)} ${(height - value * (height - 2)).toFixed(2)}`
  }
  path += ` L256 ${height} Z`
  return path
}

export function toLinePath(bins: number[], peak: number, height = 80): string {
  const step = 256 / bins.length
  let path = ''
  for (let i = 0; i < bins.length; i += 1) {
    const value = Math.min(1, bins[i] / peak)
    const x = i * step
    path += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${(height - value * (height - 2)).toFixed(2)} `
  }
  return path.trim()
}

export function peakOf(...channels: number[][]): number {
  const all = channels.flat().filter((value) => value > 0)
  if (all.length === 0) return 1
  all.sort((a, b) => a - b)
  const index = Math.min(all.length - 1, Math.floor(all.length * 0.995))
  return Math.max(1, all[index])
}
