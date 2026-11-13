import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react'
import type { ExifInfo, HistogramData, ImageMeta } from '@shared/types'
import { api, imageSrc } from '@/lib/bridge'
import { formatBytes } from '@/lib/format'
import { Histogram } from './Histogram'
import { CopyButton } from './CopyButton'

export interface ViewerItem {
  id: string
  base: string
  preview: { name: string; absPath: string; ext: string; previewUrl?: string }
  metaPath: string
  rawName: string
  rawSize: number
  jpgName: string
  jpgSize: number
  width?: number
  height?: number
}

interface ViewerProps {
  items: ViewerItem[]
  index: number
  picked: Set<string>
  onIndex: (index: number) => void
  onTogglePick: (id: string) => void
  onClose: () => void
  onError: (message: string) => void
  onToast: (message: string, tone?: 'info' | 'success' | 'error' | 'warn') => void
}

export function Viewer({ items, index, picked, onIndex, onTogglePick, onClose, onError, onToast }: ViewerProps) {
  const item = items[index]
  const [exif, setExif] = useState<ExifInfo | null>(null)
  const [meta, setMeta] = useState<ImageMeta | null>(null)
  const [histogram, setHistogram] = useState<HistogramData | null>(null)
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [loadingImage, setLoadingImage] = useState(true)
  const [failed, setFailed] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  useEffect(() => {
    document.body.classList.add('overlay-open')
    return () => document.body.classList.remove('overlay-open')
  }, [])
  const exifCache = useRef(new Map<string, ExifInfo | null>())
  const metaCache = useRef(new Map<string, ImageMeta | null>())
  const histoCache = useRef(new Map<string, HistogramData | null>())
  useEffect(() => {
    setLoadingImage(true)
    setFailed(false)
  }, [index])
  useEffect(() => {
    if (!item) return
    let cancelled = false
    const cachedHisto = histoCache.current.get(item.preview.absPath)
    if (cachedHisto !== undefined) setHistogram(cachedHisto)
    else {
      setHistogram(null)
      void api
        .histogram(item.preview.absPath)
        .then((data) => {
          histoCache.current.set(item.preview.absPath, data)
          if (!cancelled) setHistogram(data)
        })
        .catch(() => {
          if (!cancelled) setHistogram(null)
        })
    }
    const cachedMeta = metaCache.current.get(item.preview.absPath)
    if (cachedMeta !== undefined) {
      setMeta(cachedMeta)
    } else if (item.width && item.height) {
      setMeta({ width: item.width, height: item.height, size: 0, mtimeMs: 0 })
    } else {
      setMeta(null)
      api
        .imageMeta(item.preview.absPath)
        .then((info) => {
          metaCache.current.set(item.preview.absPath, info)
          if (!cancelled) setMeta(info)
        })
        .catch(() => {
          if (!cancelled) setMeta(null)
        })
    }
    const cachedExif = exifCache.current.get(item.metaPath)
    if (cachedExif !== undefined) {
      setExif(cachedExif)
      return
    }
    setLoadingMeta(true)
    api
      .exif(item.metaPath)
      .then((info) => {
        exifCache.current.set(item.metaPath, info)
        if (!cancelled) setExif(info)
      })
      .catch(() => {
        exifCache.current.set(item.metaPath, null)
        if (!cancelled) setExif(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false)
      })
    return () => {
      cancelled = true
    }
  }, [item])
  useEffect(() => {
    for (const position of [index - 2, index - 1, index + 1, index + 2]) {
      const target = items[position]
      if (!target) continue
      const image = new Image()
      image.src = imageSrc(target.preview, 'preview')
    }
  }, [index, items])
  const step = (delta: number): void => {
    const next = index + delta
    if (next >= 0 && next < items.length) onIndex(next)
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft') step(-1)
      else if (event.key === 'ArrowRight') step(1)
      else if (event.key === 'p' || event.key === 'P') onTogglePick(item.id)
      else if (event.key === 'f' || event.key === 'F') setFullscreen((value) => !value)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, items.length, item.id, onClose, onTogglePick])
  const pickedNow = picked.has(item.id)
   
  const resolution = useMemo(() => {
    if (meta?.width && meta?.height) return `${meta.width} × ${meta.height}`
    if (item.width && item.height) return `${item.width} × ${item.height}`
    if (exif?.width && exif?.height) return `${exif.width} × ${exif.height}`
    return '—'
  }, [meta, exif, item.width, item.height])
  const megapixels = useMemo(() => {
    const width = meta?.width ?? item.width ?? exif?.width
    const height = meta?.height ?? item.height ?? exif?.height
    if (!width || !height) return null
    return (width * height) / 1_000_000
  }, [meta, exif, item.width, item.height])
  const exifClipboard = (): string => {
    const lines = [
      item.base,
      exif?.model ? `机身：${[exif.make, exif.model].filter(Boolean).join(' ')}` : '',
      exif?.lens ? `镜头：${exif.lens}` : '',
      exif?.shutter ? `快门：${exif.shutter}` : '',
      exif?.aperture ? `光圈：${exif.aperture}` : '',
      exif?.iso ? `ISO：${exif.iso}` : '',
      exif?.focalLength ? `焦距：${exif.focalLength}` : '',
      resolution !== '—' ? `像素：${resolution}` : ''
    ].filter(Boolean)
    return lines.join('\n')
  }
  return createPortal(
    <div className={`viewer${fullscreen ? ' viewer--full' : ''}`}>
      <div className="viewer__stage">
        <header className="viewer__head">
          <div className="viewer__title">
            <b>{item.base}</b>
            <span className="viewer__count">
              {index + 1} / {items.length}
            </span>
            {pickedNow && <span className="tag tag--ok">已选定</span>}
          </div>
          <div className="viewer__head-actions">
            <CopyButton
              text={() => exifClipboard()}
              label="复制参数"
              className="btn btn--sm btn--ghost"
              onCopied={(message) => onToast(`${message}：机身 / 快门 / 光圈 / ISO / 像素`, 'success')}
              onError={(message) => onError(message)}
            />
            <button
              className="icon-btn"
              type="button"
              title={fullscreen ? '退出全屏 (F)' : '全屏查看 (F)'}
              onClick={() => setFullscreen((value) => !value)}
            >
              {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button className="icon-btn icon-btn--close" type="button" title="关闭 (Esc)" onClick={onClose}>
              <X size={15} />
            </button>
          </div>
        </header>
        <div className="viewer__surface">
          {loadingImage && (
            <div className="viewer__loading">
              <Loader2 size={20} className="spin" />
              正在解码预览…
            </div>
          )}
          {failed ? (
            <div className="viewer__failed">
              无法解码这张预览图，文件可能已移动或损坏。
              <span>{item.preview.absPath}</span>
            </div>
          ) : (
            <img
              key={item.id}
              className="viewer__image"
              src={imageSrc(item.preview, 'preview')}
              alt={item.base}
              draggable={false}
              onLoad={() => setLoadingImage(false)}
              onError={() => {
                setLoadingImage(false)
                setFailed(true)
              }}
            />
          )}
        </div>
        <footer className="viewer__toolbar">
          <div className="viewer__nav">
            <button className="icon-btn" type="button" onClick={() => step(-1)} disabled={index === 0} title="上一张 ←">
              <ChevronLeft size={16} />
            </button>
            <button
              className="icon-btn"
              type="button"
              onClick={() => step(1)}
              disabled={index === items.length - 1}
              title="下一张 →"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="viewer__hint">
            <kbd>←</kbd>
            <kbd>→</kbd>
            翻页 · <kbd>P</kbd> 选定 · <kbd>F</kbd> 全屏 · <kbd>Esc</kbd> 关闭
          </div>
          <button
            className={`btn btn--sm${pickedNow ? ' btn--soft' : ' btn--primary'}`}
            type="button"
            onClick={() => onTogglePick(item.id)}
          >
            <Check size={13} strokeWidth={2.6} />
            {pickedNow ? '取消选定 (P)' : '选定这张 (P)'}
          </button>
        </footer>
      </div>
      <aside className="viewer__panel">
        <div className="panel-block">
          <div className="panel-block__title">
            直方图
            <span className="panel-block__meta">RGB + 亮度</span>
          </div>
          <Histogram data={histogram} />
        </div>
        <div className="panel-block">
          <div className="panel-block__title">
            拍摄参数
            {loadingMeta && <Loader2 size={12} className="spin" />}
          </div>
          <div className="exif-grid">
            <Cell label="ISO" value={exif?.iso ? `${exif.iso}` : '—'} accent />
            <Cell label="快门" value={exif?.shutter ?? '—'} accent />
            <Cell label="光圈" value={exif?.aperture ?? '—'} accent />
            <Cell label="焦距" value={exif?.focalLength ?? '—'} accent />
          </div>
          <div className="kv">
            <span>机身</span>
            <b>{[exif?.make, exif?.model].filter(Boolean).join(' ') || '—'}</b>
          </div>
          <div className="kv">
            <span>镜头</span>
            <b className="kv__ellipsis" title={exif?.lens ?? ''}>
              {exif?.lens ?? '—'}
            </b>
          </div>
          <div className="kv">
            <span>拍摄时间</span>
            <b>{exif?.dateTaken ?? '—'}</b>
          </div>
        </div>
        <div className="panel-block">
          <div className="panel-block__title">文件</div>
          <div className="kv">
            <span>原图像素</span>
            <b>{resolution}</b>
          </div>
          {megapixels && (
            <div className="kv">
              <span>总像素</span>
              <b>{megapixels.toFixed(1)} MP</b>
            </div>
          )}
          <div className="kv">
            <span>RAW</span>
            <b title={item.rawName}>{formatBytes(item.rawSize)}</b>
          </div>
          <div className="kv">
            <span>JPG</span>
            <b title={item.jpgName}>{formatBytes(item.jpgSize)}</b>
          </div>
          <div className="kv">
            <span>基名</span>
            <b className="kv__ellipsis" title={item.rawName}>
              {item.rawName}
            </b>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  )
}
function Cell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`exif-cell${accent ? ' exif-cell--accent' : ''}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}