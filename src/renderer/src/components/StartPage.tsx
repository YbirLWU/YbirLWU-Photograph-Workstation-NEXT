import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, FolderOpen, Settings2 } from 'lucide-react'
import { api } from '@/lib/bridge'
import {
  APP_NAME,
  APP_PLATFORM,
  APP_VERSION_LABEL,
  BUILD_CHANNEL_LABEL,
  BUILD_CODE
} from '@shared/version'
import { Logo } from './Logo'

interface StartPageProps {
  onEnter: () => void
  onPickWorkspace: () => void
  onSettings: () => void
}

interface BootLine {
  label: string
  detail: string
  state: string
}

const STEPS = ['源文件比对', '筛选照片', '精修照片', '水印与导出']

export function StartPage({ onEnter, onPickWorkspace, onSettings }: StartPageProps) {
  const [lines, setLines] = useState<BootLine[]>([
    { label: 'workstation', detail: `build ${APP_VERSION_LABEL} · ${APP_PLATFORM}`, state: 'ready' },
    { label: 'channel', detail: `${BUILD_CODE} · ${BUILD_CHANNEL_LABEL}`, state: 'ready' },
    { label: 'renderer', detail: 'chromium · hardware accelerated', state: 'ready' }
  ])
  const [leaving, setLeaving] = useState(false)
  const enterRef = useRef(onEnter)
  enterRef.current = onEnter

  useEffect(() => {
    let cancelled = false
    const add = (line: BootLine): void => {
      if (!cancelled) setLines((prev) => [...prev, line])
    }

    const run = async (): Promise<void> => {
      const display = await api.settings.display().catch(() => null)
      if (display) {
        add({
          label: 'display',
          detail: `${display.size.width}×${display.size.height} · ${Math.round(display.scaleFactor * 100)}%`,
          state: 'ready'
        })
        add({
          label: 'work area',
          detail: `${display.workArea.width}×${display.workArea.height}`,
          state: 'ready'
        })
      }

      const cache = await api.settings.cache().catch(() => null)
      if (cache) {
        add({
          label: 'asset cache',
          detail: `${cache.files} files · ${(cache.bytes / 1024 / 1024).toFixed(1)} MB`,
          state: 'ready'
        })
      }

      const plugins = await api.plugins.list().catch(() => [])
      add({
        label: 'plugins',
        detail:
          plugins.length > 0
            ? `${plugins.filter((item) => item.enabled).length}/${plugins.length} loaded`
            : 'none installed',
        state: plugins.length > 0 ? 'ready' : 'idle'
      })

      add({ label: 'pipeline', detail: 'scan → select → retouch → export', state: 'idle' })
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const leave = (action: () => void): void => {
    setLeaving(true)
    window.setTimeout(action, 140)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (target?.isContentEditable) return
      if (event.key === 'Enter') {
        event.preventDefault()
        leave(() => enterRef.current())
      } else if (event.key === 'w' || event.key === 'W') {
        leave(onPickWorkspace)
      } else if (event.key === 's' || event.key === 'S') {
        onSettings()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPickWorkspace, onSettings])

  const stamp = useMemo(() => {
    const now = new Date()
    const pad = (value: number): string => String(value).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
  }, [])

  return (
    <div className={`start${leaving ? ' is-leaving' : ''}`}>
      <div className="start__inner">
        <header className="start__head">
          <div className="start__mark">
            <span className="start__brandmark" aria-hidden>
              <Logo size={30} />
            </span>
            <div>
              <div className="start__name">{APP_NAME}</div>
            </div>
          </div>
          <span className="start__version">{APP_VERSION_LABEL}</span>
        </header>

        <main className="start__main">
          <section className="start__hero">
            <h1>欢迎回来</h1>
            <p>底片校验、挑片入库、修图验收、水印导出，四步走完一轮拍摄</p>

            <ol className="start__steps">
              {STEPS.map((step, position) => (
                <li key={step}>
                  <span>{position + 1}</span>
                  {step}
                </li>
              ))}
            </ol>

            <div className="start__actions">
              <button className="btn btn--primary start__cta" type="button" onClick={() => leave(onEnter)}>
                进入工作台（推荐）
                <ArrowRight size={15} strokeWidth={2.4} />
              </button>
              <button className="btn start__ghost" type="button" onClick={() => leave(onPickWorkspace)}>
                <FolderOpen size={14} strokeWidth={2} />
                打开工作区
              </button>
              <button className="btn start__ghost" type="button" onClick={onSettings}>
                <Settings2 size={14} strokeWidth={2} />
                设置
              </button>
            </div>

            <div className="start__keys">
              <span>
                <kbd>Enter</kbd> 进入
              </span>
              <span>
                <kbd>W</kbd> 工作区
              </span>
              <span>
                <kbd>S</kbd> 设置
              </span>
            </div>
          </section>

          <section className="start__console" aria-label="环境信息">
            <div className="start__console-head">
              <span>environment</span>
              <span className="start__console-meta">{stamp}</span>
            </div>
            <div className="start__console-body">
              {lines.map((line) => (
                <div className="start__line" key={line.label}>
                  <span className="start__key">{line.label}</span>
                  <span className="start__dots" aria-hidden />
                  <span className="start__value">{line.detail}</span>
                  <span className={`start__state${line.state === 'idle' ? ' is-idle' : ''}`}>{line.state}</span>
                </div>
              ))}
            </div>
          </section>
        </main>

        <footer className="start__foot">
          <span>{APP_VERSION_LABEL}</span>
          <span className="start__foot-meta">
            YbirLWU · {BUILD_CHANNEL_LABEL} · {APP_PLATFORM}
          </span>
        </footer>
      </div>
    </div>
  )
}
