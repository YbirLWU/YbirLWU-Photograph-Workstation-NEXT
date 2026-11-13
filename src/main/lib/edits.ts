import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { EditDoc, SaveEditRequest, SaveEditResult } from '@shared/types'
import { DEFAULT_DEVELOP, normalizeDevelop } from '@shared/develop'
import { ensureStructure, readSession, workspacePaths, writeSession } from './store'
import { splitName } from './names'
import { pathExists } from './fsx'
import { buildWorkspace } from './workspace'

export function editXmlName(sourceName: string): string {
  return `${splitName(sourceName).stem}.xml`
}

function xmlPath(root: string, sourceName: string): string {
  return path.join(workspacePaths(root).edp, editXmlName(sourceName))
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function serializeEdit(doc: EditDoc): string {
  const params = normalizeDevelop(doc.params)
  const attrs = Object.entries(params)
    .map(([key, value]) => `${key}="${typeof value === 'boolean' ? String(value) : Number(value.toFixed(4))}"`)
    .join(' ')
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<ybirlwu-edit version="1" source="${escapeXml(doc.source)}" updated="${new Date(doc.updatedAt).toISOString()}"${
      doc.output ? ` output="${escapeXml(doc.output)}"` : ''
    }>`,
    `  <develop ${attrs} />`,
    '</ybirlwu-edit>',
    ''
  ].join('\n')
}

function readAttr(source: string, pattern: RegExp): string | undefined {
  const match = source.match(pattern)
  return match ? match[1] : undefined
}

export function parseEdit(content: string): EditDoc | null {
  if (!content.includes('<ybirlwu-edit')) return null
  const source = readAttr(content, /source="([^"]*)"/) ?? ''
  const output = readAttr(content, /output="([^"]*)"/)
  const updatedRaw = readAttr(content, /updated="([^"]*)"/)
  const updatedAt = updatedRaw ? Date.parse(updatedRaw) : Date.now()

  const developTag = content.match(/<develop\b([^>]*)\/?>/i)
  const params = { ...DEFAULT_DEVELOP }
  if (developTag) {
    const body = developTag[1]
    for (const [key, value] of Object.entries(matchAttrs(body))) {
      if (key === 'rotate') {
        const rotate = Number(value)
        params.rotate = rotate === 90 || rotate === 180 || rotate === 270 ? rotate : 0
      } else if (key === 'flipH') {
        params.flipH = value === 'true' || value === '1'
      } else if (key in params) {
        ;(params as unknown as Record<string, number>)[key] = Number(value)
      }
    }
  }

  return {
    version: 1,
    source,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
    params: normalizeDevelop(params),
    output
  }
}

function matchAttrs(body: string): Record<string, string> {
  const result: Record<string, string> = {}
  const regex = /([a-zA-Z][\w-]*)="([^"]*)"/g
  let match = regex.exec(body)
  while (match) {
    result[match[1]] = match[2]
    match = regex.exec(body)
  }
  return result
}

export async function readEdit(root: string, sourceName: string): Promise<EditDoc | null> {
  if (!root || !sourceName) return null
  const target = xmlPath(root, sourceName)
  if (!(await pathExists(target))) return null
  try {
    const content = await fs.readFile(target, 'utf8')
    return parseEdit(content)
  } catch {
    return null
  }
}

export async function saveEdit(request: SaveEditRequest): Promise<SaveEditResult> {
  if (!request.root) throw new Error('请先指定工作区')
  if (!request.sourceName) throw new Error('缺少来源文件名')

  const bytes =
    request.data instanceof ArrayBuffer
      ? Buffer.from(new Uint8Array(request.data))
      : Buffer.from(request.data as unknown as Uint8Array)
  if (bytes.length < 256) throw new Error('渲染结果为空，保存失败')

  const paths = await ensureStructure(request.root)
  const { stem } = splitName(request.sourceName)
  const ext = request.format === 'png' ? '.png' : '.jpg'
  const outputName = `${stem}${ext}`

  for (const other of ['.jpg', '.jpeg', '.png']) {
    if (other === ext) continue
    const stale = path.join(paths.edp, `${stem}${other}`)
    if (await pathExists(stale)) await fs.unlink(stale).catch(() => undefined)
  }

  const target = path.join(paths.edp, outputName)
  const tmp = `${target}.${process.pid}.tmp`
  await fs.writeFile(tmp, bytes)
  await fs.rename(tmp, target).catch(async () => {
    await fs.writeFile(target, bytes)
    await fs.unlink(tmp).catch(() => undefined)
  })

  const xmlName = editXmlName(request.sourceName)
  const doc: EditDoc = {
    version: 1,
    source: request.sourceName,
    updatedAt: Date.now(),
    params: normalizeDevelop(request.params),
    output: outputName
  }
  await fs.writeFile(path.join(paths.edp, xmlName), serializeEdit(doc), 'utf8')

  const session = await readSession(request.root)
  session.exports = [
    {
      source: request.sourceName,
      output: outputName,
      at: Date.now(),
      format: request.format,
      width: request.width,
      height: request.height,
      padTop: 0,
      padBottom: 0
    },
    ...session.exports
  ].slice(0, 800)
  await writeSession(request.root, session)

  return { name: outputName, xmlName, path: target, workspace: await buildWorkspace(request.root) }
}

export async function clearEdit(root: string, sourceName: string): Promise<void> {
  const target = xmlPath(root, sourceName)
  await fs.unlink(target).catch(() => undefined)
}
