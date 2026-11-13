import { execFile } from 'node:child_process'

let cache: string[] | null = null

function queryFonts(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'reg',
      ['query', 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'],
      { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout) => {
        if (error) reject(error)
        else resolve(stdout)
      }
    )
  })
}

export async function listSystemFonts(): Promise<string[]> {
  if (cache) return cache

  const families = new Set<string>()
  try {
    const stdout = await queryFonts()
    for (const line of stdout.split(/\r?\n/)) {
      const match = line.match(/^\s{2,}(.+?)\s+REG_SZ\s+(.+)$/)
      if (!match) continue
      const name = match[1]
        .replace(/\s*\((TrueType|OpenType|All Res|PostScript|Type 1|Vector|Bitmap)\)\s*$/i, '')
        .trim()
      if (!name || name.includes('\\') || name.length > 64) continue
      families.add(name)
    }
  } catch {
    families.add('Segoe UI')
    families.add('Microsoft YaHei UI')
  }

  const all = [...families]
  const set = new Set(all)
  const filtered = all.filter((name) => {
    const match = name.match(/^(.*)\s+(Bold|Italic|Bold Italic|Regular|Light|Semibold|Medium)$/i)
    return !(match && set.has(match[1]))
  })

  cache = filtered.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
  return cache
}
