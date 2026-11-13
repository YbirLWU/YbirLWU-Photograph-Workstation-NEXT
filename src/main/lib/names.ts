import path from 'node:path'

export function splitName(fileName: string): { stem: string; ext: string } {
  const ext = path.extname(fileName)
  return { stem: fileName.slice(0, fileName.length - ext.length), ext }
}

const STAGE_RE = /_(SEL|POL|FRM)\d+$/i
const END_RE = /[-_\s]?END$/i
const NOISE_RE = /(?:[\s_-]+(?:edit(?:ed)?|final|ok|copy|v\d+|副本|编辑|修图|调色))+$/i

export function originalBase(stem: string): string {
  return stem.replace(STAGE_RE, '').replace(END_RE, '')
}

export function matchKey(fileName: string): string {
  const { stem } = splitName(fileName)
  let value = stem.trim()
  value = value.replace(/\s*\(\d+\)$/, '')
  value = value.replace(/\s*-\s*copy$/i, '')
  value = value.replace(STAGE_RE, '')
  value = value.replace(END_RE, '')
  value = value.replace(NOISE_RE, '')
  return value.toLowerCase().replace(/[\s_-]+/g, '')
}
export function endName(sourceName: string, taken: Set<string>): string {
  const { stem, ext } = splitName(sourceName)
  const base = END_RE.test(stem) ? stem : `${stem}END`
  let candidate = `${base}${ext}`
  if (!taken.has(candidate.toLowerCase())) return candidate
  for (let index = 2; index <= 999; index += 1) {
    candidate = `${base}-${index}${ext}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return `${base}-${Date.now()}${ext}`
}
export function dedupeStem(taken: Set<string>, stem: string): string {
  const safe = stem.trim() || 'IMAGE'
  if (!taken.has(safe.toLowerCase())) return safe
  for (let index = 2; index <= 999; index += 1) {
    const candidate = `${safe}-${index}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return `${safe}-${Date.now()}`
}