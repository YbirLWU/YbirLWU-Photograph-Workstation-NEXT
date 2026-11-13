import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronDown,
  Download,
  FolderOpen,
  Image as ImageIcon,
  Italic,
  Info,
  Layers,
  Loader2,
  MousePointer2,
  RefreshCw,
  Type
} from 'lucide-react'
import type { StageFile } from '@shared/types'
import { api, errorText, imageSrc, loadBitmapOf } from '@/lib/bridge'
import { clamp, drawFrame, layoutOf, textBox, type WatermarkOptions } from '@/lib/frame'
import { formatBytes } from '@/lib/format'
import { joinPath } from '@/lib/path'
import { EmptyState, Meter, Modal, Segmented, StatusPill } from '@/components/ui'
import { StageNext } from '@/components/StageNext'
import { CopyButton } from '@/components/CopyButton'
import { PageHeader } from '@/components/PageHeader'
import { MODULE_META } from '../meta'
import type { SharedState } from '../types'

const MAX_BATCH = 10
const DEF = MODULE_META[3]
const BAR_PRESETS = ['#0c0e12', '#15181e', '#ffffff', '#f2f0ea', '#c9a227', '#1f2937']
const TEXT_PRESETS = ['#ffffff', '#e8eaf0', '#0c0e12', '#c9a227', '#9aa2b1']

const DEFAULT_OPTIONS: WatermarkOptions = {
  padTop: 0,
  padBottom: 0,
  barColor: '#0c0e12',
  text: '© 2026 YbirLWU · All Rights Reserved',
  fontFamily: 'Microsoft YaHei UI',
  fontSize: 28,
  color: '#e8eaf0',
  bold: false,
  italic: false,
  align: 'left',
  opacity: 1,
  x: 0.04,
  y: 0.86
}

export function FrameModule({ shared }: { shared: SharedState }) {
  const workspace = shared.workspace
  const root = workspace?.root ?? ''

  const [edp, setEdp] = useState<StageFile[]>([])
  const [end, setEnd] = useState<StageFile[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [active, setActive] = useState<StageFile | null>(null)
  const [options, setOptions] = useState<WatermarkOptions>(DEFAULT_OPTIONS)
  const [fonts, setFonts] = useState<string[]>(['Microsoft YaHei UI', 'Segoe UI', 'Arial'])
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [format, setFormat] = useState<'jpeg' | 'png'>('jpeg')
  const [quality, setQuality] = useState(0.94)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number; current: string } | null>(null)
  const [exportDone, setExportDone] = useState<{ count: number; names: string[] } | null>(null)
  const [fontQuery, setFontQuery] = useState('')
  const [fontOpen, setFontOpen] = useState(false)
  const [showPanel, setShowPanel] = useState<'canvas' | 'text'>('canvas')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)

  const load = useCallback(async (): Promise<void> => {
    if (!root) {
      setEdp([])
      setEnd([])
      return
    }
    setLoading(true)
    try {
      const [edpList, endList] = await Promise.all([
        api.workspace.listStage(root, 'edp'),
        api.workspace.listStage(root, 'end')
      ])
      setEdp(edpList)
      setEnd(endList)
      setActive((prev) => {
        if (prev && edpList.some((file) => file.absPath === prev.absPath)) return prev
        return edpList[0] ?? null
      })
      setSelected((prev) => prev.filter((path) => edpList.some((file) => file.absPath === path)))
    } catch (error) {
      shared.toast(errorText(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [root, shared.toast])

  useEffect(() => {
    void load()
  }, [load, workspace?.session.updatedAt])

  useEffect(() => {
    api
      .fonts()
      .then((list) => {
        if (list.length > 0) {
          setFonts(list)
          setOptions((prev) => (list.includes(prev.fontFamily) ? prev : { ...prev, fontFamily: list[0] }))
        }
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!active) {
      setImage(null)
      return
    }
    const img = new Image()
    img.onload = () => {
      setImage(img)
      setOptions((prev) => {
        if (prev.padTop > 0 || prev.padBottom > 0) return prev
        const pad = Math.max(20, Math.round(img.naturalHeight * 0.055))
        const size = Math.max(16, Math.round(img.naturalHeight * 0.018))
        return {
          ...prev,
          padTop: pad,
          padBottom: pad,
          fontSize: size,
          y: (img.naturalHeight + pad + pad * 0.55) / (img.naturalHeight + pad * 2)
        }
      })
    }
    img.onerror = () => setImage(null)
    img.src = imageSrc(active, 'preview')
    return () => {
      img.onload = null
    }
  }, [active])

  const layout = useMemo(() => {
    if (!image) return null
    return layoutOf(image.naturalWidth, image.naturalHeight, options)
  }, [image, options])

  const previewScale = useMemo(() => {
    if (!layout) return 1
    return Math.min(1, 1500 / layout.width)
  }, [layout])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: false })
    if (!ctx) return
    if (!image || !layout) {
      canvas.width = 1200
      canvas.height = 800
      ctx.fillStyle = '#1b1e24'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      return
    }
    canvas.width = Math.round(layout.width * previewScale)
    canvas.height = Math.round(layout.height * previewScale)
    drawFrame(ctx, image, image.naturalWidth, image.naturalHeight, options, previewScale)

    const box = textBox(ctx, layout, options)
    ctx.save()
    ctx.scale(previewScale, previewScale)
    const stroke = Math.max(1.2, layout.width / 1600)
    ctx.strokeStyle = 'rgba(91,140,255,0.85)'
    ctx.setLineDash([stroke * 5, stroke * 4])
    ctx.lineWidth = stroke
    ctx.strokeRect(box.left - 8, box.top - 8, box.width + 16, box.height + 16)
    ctx.restore()
  }, [image, layout, options, previewScale])

  useEffect(() => {
    draw()
  }, [draw])

  const pointToImage = (event: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!layout) return
    const canvas = event.currentTarget
    const point = pointToImage(event)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const box = textBox(ctx, layout, options)
    const scale = canvas.width / layout.width
    const inside =
      point.x >= box.left * scale - 12 &&
      point.x <= (box.left + box.width) * scale + 12 &&
      point.y >= box.top * scale - 12 &&
      point.y <= (box.top + box.height) * scale + 12

    if (inside) {
      dragRef.current = {
        dx: options.x * layout.width - point.x / scale,
        dy: options.y * layout.height - point.y / scale
      }
    } else {
      setOptions((prev) => ({
        ...prev,
        x: clamp(point.x / canvas.width, 0, 1),
        y: clamp(point.y / canvas.height, 0, 1)
      }))
      dragRef.current = { dx: 0, dy: 0 }
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const drag = dragRef.current
    if (!drag || !layout) return
    const canvas = event.currentTarget
    const point = pointToImage(event)
    const scale = canvas.width / layout.width
    setOptions((prev) => ({
      ...prev,
      x: clamp(point.x / scale / layout.width + drag.dx / layout.width, 0, 0.98),
      y: clamp(point.y / scale / layout.height + drag.dy / layout.height, 0, 0.98)
    }))
  }

  const patch = (next: Partial<WatermarkOptions>): void => setOptions((prev) => ({ ...prev, ...next }))

  const toggleSelect = (path: string): void => {
    setSelected((prev) => {
      if (prev.includes(path)) return prev.filter((item) => item !== path)
      if (prev.length >= MAX_BATCH) {
        shared.toast(`单次最多 ${MAX_BATCH} 张，请分批导出`, 'warn')
        return prev
      }
      return [...prev, path]
    })
  }

  const targets = useMemo(() => {
    if (selected.length > 0) return edp.filter((file) => selected.includes(file.absPath))
    return active ? [active] : []
  }, [selected, edp, active])

  const applyPreset = (preset: { align: WatermarkOptions['align']; x: number; y: number }): void => {
    patch(preset)
  }

  const handleExport = async (): Promise<void> => {
    if (!root || targets.length === 0) return
    setExporting(true)
    setExportDone(null)
    setExportProgress({ done: 0, total: targets.length, current: targets[0].name })
    const names: string[] = []
    try {
      for (let index = 0; index < targets.length; index += 1) {
        const file = targets[index]
        setExportProgress({ done: index, total: targets.length, current: file.name })
        const bitmap = await loadBitmapOf(file)
        const layoutFull = layoutOf(bitmap.width, bitmap.height, options)
        const canvas = document.createElement('canvas')
        canvas.width = layoutFull.width
        canvas.height = layoutFull.height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('画布创建失败')
        drawFrame(ctx, bitmap, bitmap.width, bitmap.height, options, 1)
        if ('close' in bitmap) bitmap.close()

        const out = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, format === 'png' ? 'image/png' : 'image/jpeg', quality)
        )
        canvas.width = 0
        canvas.height = 0
        if (!out) throw new Error(`${file.name} 编码失败`)

        const data = await out.arrayBuffer()
        const result = await api.exportImage({
          root,
          sourceName: file.name,
          data,
          format,
          width: layoutFull.width,
          height: layoutFull.height,
          padTop: options.padTop,
          padBottom: options.padBottom
        })
        names.push(result.name)
        setExportProgress({ done: index + 1, total: targets.length, current: result.name })
        await new Promise((resolve) => setTimeout(resolve, 16))
      }
      await shared.refresh(root)
      await load()
      setExportDone({ count: names.length, names })
      shared.toast(`已导出 ${names.length} 张到最终成品目录`, 'success')
    } catch (error) {
      shared.toast(errorText(error), 'error')
    } finally {
      setExporting(false)
    }
  }

  const filteredFonts = useMemo(() => {
    const keyword = fontQuery.trim().toLowerCase()
    const list = keyword ? fonts.filter((font) => font.toLowerCase().includes(keyword)) : fonts
    return list.slice(0, 120)
  }, [fonts, fontQuery])

  if (!workspace) {
    return (
      <div className="module module--wide">
        <PageHeader
          step={DEF.step}
          total={MODULE_META.length}
          title={DEF.name}
          summary={DEF.summary}
          actions={DEF.actions}
          status={<StatusPill>等待工作区</StatusPill>}
        />
        <section className="step">
          <EmptyState
            icon={<Layers size={22} strokeWidth={1.7} />}
            title="先打开工作区"
            desc="读取「精修成片」中的图片，导出写入「最终成品」目录"
            actions={
              <button className="btn btn--primary" type="button" onClick={() => void shared.ensureWorkspace()}>
                选择工作区
              </button>
            }
          />
        </section>
      </div>
    )
  }

  return (
    <div className="module module--wide">
      <PageHeader
        step={DEF.step}
        total={MODULE_META.length}
        title={DEF.name}
        summary={DEF.summary}
        actions={DEF.actions}
        status={
          <StatusPill tone={edp.length > 0 ? 'ok' : 'idle'}>
            可处理 {edp.length} 张 · 已导出 {end.length} 张
          </StatusPill>
        }
      />

      {edp.length === 0 ? (
        <section className="step">
          <EmptyState
            icon={<ImageIcon size={22} strokeWidth={1.7} />}
            title="还没有可处理的成片"
            desc="「精修成片」目录为空。完成第 3 步「精修照片」并导出 JPG 或 PNG 后，照片会出现在这里。"
            actions={
              <button className="btn btn--sm" type="button" onClick={() => shared.navigate('retouch')}>
                回到第 3 步：精修照片
              </button>
            }
          />
        </section>
      ) : (
        <div className="frame-layout">
          <section className="step frame-picker">
            <div className="toolbar" style={{ marginBottom: 10 }}>
              <span className="step__title" style={{ fontSize: 12.5 }}>
                待处理的成片
              </span>
              <div className="toolbar__spacer" />
              <button
                className="btn btn--sm btn--ghost"
                type="button"
                onClick={() => setSelected(edp.slice(0, MAX_BATCH).map((file) => file.absPath))}
                title={`一次最多选 ${MAX_BATCH} 张`}
              >
                选中前 {MAX_BATCH} 张
              </button>
              <button className="btn btn--sm btn--ghost" type="button" onClick={() => setSelected([])} disabled={!selected.length}>
                清空
              </button>
              <button className="btn btn--icon" type="button" title="刷新" onClick={() => void load()}>
                <RefreshCw size={13} className={loading ? 'spin' : undefined} />
              </button>
            </div>

            <div className="plist">
              {edp.map((file) => {
                const checked = selected.includes(file.absPath)
                const isActive = active?.absPath === file.absPath
                return (
                  <div
                    key={file.absPath}
                    className={`pitem${isActive ? ' is-active' : ''}${checked ? ' is-checked' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActive(file)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') setActive(file)
                    }}
                  >
                    <button
                      type="button"
                      className={`pick-dot pick-dot--sm${checked ? ' is-on' : ''}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleSelect(file.absPath)
                      }}
                      title="加入批量"
                    >
                      {checked && <Check size={10} strokeWidth={3} />}
                    </button>
                    <span className="pitem__thumb">
                      <img src={imageSrc(file)} alt={file.name} loading="lazy" />
                    </span>
                    <span className="pitem__text">
                      <span className="pitem__name">{file.name}</span>
                      <span className="pitem__sub">
                        {file.width && file.height ? `${file.width}×${file.height}` : formatBytes(file.size)}
                        {file.edited ? ' · 含调整参数' : ''}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="batch-summary">
              <span>
                已选 <b>{selected.length}</b> / {MAX_BATCH}
              </span>
              <span className="muted">{selected.length > 0 ? '这一批会套用相同的水印参数' : '没有勾选时，只导出当前预览的这一张'}</span>
            </div>
          </section>

          <section className="step frame-editor">
            <div className="toolbar" style={{ marginBottom: 10 }}>
              <span className="step__title" style={{ fontSize: 12.5 }}>
                {active?.name ?? '画布'}
              </span>
              <span className="muted" style={{ fontSize: 11 }}>
                {image ? `${image.naturalWidth} × ${image.naturalHeight}` : '—'}
                {layout ? ` → ${layout.width} × ${layout.height}` : ''}
              </span>
              <div className="toolbar__spacer" />
              <button
                className="btn btn--sm btn--ghost"
                type="button"
                onClick={() =>
                  api
                    .reveal(active?.absPath ?? '')
                    .catch((error) => shared.toast(errorText(error), 'error'))
                }
              >
                <FolderOpen size={12} strokeWidth={1.9} />
                定位原图
              </button>
            </div>

            <div className="canvas-stage">
              <div className="canvas-scroll">
                <canvas
                  ref={canvasRef}
                  className="frame-canvas"
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={() => {
                    dragRef.current = null
                  }}
                  onPointerCancel={() => {
                    dragRef.current = null
                  }}
                />
              </div>
              <div className="canvas-tip">
                <MousePointer2 size={11} strokeWidth={2} />
                点击或拖动画面上的水印调整位置
              </div>
            </div>

            <div className="step__foot" style={{ marginTop: 12 }}>
              <span className="step__hint">
                <Info size={13} strokeWidth={1.9} />
                本次将导出 {targets.length} 张，命名为「原文件名 + END」
              </span>
              <div className="row">
                <CopyButton
                  text={joinPath(root, 'IMGT', 'END')}
                  label="复制成品目录路径"
                  className="btn btn--sm"
                  onCopied={() => shared.toast('已复制最终成品目录路径', 'success')}
                  onError={(message) => shared.toast(message, 'error')}
                />
                <button
                  className="btn btn--primary"
                  type="button"
                  onClick={() => void handleExport()}
                  disabled={exporting || targets.length === 0}
                >
                  {exporting ? <Loader2 size={14} className="spin" /> : <Download size={14} strokeWidth={2} />}
                  导出 {targets.length} 张成品
                </button>
              </div>
            </div>
          </section>

          <aside className="side">
            <div className="side-tabs">
              <button
                type="button"
                className={`side-tab${showPanel === 'canvas' ? ' is-active' : ''}`}
                onClick={() => setShowPanel('canvas')}
              >
                画布
              </button>
              <button
                type="button"
                className={`side-tab${showPanel === 'text' ? ' is-active' : ''}`}
                onClick={() => setShowPanel('text')}
              >
                水印
              </button>
            </div>

            {showPanel === 'canvas' ? (
              <>
                <div className="side-block">
                  <div className="side-block__title">上下色块</div>
                  <div className="grid-2">
                    <label className="field">
                      <span className="field__label">上留白 px</span>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        value={options.padTop}
                        onChange={(event) => patch({ padTop: Number(event.target.value) || 0 })}
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">下留白 px</span>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        value={options.padBottom}
                        onChange={(event) => patch({ padBottom: Number(event.target.value) || 0 })}
                      />
                    </label>
                  </div>
                  <div className="row" style={{ marginTop: 8 }}>
                    {[0.03, 0.055, 0.08].map((ratio) => (
                      <button
                        key={ratio}
                        className="btn btn--sm btn--ghost"
                        type="button"
                        onClick={() => {
                          if (!image) return
                          const pad = Math.round(image.naturalHeight * ratio)
                          patch({ padTop: pad, padBottom: pad })
                        }}
                      >
                        {(ratio * 100).toFixed(1)}%
                      </button>
                    ))}
                    <button
                      className="btn btn--sm btn--ghost"
                      type="button"
                      onClick={() => patch({ padTop: 0, padBottom: 0 })}
                    >
                      清零
                    </button>
                  </div>
                  <div className="field" style={{ marginTop: 10 }}>
                    <span className="field__label">色块颜色</span>
                    <div className="row">
                      <input
                        className="input color-input"
                        type="color"
                        value={options.barColor}
                        onChange={(event) => patch({ barColor: event.target.value })}
                      />
                      <div className="swatches">
                        {BAR_PRESETS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`swatch${options.barColor === color ? ' is-on' : ''}`}
                            style={{ background: color }}
                            title={color}
                            onClick={() => patch({ barColor: color })}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="side-block">
                  <div className="side-block__title">位置</div>
                  <div className="position-grid">
                    {(
                      [
                        { label: '左上', align: 'left', x: 0.04, y: 0.03 },
                        { label: '上中', align: 'center', x: 0.5, y: 0.03 },
                        { label: '右上', align: 'right', x: 0.96, y: 0.03 },
                        { label: '左下', align: 'left', x: 0.04, y: 0.88 },
                        { label: '下中', align: 'center', x: 0.5, y: 0.88 },
                        { label: '右下', align: 'right', x: 0.96, y: 0.88 }
                      ] as Array<{ label: string; align: WatermarkOptions['align']; x: number; y: number }>
                    ).map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        className="position-cell"
                        onClick={() => applyPreset(preset)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid-2" style={{ marginTop: 8 }}>
                    <label className="field">
                      <span className="field__label">X {(options.x * 100).toFixed(1)}%</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.005}
                        value={options.x}
                        onChange={(event) => patch({ x: Number(event.target.value) })}
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">Y {(options.y * 100).toFixed(1)}%</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.005}
                        value={options.y}
                        onChange={(event) => patch({ y: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                </div>

                <div className="side-block">
                  <div className="side-block__title">导出</div>
                  <Segmented
                    value={format}
                    onChange={(value) => setFormat(value)}
                    options={[
                      { value: 'jpeg', label: 'JPG' },
                      { value: 'png', label: 'PNG' }
                    ]}
                  />
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
                  <p className="field__hint">导出逐张处理，进度显示在导出窗口中。</p>
                  {end.length > 0 && (
                    <button
                      className="btn btn--sm"
                      type="button"
                      style={{ width: '100%' }}
                      onClick={() =>
                        api
                          .openFolder(joinPath(root, 'IMGT', 'END'))
                          .catch((error) => shared.toast(errorText(error), 'error'))
                      }
                    >
                      <FolderOpen size={12} strokeWidth={1.9} />
                      打开最终成品目录（{end.length}）
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="side-block">
                  <div className="side-block__title">
                    <Type size={12} strokeWidth={2} />
                    版权文本
                  </div>
                  <textarea
                    className="input textarea"
                    rows={2}
                    value={options.text}
                    onChange={(event) => patch({ text: event.target.value })}
                    placeholder="支持多行，例如 © 2026 你的名字"
                  />
                  <div className="row" style={{ marginTop: 8 }}>
                    <div className="select" onClick={() => setFontOpen((value) => !value)}>
                      <span className="select__value" title={options.fontFamily}>
                        {options.fontFamily}
                      </span>
                      <ChevronDown size={13} strokeWidth={2} />
                    </div>
                    <button
                      type="button"
                      className={`icon-btn${options.bold ? ' is-on' : ''}`}
                      title="加粗"
                      onClick={() => patch({ bold: !options.bold })}
                    >
                      <Bold size={14} strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      className={`icon-btn${options.italic ? ' is-on' : ''}`}
                      title="斜体"
                      onClick={() => patch({ italic: !options.italic })}
                    >
                      <Italic size={14} strokeWidth={2.2} />
                    </button>
                  </div>

                  {fontOpen && (
                    <div className="font-pop">
                      <input
                        className="input input--search"
                        placeholder="搜索本机字体"
                        value={fontQuery}
                        onChange={(event) => setFontQuery(event.target.value)}
                        autoFocus
                      />
                      <div className="font-pop__list">
                        {filteredFonts.map((font) => (
                          <button
                            key={font}
                            type="button"
                            className={`font-pop__item${font === options.fontFamily ? ' is-active' : ''}`}
                            style={{ fontFamily: `"${font}"` }}
                            onClick={() => {
                              patch({ fontFamily: font })
                              setFontOpen(false)
                              setFontQuery('')
                            }}
                          >
                            {font}
                          </button>
                        ))}
                        {filteredFonts.length === 0 && <div className="field__hint">没有匹配的字体</div>}
                      </div>
                    </div>
                  )}

                  <div className="grid-2" style={{ marginTop: 10 }}>
                    <label className="field">
                      <span className="field__label">字号 px</span>
                      <input
                        className="input"
                        type="number"
                        min={8}
                        value={options.fontSize}
                        onChange={(event) => patch({ fontSize: Number(event.target.value) || 12 })}
                      />
                    </label>
                    <label className="field">
                      <span className="field__label">不透明度 {Math.round(options.opacity * 100)}%</span>
                      <input
                        type="range"
                        min={0.2}
                        max={1}
                        step={0.02}
                        value={options.opacity}
                        onChange={(event) => patch({ opacity: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                  <div className="row" style={{ marginTop: 6 }}>
                    {[0.012, 0.018, 0.026].map((ratio) => (
                      <button
                        key={ratio}
                        className="btn btn--sm btn--ghost"
                        type="button"
                        onClick={() => {
                          if (!image) return
                          patch({ fontSize: Math.max(10, Math.round(image.naturalHeight * ratio)) })
                        }}
                      >
                        高度的 {(ratio * 100).toFixed(1)}%
                      </button>
                    ))}
                  </div>

                  <div className="row" style={{ marginTop: 10 }}>
                    <input
                      className="input color-input"
                      type="color"
                      value={options.color}
                      onChange={(event) => patch({ color: event.target.value })}
                    />
                    <div className="swatches">
                      {TEXT_PRESETS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`swatch${options.color === color ? ' is-on' : ''}`}
                          style={{ background: color }}
                          title={color}
                          onClick={() => patch({ color })}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="seg" style={{ marginTop: 10 }}>
                    {(
                      [
                        ['left', <AlignLeft key="l" size={13} />],
                        ['center', <AlignCenter key="c" size={13} />],
                        ['right', <AlignRight key="r" size={13} />]
                      ] as Array<[WatermarkOptions['align'], React.ReactNode]>
                    ).map(([value, icon]) => (
                      <button
                        key={value}
                        type="button"
                        className={`seg__item${options.align === value ? ' is-active' : ''}`}
                        onClick={() => patch({ align: value })}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      <StageNext
        hint={
          <>
            <Info size={13} strokeWidth={1.9} />
            最终成品目录已有 {end.length} 张；一次最多处理 {MAX_BATCH} 张，参数整批套用
          </>
        }
        label="完成并打开成品目录"
        onClick={() => {
          if (!root) return
          api
            .openFolder(joinPath(root, 'IMGT', 'END'))
            .catch((error) => shared.toast(errorText(error), 'error'))
        }}
        disabled={end.length === 0}
      >
        <button className="btn btn--sm btn--ghost" type="button" onClick={() => shared.navigate('retouch')}>
          返回第 3 步：精修照片
        </button>
      </StageNext>

      <Modal
        open={exporting || exportDone !== null}
        title={exportDone ? '导出完成' : '正在导出成品'}
        desc={
          exportDone
            ? `${exportDone.count} 张已写入「最终成品」目录`
            : '逐张按原图分辨率合成，大图较慢，请勿关闭窗口。'
        }
        width={440}
        closable={exportDone !== null && !exporting}
        onClose={() => setExportDone(null)}
        footer={
          exportDone ? (
            <>
              <CopyButton
                text={joinPath(root, 'IMGT', 'END')}
                label="复制成品目录路径"
                className="btn btn--sm"
                onCopied={() => shared.toast('已复制 END 路径', 'success')}
                onError={(message) => shared.toast(message, 'error')}
              />
              <button className="btn btn--primary btn--sm" type="button" onClick={() => setExportDone(null)}>
                完成
              </button>
            </>
          ) : undefined
        }
      >
        {exportDone ? (
          <div className="export-done">
            <div className="export-done__list">
              {exportDone.names.map((name) => (
                <div key={name} className="export-done__row">
                  <Check size={12} strokeWidth={2.8} />
                  <span>{name}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          exportProgress && (
            <div className="import-progress">
              <div className="import-progress__row">
                <span className="import-progress__label">
                  {exportProgress.done} / {exportProgress.total} 张
                </span>
                <b>{Math.round((exportProgress.done / Math.max(1, exportProgress.total)) * 100)}%</b>
              </div>
              <Meter percent={(exportProgress.done / Math.max(1, exportProgress.total)) * 100} />
              <div className="import-progress__current">{exportProgress.current}</div>
            </div>
          )
        )}
      </Modal>
    </div>
  )
}
