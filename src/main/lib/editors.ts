import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { shell } from 'electron'
import type { LaunchResult } from '@shared/types'
import { pathExists } from './fsx'

export type EditorKind = 'ps' | 'lr'

let cache: { photoshop: string | null; lightroom: string | null } | null = null
const preferred: Record<EditorKind, string | null> = { ps: null, lr: null }

export function setPreferredEditor(kind: EditorKind, exe: string | null): void {
  preferred[kind] = exe
}

function candidateRoots(): string[] {
  return [
    process.env['ProgramFiles'],
    process.env['ProgramFiles(x86)'],
    'C:\\Program Files',
    'C:\\Program Files (x86)',
    'D:\\Program Files',
    'D:\\Program Files (x86)',
    'D:\\Adobe',
    'C:\\Adobe'
  ].filter((root): root is string => Boolean(root))
}

async function scanFor(match: RegExp, exeName: string): Promise<string[]> {
  const found: string[] = []
  for (const root of candidateRoots()) {
    const adobe = path.join(root, 'Adobe')
    let entries
    try {
      entries = await fs.readdir(adobe, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || !match.test(entry.name)) continue
      const exe = path.join(adobe, entry.name, exeName)
      if (await pathExists(exe)) found.push(exe)
    }
  }
  return found
}

export async function detectEditors(force = false): Promise<{ photoshop: string | null; lightroom: string | null }> {
  if (!force && cache) return cache
  const [ps, lr] = await Promise.all([
    scanFor(/photoshop/i, 'Photoshop.exe'),
    scanFor(/lightroom/i, 'Lightroom.exe')
  ])
  ps.sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))
  lr.sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))
  cache = { photoshop: ps[0] ?? null, lightroom: lr[0] ?? null }
  return cache
}

export function invalidateEditorCache(): void {
  cache = null
}

export async function assertExecutable(exe: string, label: string): Promise<string> {
  if (!(await pathExists(exe))) throw new Error(`找不到 ${label}：${exe}`)
  return exe
}

export async function launchEditor(
  files: string[],
  editor: EditorKind,
  preferredExe?: string | null
): Promise<LaunchResult> {
  const targets = files.filter(Boolean)
  if (targets.length === 0) throw new Error('没有要打开的文件')
  for (const target of targets) {
    if (!(await pathExists(target))) throw new Error(`文件不存在：${target}`)
  }

  let exe: string | null = null
  if (preferredExe && (await pathExists(preferredExe))) exe = preferredExe
  else if (preferred[editor] && (await pathExists(preferred[editor]!))) exe = preferred[editor]
  else {
    const detected = await detectEditors()
    exe = editor === 'ps' ? detected.photoshop : detected.lightroom
  }

  if (exe) {
    const child = spawn(exe, targets, { detached: true, stdio: 'ignore' })
    child.unref()
    return { launched: true, exe, fallback: false, editor }
  }

  for (const target of targets) {
    await shell.openPath(target)
    await new Promise((resolve) => setTimeout(resolve, 240))
  }
  return { launched: true, exe: null, fallback: true, editor }
}
