export const RAW_FORMATS: Record<string, string> = {
  '.nef': 'Nikon NEF',
  '.nrw': 'Nikon NRW',
  '.cr2': 'Canon CR2',
  '.cr3': 'Canon CR3',
  '.crw': 'Canon CRW',
  '.arw': 'Sony ARW',
  '.srf': 'Sony SRF',
  '.sr2': 'Sony SR2',
  '.dng': 'DNG',
  '.raf': 'Fujifilm RAF',
  '.orf': 'Olympus ORF',
  '.rw2': 'Panasonic RW2',
  '.raw': 'Panasonic RAW',
  '.pef': 'Pentax PEF',
  '.srw': 'Samsung SRW',
  '.rwl': 'Leica RWL',
  '.3fr': 'Hasselblad 3FR',
  '.fff': 'Hasselblad FFF',
  '.iiq': 'Phase One IIQ',
  '.x3f': 'Sigma X3F',
  '.mos': 'Leaf MOS',
  '.mrw': 'Minolta MRW',
  '.kdc': 'Kodak KDC',
  '.dcr': 'Kodak DCR',
  '.erf': 'Epson ERF',
  '.mef': 'Mamiya MEF'
}
export const RAW_EXTS = new Set(Object.keys(RAW_FORMATS))

export const JPG_EXTS = new Set(['.jpg', '.jpeg', '.jpe', '.jfif'])
export const BITMAP_EXTS = new Set([...JPG_EXTS, '.png', '.webp', '.tif', '.tiff', '.bmp'])
export const PREVIEWABLE_EXTS = new Set([...JPG_EXTS, '.png', '.webp', '.gif', '.bmp', '.avif', '.tif', '.tiff'])
export function isRawExt(ext: string): boolean {
  return RAW_EXTS.has(ext.toLowerCase())
}
export function isBitmapExt(ext: string): boolean {
  return BITMAP_EXTS.has(ext.toLowerCase())
}
export function extLabel(ext: string): string {
  const clean = ext.replace('.', '').toUpperCase()
  return clean ? clean.slice(0, 4) : 'FILE'
}
export function formatName(ext: string): string {
  return RAW_FORMATS[ext.toLowerCase()] ?? extLabel(ext)
}
export function countFormats(names: string[]): Array<{ ext: string; label: string; count: number }> {
  const map = new Map<string, number>()
  for (const name of names) {
    const dot = name.lastIndexOf('.')
    const ext = dot > 0 ? name.slice(dot).toLowerCase() : ''
    map.set(ext, (map.get(ext) ?? 0) + 1)
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([ext, count]) => ({ ext, label: extLabel(ext), count }))
}