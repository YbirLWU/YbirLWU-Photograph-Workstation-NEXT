import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { SessionFile, WorkspacePaths } from '@shared/types'

export const META_DIR = '.ybirlwu'
const META_FILE = 'session.json'

export function workspacePaths(root: string): WorkspacePaths {
  const imgt = path.join(root, 'IMGT')
  const cho = path.join(imgt, 'CHO')
  return {
    root,
    raw: path.join(root, 'RAW'),
    jpg: path.join(root, 'JPG'),
    imgt,
    cho,
    choRaw: path.join(cho, 'RAW'),
    choJpg: path.join(cho, 'JPG'),
    edp: path.join(imgt, 'EDP'),
    end: path.join(imgt, 'END')
  }
}
export async function ensureStructure(root: string): Promise<WorkspacePaths> {
  const paths = workspacePaths(root)
  for (const dir of [paths.raw, paths.jpg, paths.choRaw, paths.choJpg, paths.edp, paths.end]) {
    await fs.mkdir(dir, { recursive: true })
  }
  await fs.mkdir(path.join(root, META_DIR), { recursive: true })
  return paths
}
export function emptySession(): SessionFile {
  const now = Date.now()
  return {
    version: 2,
    createdAt: now,
    updatedAt: now,
    imported: [],
    rounds: [],
    exports: [],
    editor: 'ps'
  }
}
function normalize(raw: Partial<SessionFile> | null): SessionFile {
  const base = emptySession()
  if (!raw || typeof raw !== 'object') return base
  return {
    version: 2,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : base.createdAt,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : base.updatedAt,
    source: raw.source,
    imported: Array.isArray(raw.imported) ? raw.imported : [],
    rounds: Array.isArray(raw.rounds) ? raw.rounds : [],
    exports: Array.isArray(raw.exports) ? raw.exports : [],
    photoshopPath: typeof raw.photoshopPath === 'string' ? raw.photoshopPath : undefined,
    lightroomPath: typeof raw.lightroomPath === 'string' ? raw.lightroomPath : undefined,
    editor: raw.editor === 'lr' ? 'lr' : 'ps'
  }
}
export async function readSession(root: string): Promise<SessionFile> {
  const file = path.join(root, META_DIR, META_FILE)
  try {
    const content = await fs.readFile(file, 'utf8')
    return normalize(JSON.parse(content) as Partial<SessionFile>)
  } catch {
    return emptySession()
  }
}
export async function writeSession(root: string, session: SessionFile): Promise<SessionFile> {
  const dir = path.join(root, META_DIR)
  await fs.mkdir(dir, { recursive: true })
  const next: SessionFile = { ...session, updatedAt: Date.now() }
  const tmp = path.join(dir, `${META_FILE}.tmp`)
  await fs.writeFile(tmp, JSON.stringify(next, null, 2), 'utf8')
  await fs.rename(tmp, path.join(dir, META_FILE))
  return next
}