import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { DriveInfo, DriveKind } from '@shared/types'

interface RawDrive {
  root: string
  type: number
  volume: string
  size: number
  free: number
  bus: string
  model: string
  media: string
}

const TTL = 120_000
const cache = new Map<string, { at: number; info: DriveInfo }>()
const inflight = new Map<string, Promise<RawDrive[]>>()

const PS_SCRIPT = [
  "$ErrorActionPreference='SilentlyContinue';",
  '$out=@();',
  'Get-CimInstance Win32_LogicalDisk | ForEach-Object {',
  '  $letter=$_.DeviceID; $type=[int]$_.DriveType; $bus=""; $model=""; $media="";',
  '  if ($type -ne 4) {',
  '    $part=Get-CimAssociatedInstance -InputObject $_ -Association Win32_LogicalDiskToPartition -ResultClassName Win32_DiskPartition | Select-Object -First 1;',
  '    if ($part) {',
  '      $disk=Get-CimAssociatedInstance -InputObject $part -Association Win32_DiskDriveToDiskPartition -ResultClassName Win32_DiskDrive | Select-Object -First 1;',
  '      if ($disk) { $bus=[string]$disk.InterfaceType; $model=[string]$disk.Model; $media=[string]$disk.MediaType }',
  '    }',
  '  }',
  '  $out += [pscustomobject]@{ root=$letter; type=$type; volume=[string]$_.VolumeName; size=[double]$_.Size; free=[double]$_.FreeSpace; bus=$bus; model=$model; media=$media }',
  '};',
  '$out | ConvertTo-Json -Compress -Depth 3'
].join('\n')

function queryDrives(): Promise<RawDrive[]> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PS_SCRIPT],
      { windowsHide: true, maxBuffer: 4 * 1024 * 1024, timeout: 12_000 },
      (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve([])
          return
        }
        try {
          const parsed = JSON.parse(stdout.trim()) as RawDrive | RawDrive[]
          resolve(Array.isArray(parsed) ? parsed : [parsed])
        } catch {
          resolve([])
        }
      }
    )
  })
}

function allDrives(): Promise<RawDrive[]> {
  const key = 'all'
  const hit = inflight.get(key)
  if (hit) return hit
  const task = queryDrives().finally(() => inflight.delete(key))
  inflight.set(key, task)
  return task
}

export function driveRootOf(target: string): string {
  const resolved = path.resolve(target)
  const parsed = path.parse(resolved)
  return parsed.root || resolved
}

function kindOf(type: number): DriveKind {
  if (type === 2) return 'removable'
  if (type === 3) return 'fixed'
  if (type === 4) return 'network'
  if (type === 5) return 'cdrom'
  return 'unknown'
}

async function usageOf(root: string): Promise<{ total: number; free: number }> {
  try {
    const stat = await fs.statfs(root)
    return { total: stat.blocks * stat.bsize, free: stat.bavail * stat.bsize }
  } catch {
    return { total: 0, free: 0 }
  }
}

const WARN_EXTERNAL = '该设备读取性能较弱，可能导致程序卡顿或显示出错，已降低每页缩略图数量'

export async function getDriveInfo(target: string): Promise<DriveInfo> {
  const root = driveRootOf(target)
  const letter = root.replace(/[\\/]+$/, '')
  const cached = cache.get(letter)
  if (cached && Date.now() - cached.at < TTL) return cached.info

  let raw: RawDrive | undefined
  if (process.platform === 'win32') {
    const list = await allDrives()
    raw = list.find((item) => item.root?.toUpperCase() === letter.toUpperCase())
  }

  const usage = await usageOf(root)
  const kind = raw ? kindOf(raw.type) : 'unknown'
  const bus = (raw?.bus ?? '').toUpperCase()
  const media = (raw?.media ?? '').toLowerCase()
  const external =
    kind === 'removable' ||
    kind === 'network' ||
    bus.includes('USB') ||
    media.includes('external') ||
    media.includes('removable')

  const info: DriveInfo = {
    root: letter,
    kind,
    bus: raw?.bus || (kind === 'network' ? 'NETWORK' : ''),
    model: raw?.model ?? '',
    volume: raw?.volume ?? '',
    total: raw?.size && raw.size > 0 ? raw.size : usage.total,
    free: usage.free,
    external,
    warning: external ? WARN_EXTERNAL : null,
    pageSize: external ? 10 : 20
  }

  cache.set(letter, { at: Date.now(), info })
  return info
}
