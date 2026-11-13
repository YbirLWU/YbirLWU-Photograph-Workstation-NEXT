import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Crop,
  Loader2,
  RotateCcw,
  RotateCw,
  Save,
  SlidersHorizontal,
  Sparkles,
  X
} from 'lucide-react'
import type { DevelopParams, EditDoc, HistogramData, StageFile } from '@shared/types'
import {
  DEFAULT_DEVELOP,
  DEVELOP_RANGE,
  describeEdits,
  hasEdits,
  normalizeDevelop,
  type DevelopKey
} from '@shared/develop'
import { api, errorText, loadBitmapOf } from '@/lib/bridge'
import { renderDevelop } from '@/lib/develop'
import { formatBytes } from '@/lib/format'
import { CopyButton } from './CopyButton'
import { Histogram } from './Histogram'
import { Meter, Modal } from './ui'

interface BuiltInEditorProps {
  root: string
  files: StageFile[]
  startName: string
  onClose: () => void
  onSaved: (name: string) => void
  onError: (message: string) => void
}

const GROUPS: Array<{ id: string; title: string; keys: DevelopKey[] }> = [
  { id: 'light', title: '光源', keys: ['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks'] },
  { id: 'color', title: '颜色', keys: ['temperature', 'tint', 'vibrance', 'saturation'] },
  { id: 'detail', title: '细节', keys: ['clarity', 'sharpness'] },
  { id: 'effect', title: '效果', keys: ['vignette'] }
]

export function BuiltInEditor({ root, files, startName, onClose, onSaved, onError }: BuiltInEditorProps) {
  const [index, setIndex] = useState(() => Math.max(0, files.findIndex((file) => file.name === startName)))
  const file = files[index]
  const fileKey = file ? `${file.name}|${file.size}|${file.mtimeMs}` : ''

  const [params, setParams] = useState<DevelopParams>(DEFAULT_DEVELOP)
  const [doc, setDoc] = useState<EditDoc | null>(null)
  const [image, setImage] = useState<ImageBitmap | HTMLImageElement | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [histogram, setHistogram] = useState<HistogramData | null>(null)
  const [format, setFormat] = useState<'jpeg' | 'png'>('jpeg')
  const [quality, setQuality] = useState(0.94)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveProgress, setSaveProgress] = useState(0)
  const [saveStage, setSaveStage] = useState('')

  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    document.body.classList.add('overlay-open')
    return () => document.body.classList.remove('overlay-open')
  }, [])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const jobRef = useRef(0)
  const bitmapRef = useRef<ImageBitmap | HTMLImageElement | null>(null)

  const change = useCallback((next: Partial<DevelopParams>) => {
    setParams((prev) => normalizeDevelop({ ...prev, ...next }))
  }, [])

  useEffect(() => {
    if (!file) return
    let cancelled = false
    setImage(null)
    setHistogram(null)
    setLoadingDoc(true)

    void (async () => {
      try {
        const bitmap = await loadBitmapOf(file)
        if (cancelled) {
          releaseBitmap(bitmap)
          return
        }
        releaseBitmap(bitmapRef.current)
        bitmapRef.current = bitmap
        setImage(bitmap)
      } catch {
        if (!cancelled) {
          setImage(null)
          onErrorRef.current(`无法预览 ${file.name}`)
        }
      }
    })()

    void api.edit
      .read(root, file.name)
      .then((record) => {
        if (cancelled) return
        setDoc(record)
        setParams(record ? normalizeDevelop(record.params) : { ...DEFAULT_DEVELOP })
      })
      .catch(() => {
        if (!cancelled) setParams({ ...DEFAULT_DEVELOP })
      })
      .finally(() => {
        if (!cancelled) setLoadingDoc(false)
      })

    return () => {
      cancelled = true
    }
  }, [fileKey, root])

  useEffect(
    () => () => {
      releaseBitmap(bitmapRef.current)
      bitmapRef.current = null
    },
    []
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!image || !canvas) return
    const job = ++jobRef.current
    cancelAnimationFrame(rafRef.current)
    setRendering(true)
    rafRef.current = requestAnimationFrame(() => {
      void renderDevelop(canvas, image, params, { maxEdge: 1500 })
        .then(() => {
          if (job !== jobRef.current) return
          setHistogram(readHistogram(canvas))
        })
        .catch((error) => {
          if (job === jobRef.current) onErrorRef.current(errorText(error))
        })
        .finally(() => {
          if (job === jobRef.current) setRendering(false)
        })
    })
    return () => cancelAnimationFrame(rafRef.current)
  }, [image, params])

  const modified = useMemo(() => hasEdits(params), [params])
  const summary = useMemo(() => describeEdits(params), [params])

  const step = useCallback(
    (delta: number) => {
      const next = index + delta
      if (next >= 0 && next < files.length) setIndex(next)
    },
    [index, files.length]
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !saving) onClose()
      else if (event.key === 'ArrowLeft') step(-1)
      else if (event.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, step, saving])

  const save = async (): Promise<void> => {
    if (!file) return
    setSaving(true)
    setSaveProgress(0)
    setSaveStage('读取原图…')
    try {
      const bitmap = await loadBitmapOf(file)
      setSaveStage('渲染全尺寸画布…')
      const canvas = document.createElement('canvas')
      const size = await renderDevelop(canvas, bitmap, params, {
        onProgress: (ratio) => setSaveProgress(ratio * 0.8)
      })
      releaseBitmap(bitmap)
      setSaveStage('正在合成并写入精修成片目录…')
      setSaveProgress(0.86)
      const out = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, format === 'png' ? 'image/png' : 'image/jpeg', quality)
      )
      canvas.width = 0
      canvas.height = 0
      if (!out) throw new Error('编码失败，请降低分辨率后重试')
      const buffer = await out.arrayBuffer()
      const result = await api.edit.save({
        root,
        sourceName: file.name,
        format,
        quality,
        width: size.width,
        height: size.height,
        params,
        data: buffer
      })
      setSaveProgress(1)
      setSaveStage('完成')
      setDoc({ version: 1, source: file.name, updatedAt: Date.now(), params, output: result.name })
      onSaved(result.name)
    } catch (error) {
      onErrorRef.current(errorText(error))
    } finally {
      setSaving(false)
      setSaveOpen(false)
    }
  }

  if (!file) return null

  const copyText = [`${file.name}`, summary, `内置调色参数（可粘贴回 XML）`].join('\n')

  return createPortal(
    <div className="develop">
      <header className="develop__bar">
        <div className="develop__title">
          <b>{file.name}</b>
          <span className="tag tag--warn" title="测试版本，不推荐用于正式成片；正式修图建议使用第三方编辑器">
            测试版
          </span>
          <span className="muted">
            {index + 1} / {files.length}
          </span>
          {doc ? (
            <span className="tag tag--teal" title={`上次保存 ${new Date(doc.updatedAt).toLocaleString()}`}>
              已载入 XML
            </span>
          ) : (
            <span className="tag">基于原图</span>
          )}
          {modified && <span className="tag tag--warn">未保存</span>}
        </div>
        <div className="develop__bar-actions">
          <button className="icon-btn" type="button" onClick={() => step(-1)} disabled={index === 0} title="上一张 ←">
            <ChevronLeft size={15} />
          </button>
          <button
            className="icon-btn"
            type="button"
            onClick={() => step(1)}
            disabled={index === files.length - 1}
            title="下一张 →"
          >
            <ChevronRight size={15} />
          </button>
          <span className="develop__divider" />
          <CopyButton
            text={copyText}
            label="复制参数"
            className="btn btn--sm btn--ghost"
            onError={(message) => onErrorRef.current(message)}
          />
          <button
            className="btn btn--sm btn--ghost"
            type="button"
            onClick={() => setParams({ ...DEFAULT_DEVELOP })}
            disabled={!modified}
          >
            <RotateCcw size={12} strokeWidth={2} />
            全部重置
          </button>
          <button className="btn btn--primary btn--sm" type="button" onClick={() => setSaveOpen(true)}>
            <Save size={13} strokeWidth={2} />
            保存到精修成片
          </button>
          <button className="icon-btn icon-btn--close" type="button" onClick={onClose} title="关闭 (Esc)">
            <X size={15} />
          </button>
        </div>
      </header>

      <div className="develop__body">
        <div className="develop__stage">
          <div className="develop__canvas-wrap">
            {!image && (
              <div className="develop__loading">
                <Loader2 size={18} className="spin" />
                正在载入预览…
              </div>
            )}
            <canvas ref={canvasRef} className="develop__canvas" />
          </div>
          <footer className="develop__status">
            <span>
              {image ? `${image.width} × ${image.height}` : '—'} · {formatBytes(file.size)}
            </span>
            <span className="muted">{summary}</span>
            <span className="develop__status-right">
              {rendering ? <Loader2 size={11} className="spin" /> : <Check size={11} strokeWidth={2.6} />}
              {rendering ? '渲染中' : '预览已同步'}
            </span>
          </footer>
        </div>

        <aside className="develop__panel">
          <div className="develop__panel-head">
            <SlidersHorizontal size={12} strokeWidth={2} />
            调色参数
            <span className="muted">双击滑杆归零</span>
          </div>

          <div className="develop__histogram">
            <Histogram data={histogram} height={72} />
          </div>

          {loadingDoc && (
            <div className="develop__hint">
              <Loader2 size={11} className="spin" />
              正在读取编辑记录…
            </div>
          )}

          <div className="develop__groups">
            {GROUPS.map((group) => (
              <section key={group.id} className="develop__group">
                <div className="develop__group-title">{group.title}</div>
                {group.keys.map((key) => {
                  const range = DEVELOP_RANGE[key]
                  const value = params[key]
                  return (
                    <label key={key} className="drow">
                      <span className="drow__label">{range.label}</span>
                      <input
                        className="drow__range"
                        type="range"
                        min={range.min}
                        max={range.max}
                        step={range.step}
                        value={value}
                        onChange={(event) => change({ [key]: Number(event.target.value) } as Partial<DevelopParams>)}
                        onDoubleClick={() => change({ [key]: 0 } as Partial<DevelopParams>)}
                      />
                      <span className={`drow__value${value !== 0 ? ' is-on' : ''}`}>
                        {key === 'exposure' ? value.toFixed(2) : Math.round(value)}
                      </span>
                    </label>
                  )
                })}
              </section>
            ))}

            <section className="develop__group">
              <div className="develop__group-title">几何</div>
              <div className="row">
                <button
                  className="btn btn--sm btn--ghost"
                  type="button"
                  onClick={() => change({ rotate: ((params.rotate + 270) % 360) as DevelopParams['rotate'] })}
                >
                  <RotateCcw size={12} strokeWidth={2} />
                  逆时针 90°
                </button>
                <button
                  className="btn btn--sm btn--ghost"
                  type="button"
                  onClick={() => change({ rotate: ((params.rotate + 90) % 360) as DevelopParams['rotate'] })}
                >
                  <RotateCw size={12} strokeWidth={2} />
                  顺时针 90°
                </button>
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <button
                  className={`btn btn--sm${params.flipH ? ' btn--soft' : ' btn--ghost'}`}
                  type="button"
                  onClick={() => change({ flipH: !params.flipH })}
                >
                  <ArrowLeftRight size={12} strokeWidth={2} />
                  水平翻转
                </button>
                <span className="muted" style={{ fontSize: 10.5 }}>
                  {params.rotate}°{params.flipH ? ' · 翻转' : ''}
                </span>
              </div>
            </section>

            <section className="develop__group">
              <div className="develop__group-title">输出</div>
              <div className="seg">
                <button
                  type="button"
                  className={`seg__item${format === 'jpeg' ? ' is-active' : ''}`}
                  onClick={() => setFormat('jpeg')}
                >
                  JPG
                </button>
                <button
                  type="button"
                  className={`seg__item${format === 'png' ? ' is-active' : ''}`}
                  onClick={() => setFormat('png')}
                >
                  PNG
                </button>
              </div>
              {format === 'jpeg' && (
                <label className="field" style={{ marginTop: 8 }}>
                  <span className="field__label">质量 {Math.round(quality * 100)}%</span>
                  <input
                    type="range"
                    min={0.6}
                    max={1}
                    step={0.01}
                    value={quality}
                    onChange={(event) => setQuality(Number(event.target.value))}
                  />
                </label>
              )}
              <p className="field__hint">
                保存后成品写入<code>精修成片</code>目录，同时生成同名参数记录，下次打开自动载入。
              </p>
            </section>
          </div>
        </aside>
      </div>

      <Modal
        open={saveOpen || saving}
        title={saving ? '正在导出' : '保存到精修成片'}
        desc={saving ? '按原图像素合成，大图需要几秒钟。' : '成品会覆盖精修成片目录里同名的旧文件，参数记录同步更新。'}
        width={440}
        closable={!saving}
        onClose={() => setSaveOpen(false)}
        footer={
          saving ? undefined : (
            <>
              <button className="btn btn--sm" type="button" onClick={() => setSaveOpen(false)}>
                取消
              </button>
              <button className="btn btn--primary btn--sm" type="button" onClick={() => void save()}>
                <Sparkles size={13} strokeWidth={2} />
                开始导出
              </button>
            </>
          )
        }
      >
        {saving ? (
          <div className="import-progress">
            <div className="import-progress__row">
              <span>{saveStage}</span>
              <b>{Math.round(saveProgress * 100)}%</b>
            </div>
            <Meter percent={saveProgress * 100} />
            <div className="import-progress__current">
              {file.name} → {file.stem}
              {format === 'png' ? '.png' : '.jpg'}
            </div>
          </div>
        ) : (
          <>
            <div className="kv">
              <span>来源</span>
              <b>{file.name}</b>
            </div>
            <div className="kv">
              <span>输出</span>
              <b>
                {file.stem}
                {format === 'png' ? '.png' : '.jpg'}
              </b>
            </div>
            <div className="kv">
              <span>像素</span>
              <b>
                {image ? `${image.width} × ${image.height}` : '—'}
                {params.rotate === 90 || params.rotate === 270 ? '（旋转后互换）' : ''}
              </b>
            </div>
            <div className="kv">
              <span>参数</span>
              <b className="kv__ellipsis" title={summary}>
                {summary}
              </b>
            </div>
            <div className="develop__notice">
              <Crop size={12} strokeWidth={2} />
              画布按原图像素输出，不做任何缩放；导出后可在水印阶段继续使用。
            </div>
          </>
        )}
      </Modal>
    </div>,
    document.body
  )
}

function releaseBitmap(bitmap: ImageBitmap | HTMLImageElement | null): void {
  if (bitmap && 'close' in bitmap) bitmap.close()
}

function readHistogram(canvas: HTMLCanvasElement): HistogramData | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx || canvas.width === 0 || canvas.height === 0) return null
  try {
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const r = new Array<number>(256).fill(0)
    const g = new Array<number>(256).fill(0)
    const b = new Array<number>(256).fill(0)
    const l = new Array<number>(256).fill(0)
    const pixels = canvas.width * canvas.height
    const stride = Math.max(1, Math.floor(pixels / 220_000)) * 4
    let samples = 0
    for (let offset = 0; offset < data.length; offset += stride) {
      const red = data[offset]
      const green = data[offset + 1]
      const blue = data[offset + 2]
      r[red] += 1
      g[green] += 1
      b[blue] += 1
      l[Math.min(255, Math.round(0.2126 * red + 0.7152 * green + 0.0722 * blue))] += 1
      samples += 1
    }
    return samples > 0 ? { r, g, b, l, samples } : null
  } catch {
    return null
  }
}
