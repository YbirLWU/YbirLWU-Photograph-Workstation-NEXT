const STAGE_RE = /_(SEL|POL|FRM)\d+$/i
const END_RE = /[-_\s]?END$/i
const NOISE_RE = /(?:[\s_-]+(?:edit(?:ed)?|final|ok|copy|v\d+|副本|编辑|修图|调色))+$/i

export function splitName(fileName: string): { stem: string; ext: string } {
  const index = fileName.lastIndexOf('.')
  if (index <= 0) return { stem: fileName, ext: '' }
  return { stem: fileName.slice(0, index), ext: fileName.slice(index) }
}

export function matchKeyOf(fileName: string): string {
  const { stem } = splitName(fileName)
  let value = stem.trim()
  value = value.replace(/\s*\(\d+\)$/, '')
  value = value.replace(/\s*-\s*copy$/i, '')
  value = value.replace(STAGE_RE, '')
  value = value.replace(END_RE, '')
  value = value.replace(NOISE_RE, '')
  return value.toLowerCase().replace(/[\s_-]+/g, '')
}
