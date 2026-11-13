import { app } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { PluginHook, PluginInfo } from '@shared/types'

export const PLUGIN_HOOKS: PluginHook[] = [
  'workspace:opened',
  'import:after',
  'round:verified',
  'export:after',
  'edit:saved'
]

type HookHandler = (payload: unknown) => unknown
interface LoadedPlugin {
  info: PluginInfo
  handlers: Map<PluginHook, HookHandler[]>
}
let loaded: LoadedPlugin[] = []
let scanned = false
let scanning: Promise<PluginInfo[]> | null = null
export function pluginsDir(): string {
  return path.join(app.getPath('userData'), 'plugins')
}

export function listPlugins(): PluginInfo[] {
  return loaded.map((plugin) => plugin.info)
}

async function readManifest(dir: string): Promise<Partial<PluginInfo> & { main?: string } | null> {
  try {
    const content = await fs.readFile(path.join(dir, 'plugin.json'), 'utf8')
    const parsed = JSON.parse(content) as Record<string, unknown>
    if (typeof parsed.id !== 'string' || !parsed.id) return null
    return {
      id: parsed.id,
      name: typeof parsed.name === 'string' ? parsed.name : parsed.id,
      version: typeof parsed.version === 'string' ? parsed.version : '0.0.0',
      description: typeof parsed.description === 'string' ? parsed.description : undefined,
      main: typeof parsed.main === 'string' ? parsed.main : undefined,
      hooks: Array.isArray(parsed.hooks)
        ? (parsed.hooks.filter((hook) => PLUGIN_HOOKS.includes(hook as PluginHook)) as PluginHook[])
        : []
    }
  } catch {
    return null
  }
}
export async function loadPlugins(force = false): Promise<PluginInfo[]> {
  if (scanned && !force) return listPlugins()
  if (scanning) return scanning
  scanning = (async () => {
    const root = pluginsDir()
    await fs.mkdir(root, { recursive: true }).catch(() => undefined)
    let entries: string[] = []
    try {
      entries = await fs.readdir(root)
    } catch {
      entries = []
    }
    const next: LoadedPlugin[] = []
    for (const entry of entries) {
      const dir = path.join(root, entry)
      const stat = await fs.stat(dir).catch(() => null)
      if (!stat?.isDirectory()) continue
      const manifest = await readManifest(dir)
      if (!manifest) continue

      const info: PluginInfo = {
        id: manifest.id!,
        name: manifest.name ?? manifest.id!,
        version: manifest.version ?? '0.0.0',
        description: manifest.description,
        hooks: manifest.hooks ?? [],
        enabled: true,
        dir
      }
      const handlers = new Map<PluginHook, HookHandler[]>()
      if (manifest.main) {
        try {
          const target = path.join(dir, manifest.main)
          const namespace = (await import(pathToFileURL(target).href)) as Record<string, unknown>
          const factory = (namespace.default ?? namespace) as {
            activate?: (context: {
              id: string
              dir: string
              on: (hook: PluginHook, handler: HookHandler) => void
              log: (...args: unknown[]) => void
            }) => void
          }
          if (typeof factory.activate === 'function') {
            factory.activate({
              id: info.id,
              dir,
              log: (...args: unknown[]) => console.log(`[plugin:${info.id}]`, ...args),
              on: (hook, handler) => {
                if (!PLUGIN_HOOKS.includes(hook) || typeof handler !== 'function') return
                const list = handlers.get(hook) ?? []
                list.push(handler)
                handlers.set(hook, list)
                if (!info.hooks.includes(hook)) info.hooks.push(hook)
              }
            })
          }
        } catch (error) {
          info.error = error instanceof Error ? error.message : String(error)
        }
      }
      next.push({ info, handlers })
    }
    loaded = next
    scanned = true
    return listPlugins()
  })().finally(() => {
    scanning = null
  })
  return scanning
}
export async function runHook(hook: PluginHook, payload: unknown): Promise<void> {
  await Promise.all(
    loaded.flatMap((plugin) =>
      (plugin.handlers.get(hook) ?? []).map((handler) =>
        Promise.race([
          Promise.resolve()
            .then(() => handler(payload))
            .catch((error) => {
              console.warn(`[plugin:${plugin.info.id}] ${hook} 失败`, error)
            }),
          new Promise<void>((resolve) => setTimeout(resolve, 8000))
        ])
      )
    )
  )
}