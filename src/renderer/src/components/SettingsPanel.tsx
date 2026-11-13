import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Crop,
  FolderOpen,
  Image as ImageIcon,
  Info,
  Layers,
  Loader2,
  Monitor,
  Palette,
  Plug,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  Wrench
} from 'lucide-react'
import type { BackgroundCandidate, CacheInfo, DisplayInfo, PluginInfo, SettingsState } from '@shared/types'
import { api, errorText, mediaUrl, readImageBlob } from '@/lib/bridge'
import { formatBytes } from '@/lib/format'
import { THEMES } from '@/lib/theme'
import {
  APP_NAME,
  APP_PLATFORM,
  APP_SHORT,
  APP_VENDOR,
  APP_VERSION_LABEL,
  BUILD_CHANNEL_LABEL,
  BUILD_CODE,
  BUILD_DATE
} from '@shared/version'
import { Modal } from './ui'
import { CopyButton } from './CopyButton'

type Tab = 'look' | 'flow' | 'dev'

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
  state: SettingsState | null
  onChange: (next: SettingsState) => void
  onToast: (message: string, tone?: 'info' | 'success' | 'error' | 'warn') => void
  workspaceRoot?: string
}

export function SettingsPanel({ open, onClose, state, onChange, onToast, workspaceRoot }: SettingsPanelProps) {
  const [tab, setTab] = useState<Tab>('look')

  return (
    <Modal
      open={open}
      title={
        <span className="settings__title">
          <Settings2 size={14} strokeWidth={2} />
          设置
        </span>
      }
      desc="外观与背景即时生效；开发者选项仅在需要调试或扩展时使用。"
      width={720}
      onClose={onClose}
      footer={
        <button className="btn btn--primary btn--sm" type="button" onClick={onClose}>
          完成
        </button>
      }
    >
      <div className="settings">
        <nav className="settings__tabs">
          <button
            className={`settings__tab${tab === 'look' ? ' is-active' : ''}`}
            type="button"
            onClick={() => setTab('look')}
          >
            <Palette size={13} strokeWidth={2} />
            外观
          </button>
          <button
            className={`settings__tab${tab === 'flow' ? ' is-active' : ''}`}
            type="button"
            onClick={() => setTab('flow')}
          >
            <Layers size={13} strokeWidth={2} />
            流程
          </button>
          <button
            className={`settings__tab${tab === 'dev' ? ' is-active' : ''}`}
            type="button"
            onClick={() => setTab('dev')}
          >
            <Wrench size={13} strokeWidth={2} />
            开发者
          </button>
        </nav>

        <div className="settings__body">
          {tab === 'look' && <LookTab state={state} onChange={onChange} onToast={onToast} />}
          {tab === 'flow' && <FlowTab state={state} onChange={onChange} onToast={onToast} root={workspaceRoot} />}
          {tab === 'dev' && <DevTab onToast={onToast} />}
        </div>
      </div>
    </Modal>
  )
}


function LookTab({
  state,
  onChange,
  onToast
}: {
  state: SettingsState | null
  onChange: (next: SettingsState) => void
  onToast: (message: string, tone?: 'info' | 'success' | 'error' | 'warn') => void
}) {
  const settings = state?.settings
  const [candidate, setCandidate] = useState<BackgroundCandidate | null>(null)

  const patch = useCallback(
    async (input: Partial<SettingsState['settings']>) => {
      try {
        onChange(await api.settings.save(input))
      } catch (error) {
        onToast(errorText(error), 'error')
      }
    },
    [onChange, onToast]
  )

  const pickBackground = async (): Promise<void> => {
    try {
      const next = await api.settings.chooseBackground()
      if (next) setCandidate(next)
    } catch (error) {
      onToast(errorText(error), 'error')
    }
  }

  const clear = async (): Promise<void> => {
    try {
      onChange(await api.settings.clearBackground())
      onToast('已移除背景图', 'success')
    } catch (error) {
      onToast(errorText(error), 'error')
    }
  }

  return (
    <div className="settings__section">
      <div className="settings__label">
        主题
        <span className="muted">深色适合看图，浅色适合白天与投屏</span>
      </div>
      <div className="theme-grid">
        {THEMES.map((theme) => {
          const active = (settings?.theme ?? 'dark') === theme.value
          return (
            <button
              key={theme.value}
              type="button"
              className={`theme-card${active ? ' is-active' : ''}`}
              onClick={() => void patch({ theme: theme.value })}
            >
              <span className="theme-card__swatch">
                {theme.swatch.map((color) => (
                  <i key={color} style={{ background: color }} />
                ))}
              </span>
              <span className="theme-card__name">
                {theme.label}
                {active && <Check size={11} strokeWidth={3} />}
              </span>
              <span className="theme-card__hint">{theme.hint}</span>
            </button>
          )
        })}
      </div>

      <div className="settings__label">
        背景图
        <span className="muted">按当前窗口比例裁切后铺满，不会拉伸</span>
      </div>

      {state?.backgroundPath ? (
        <div className="bg-row">
          <span className="bg-row__thumb" style={{ backgroundImage: `url("${mediaUrl(state.backgroundPath)}")` }} />
          <div className="bg-row__meta">
            <b>已应用背景</b>
            <span className="muted">{state.backgroundPath}</span>
          </div>
          <button className="btn btn--sm" type="button" onClick={() => void pickBackground()}>
            <ImageIcon size={12} strokeWidth={1.9} />
            更换背景图
          </button>
          <button className="btn btn--sm btn--ghost" type="button" onClick={() => void clear()}>
            <Trash2 size={12} strokeWidth={1.9} />
            移除背景图
          </button>
        </div>
      ) : (
        <div className="bg-empty">
          <ImageIcon size={15} strokeWidth={1.7} />
          您还没有选择背景图，选择一张本地图片，应用程式将自动适配您的显示设备
          <button className="btn btn--sm" type="button" onClick={() => void pickBackground()}>
            选择图片
          </button>
        </div>
      )}

      {candidate && (
        <CropStage
          candidate={candidate}
          onCancel={() => setCandidate(null)}
          onApply={async (data) => {
            try {
              onChange(await api.settings.saveBackground(data))
              setCandidate(null)
              onToast('背景已更新（已按窗口比例裁切）', 'success')
            } catch (error) {
              onToast(errorText(error), 'error')
            }
          }}
        />
      )}

      <div className="settings__grid2">
        <label className="settings__slider">
          <span>
            背景不透明度<b>{settings?.backgroundOpacity ?? 28}%</b>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={settings?.backgroundOpacity ?? 28}
            onChange={(event) => void patch({ backgroundOpacity: Number(event.target.value) })}
          />
        </label>
        <label className="settings__slider">
          <span>
            背景模糊<b>{settings?.backgroundBlur ?? 6}px</b>
          </span>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={settings?.backgroundBlur ?? 6}
            onChange={(event) => void patch({ backgroundBlur: Number(event.target.value) })}
          />
        </label>
      </div>
    </div>
  )
}

function CropStage({
  candidate,
  onApply,
  onCancel
}: {
  candidate: BackgroundCandidate
  onApply: (data: ArrayBuffer) => Promise<void>
  onCancel: () => void
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [applying, setApplying] = useState(false)
  const [display, setDisplay] = useState<DisplayInfo | null>(null)
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const aspect = useMemo(() => {
    const width = display?.workArea.width || window.innerWidth
    const height = display?.workArea.height || window.innerHeight
    return width / height
  }, [display])

  useEffect(() => {
    void api.settings
      .display()
      .then(setDisplay)
      .catch(() => setDisplay(null))
  }, [])

  useEffect(() => {
    let url = ''
    let cancelled = false
    void (async () => {
      try {
        const blob = await readImageBlob(candidate.path)
        url = URL.createObjectURL(blob)
        const img = new Image()
        img.src = url
        await img.decode()
        if (cancelled) return
        setImage(img)
        setSrc(url)
      } catch {
        setSrc(null)
      }
    })()
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [candidate.path])

  const cover = useMemo(() => {
    const boxWidth = 360
    const boxHeight = Math.round(boxWidth / aspect)
    const scale = Math.max(boxWidth / candidate.width, boxHeight / candidate.height)
    return { boxWidth, boxHeight, scale }
  }, [aspect, candidate.width, candidate.height])

  const displayed = {
    width: candidate.width * cover.scale * zoom,
    height: candidate.height * cover.scale * zoom
  }
  const limitX = Math.max(0, (displayed.width - cover.boxWidth) / 2)
  const limitY = Math.max(0, (displayed.height - cover.boxHeight) / 2)
  const tx = Math.max(-limitX, Math.min(limitX, offset.x))
  const ty = Math.max(-limitY, Math.min(limitY, offset.y))

  const apply = async (): Promise<void> => {
    if (!image) return
    setApplying(true)
    try {
      const k = cover.scale * zoom
      const sourceWidth = cover.boxWidth / k
      const sourceHeight = cover.boxHeight / k
      const dx = (cover.boxWidth - displayed.width) / 2 + tx
      const dy = (cover.boxHeight - displayed.height) / 2 + ty
      const sourceX = Math.max(0, -dx / k)
      const sourceY = Math.max(0, -dy / k)

      const outWidth = Math.min(2560, Math.round(sourceWidth))
      const outHeight = Math.max(1, Math.round(outWidth / aspect))
      const canvas = document.createElement('canvas')
      canvas.width = outWidth
      canvas.height = outHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('无法创建画布')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outWidth, outHeight)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
      canvas.width = 0
      canvas.height = 0
      if (!blob) throw new Error('背景编码失败')
      await onApply(await blob.arrayBuffer())
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="crop">
      <div className="crop__head">
        <Crop size={12} strokeWidth={2} />
        裁切背景
        <span className="muted">
          {candidate.width} × {candidate.height} · 目标比例 {aspect.toFixed(2)} : 1
        </span>
      </div>
      <div
        ref={boxRef}
        className="crop__box"
        style={{ width: cover.boxWidth, height: cover.boxHeight }}
        onPointerDown={(event) => {
          dragRef.current = { x: event.clientX, y: event.clientY, ox: tx, oy: ty }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current
          if (!drag) return
          setOffset({
            x: Math.max(-limitX, Math.min(limitX, drag.ox + event.clientX - drag.x)),
            y: Math.max(-limitY, Math.min(limitY, drag.oy + event.clientY - drag.y))
          })
        }}
        onPointerUp={() => {
          dragRef.current = null
        }}
        onPointerCancel={() => {
          dragRef.current = null
        }}
      >
        {src ? (
          <img
            src={src}
            alt="背景预览"
            draggable={false}
            style={{ transform: `translate(${tx}px, ${ty}px) scale(${zoom})`, width: candidate.width * cover.scale, height: candidate.height * cover.scale }}
          />
        ) : (
          <span className="crop__loading">
            <Loader2 size={14} className="spin" /> 载入中…
          </span>
        )}
        <span className="crop__grid" />
      </div>
      <div className="crop__controls">
        <label className="settings__slider settings__slider--inline">
          <span>缩放</span>
          <input
            type="range"
            min={1}
            max={2.6}
            step={0.02}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
        <span className="muted">拖动图片以改变取景</span>
        <div className="crop__actions">
          <button className="btn btn--sm btn--ghost" type="button" onClick={onCancel} disabled={applying}>
            取消
          </button>
          <button className="btn btn--primary btn--sm" type="button" onClick={() => void apply()} disabled={!image || applying}>
            {applying ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} strokeWidth={2} />}
            生成背景
          </button>
        </div>
      </div>
    </div>
  )
}


function FlowTab({
  state,
  onChange,
  onToast,
  root
}: {
  state: SettingsState | null
  onChange: (next: SettingsState) => void
  onToast: (message: string, tone?: 'info' | 'success' | 'error' | 'warn') => void
  root?: string
}) {
  const settings = state?.settings
  const [size, setSize] = useState(settings?.pageSize ?? 0)

  useEffect(() => {
    setSize(settings?.pageSize ?? 0)
  }, [settings?.pageSize])

  const save = async (): Promise<void> => {
    try {
      onChange(await api.settings.save({ pageSize: size }))
      onToast(size === 0 ? '已恢复为按磁盘类型自动分页' : `每页固定 ${size} 张`, 'success')
    } catch (error) {
      onToast(errorText(error), 'error')
    }
  }

  return (
    <div className="settings__section">
      <div className="settings__label">
        每页缩略图
        <span className="muted">自动模式：本地驱动器 20 张 / 外置存储设备 10 张</span>
      </div>
      <div className="settings__row">
        <div className="seg">
          {[0, 10, 20, 30, 40].map((value) => (
            <button
              key={value}
              type="button"
              className={`seg__item${size === value ? ' is-active' : ''}`}
              onClick={() => setSize(value)}
            >
              {value === 0 ? '自动' : value}
            </button>
          ))}
        </div>
        <button className="btn btn--sm btn--primary" type="button" onClick={() => void save()} disabled={size === (settings?.pageSize ?? 0)}>
          应用
        </button>
      </div>
      <p className="field__hint">
        外置存储设备受限于接口速率相对较慢，本地驱动器可以满足更高的单页张数
      </p>

      <div className="settings__label">当前工作区</div>
      {root ? (
        <div className="settings__row settings__row--between">
          <code className="settings__path">{root}</code>
          <div className="row">
            <CopyButton
              text={root}
              className="btn btn--sm"
              onCopied={(message) => onToast(message, 'success')}
              onError={(message) => onToast(message, 'error')}
            />
            <button
              className="btn btn--sm"
              type="button"
              onClick={() => api.openFolder(root).catch((error) => onToast(errorText(error), 'error'))}
            >
              <FolderOpen size={12} strokeWidth={1.9} />
              打开
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-empty">
          <Info size={14} strokeWidth={1.8} />
          当前没有打开的工作区
        </div>
      )}

      <div className="settings__label">工作目录结构</div>
      <pre className="settings__tree">{`工作区/
  RAW/              相机传感器文件，支持 NEF、ARW、CR2、CR3、DNG 等常见后缀名
  JPG/              与相机传感器文件同名的压缩图像
  IMGT/             本批次YPW处理区（工作区）
    CHO/            第 2 步筛选得出的图片，分 RAW 和 JPG 存储
    EDP/            第 3 步精修后的成片，内置编辑器配置参数同名XML文档
    END/            第 4 步导出的最终成品，命名规范为「原文件名 + END」`}</pre>
    </div>
  )
}


function DevTab({ onToast }: { onToast: (message: string, tone?: 'info' | 'success' | 'error' | 'warn') => void }) {
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [cache, setCache] = useState<CacheInfo | null>(null)
  const [clearing, setClearing] = useState(false)

  const loadPlugins = useCallback(
    async (reload = false): Promise<void> => {
      setLoading(true)
      try {
        setPlugins(reload ? await api.plugins.reload() : await api.plugins.list())
      } catch (error) {
        onToast(errorText(error), 'error')
      } finally {
        setLoading(false)
      }
    },
    [onToast]
  )

  useEffect(() => {
    void loadPlugins()
    void api.settings
      .cache()
      .then(setCache)
      .catch(() => setCache(null))
  }, [loadPlugins])

  const clear = async (): Promise<void> => {
    setClearing(true)
    try {
      const result = await api.settings.clearCache()
      setCache(await api.settings.cache())
      onToast(`已清空派生图缓存（${result.removed} 个文件），下次浏览会重新生成`, 'success')
    } catch (error) {
      onToast(errorText(error), 'error')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="settings__section">
      <div className="settings__label">
        插件
        <span className="muted">内部测试阶段 · 请根据开发需要谨慎选择</span>
      </div>
      <div className="notice notice--warn dialog-note">
        <AlertTriangle size={15} strokeWidth={2} />
        <div>
          <b>插件功能目前处于内部测试阶段</b>
          <span>尚不完善，行为可能随版本调整，请谨慎使用；插件异常会被单独捕获，不影响应用程式</span>
        </div>
      </div>
      <div className="plugin-list">
        {plugins.length === 0 && (
          <div className="plugin-empty">
            还没有安装插件
          </div>
        )}
        {plugins.map((plugin) => (
          <div key={plugin.id} className={`plugin-row${plugin.error ? ' is-error' : ''}`}>
            <div className="plugin-row__main">
              <b>{plugin.name}</b>
              <span className="muted">
                v{plugin.version} · {plugin.id}
              </span>
              {plugin.description && <span className="plugin-row__desc">{plugin.description}</span>}
              {plugin.error && <span className="plugin-row__desc">加载失败：{plugin.error}</span>}
            </div>
            <div className="plugin-row__hooks">
              {plugin.hooks.length > 0 ? (
                plugin.hooks.map((hook) => (
                  <span key={hook} className="tag">
                    {hook}
                  </span>
                ))
              ) : (
                <span className="muted">无钩子</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="settings__row">
        <button className="btn btn--sm" type="button" onClick={() => void loadPlugins(true)} disabled={loading}>
          <RefreshCw size={12} className={loading ? 'spin' : undefined} />
          重新扫描
        </button>
        <button
          className="btn btn--sm"
          type="button"
          onClick={() => api.plugins.openFolder().catch((error) => onToast(errorText(error), 'error'))}
        >
          <Plug size={12} strokeWidth={1.9} />
          打开插件目录
        </button>
      </div>

      <div className="settings__label">
        派生图缓存
        <span className="muted">缩略图与预览图的解码结果，删除后在下次浏览时重建</span>
      </div>
      {cache ? (
        <div className="settings__row settings__row--between">
          <span className="settings__kv">
            <Monitor size={12} strokeWidth={1.9} />
            {cache.files.toLocaleString('zh-CN')} 个文件 · {formatBytes(cache.bytes)}
          </span>
          <button className="btn btn--sm" type="button" onClick={() => void clear()} disabled={clearing}>
            {clearing ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} strokeWidth={1.9} />}
            清空缓存
          </button>
        </div>
      ) : (
        <div className="bg-empty">读取中…</div>
      )}

      <div className="settings__label">扩展一个新阶段</div>
      <p className="field__hint">
      根据您的开发需要，联系Github绑定的开发团队以获取免费的流程扩展支持
      </p>
      <div className="settings__label">开发者信息</div>
      <div className="dev-info">
        <div className="kv">
          <span>开发者（著作权所有人）</span>
          <b>{APP_VENDOR}</b>
        </div>
        <div className="kv">
          <span>软件名称</span>
          <b>
            {APP_NAME}（{APP_SHORT}）
          </b>
        </div>
        <div className="kv">
          <span>版本</span>
          <b>{APP_VERSION_LABEL}</b>
        </div>
        <div className="kv">
          <span>构建编码</span>
          <b title={`打包方式 + 构建日期 ${BUILD_DATE} + 当日序号`}>
            {BUILD_CODE} · {BUILD_CHANNEL_LABEL}
          </b>
        </div>
        <div className="kv">
          <span>构建平台</span>
          <b>{APP_PLATFORM}</b>
        </div>
        <div className="kv">
          <span>渲染内核</span>
          <b>{navigator.userAgent.replace(/^.*Chrome\//, 'Chromium ').replace(/ .*/, '')}</b>
        </div>
      </div>

      <div className="settings__label">免责声明</div>
      <div className="dev-disclaimer">
        <p>
          本软件按现状提供，开发者不对软件的可用性、稳定性或适用性作任何明示或默示的保证。因使用本软件处理照片所产生的任何数据丢失、
          文件损坏或间接损失，由使用者自行承担风险。请在重要素材上操作前自行备份；软件内的清空、删除类操作不可撤销。
        </p>
        <p>继续使用本软件即表示已阅读并同意上述声明。</p>
      </div>

      <p className="settings__foot">
        <ChevronRight size={11} />
        {APP_NAME} · {APP_VERSION_LABEL} · {APP_PLATFORM}
      </p>
    </div>
  )
}
