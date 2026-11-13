import type { WorkstationApi } from '@shared/api'
import { createMockApi } from './mock'

export const isDesktop = typeof window !== 'undefined' && typeof window.workstation !== 'undefined'

export const api: WorkstationApi = window.workstation ?? createMockApi()

export const demoMode: string | null = isDesktop
  ? null
  : new URLSearchParams(window.location.search).get('demo')

export function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return '操作失败，请重试'
}

function schemeUrl(scheme: string, absPath: string): string {
  const normalized = absPath.replace(/\\/g, '/')
  const encoded = normalized
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `${scheme}://local${encoded.startsWith('/') ? '' : '/'}${encoded}`
}

export function thumbUrl(absPath: string): string {
  return schemeUrl('thumb', absPath)
}

export function previewUrl(absPath: string): string {
  return schemeUrl('preview', absPath)
}

export function mediaUrl(absPath: string): string {
  return schemeUrl('media', absPath)
}

export function imageSrc(
  file: { absPath: string; previewUrl?: string },
  kind: 'thumb' | 'preview' | 'full' = 'thumb'
): string {
  if (file.previewUrl) return file.previewUrl
  if (kind === 'preview') return previewUrl(file.absPath)
  if (kind === 'full') return mediaUrl(file.absPath)
  return thumbUrl(file.absPath)
}

export async function readImageBlob(target: string): Promise<Blob> {
  try {
    const response = await fetch(mediaUrl(target))
    if (response.ok) return await response.blob()
  } catch {
  }
  const buffer = await api.readFile(target)
  return new Blob([buffer])
}

export async function loadBitmap(target: string): Promise<ImageBitmap> {
  const blob = await readImageBlob(target)
  return createImageBitmap(blob, { imageOrientation: 'from-image' })
}

export async function loadBitmapOf(
  file: { absPath: string; previewUrl?: string }
): Promise<ImageBitmap | HTMLImageElement> {
  if (file.previewUrl) {
    const img = new Image()
    img.src = file.previewUrl
    await img.decode()
    return img
  }
  return loadBitmap(file.absPath)
}
