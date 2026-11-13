import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import type { ScanReport, SettingsState, Workspace } from '@shared/types'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { SettingsPanel } from './components/SettingsPanel'
import { StartPage } from './components/StartPage'
import { ToastStack, type ToastItem, type ToastTone } from './components/Toasts'
import { Modal } from './components/ui'
import { MODULES } from './modules/registry'
import type { SharedState } from './modules/types'
import { api, demoMode, errorText } from './lib/bridge'
import { formatBytes } from './lib/format'
import { applySettings } from './lib/theme'

const DEMO_MODULE: Record<string, string> = {
  start: 'scan',
  settings: 'scan',
  select: 'select',
  viewer: 'select',
  retouch: 'retouch',
  develop: 'retouch',
  frame: 'frame',
  scan: 'scan'
}

export default function App() {
  const [activeId, setActiveId] = useState(() => (demoMode && DEMO_MODULE[demoMode]) || MODULES[0].id)
  const [root, setRoot] = useState('')
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [scan, setScan] = useState<ScanReport | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [settings, setSettings] = useState<SettingsState | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(() => demoMode === 'settings')
  const [booting, setBooting] = useState(() => !demoMode || demoMode === 'start')
  const [imgtPrompt, setImgtPrompt] = useState<{ root: string; files: number; bytes: number } | null>(null)
  const [imgtBusy, setImgtBusy] = useState<'keep' | 'reset' | null>(null)

  const rootRef = useRef('')
  const toastRef = useRef<(message: string, tone?: ToastTone) => void>(() => undefined)

  const dismiss = useCallback((id: string) => {
    setToasts((items) => items.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setToasts((items) => [...items.slice(-3), { id, message, tone }])
      window.setTimeout(() => dismiss(id), 4600)
    },
    [dismiss]
  )
  toastRef.current = toast

  useEffect(() => {
    void api.settings
      .read()
      .then((state) => {
        setSettings(state)
        applySettings(state)
      })
      .catch(() => undefined)
  }, [])

  const changeSettings = useCallback((next: SettingsState) => {
    setSettings(next)
    applySettings(next)
  }, [])

  const refresh = useCallback(async (target?: string): Promise<Workspace | null> => {
    const key = target ?? rootRef.current
    if (!key) {
      setWorkspace(null)
      return null
    }
    try {
      const next = await api.workspace.read(key)
      setWorkspace(next)
      return next
    } catch (error) {
      toastRef.current(errorText(error), 'error')
      return null
    }
  }, [])

  const openRoot = useCallback(
    async (target: string, mode: 'ask' | 'keep' | 'reset' = 'ask'): Promise<Workspace | null> => {
      try {
        const next = await api.workspace.prepare(target, mode)
        if (next.pending) {
          setImgtPrompt({ root: next.root, files: next.pending.files, bytes: next.pending.bytes })
          return null
        }
        rootRef.current = next.root
        setRoot(next.root)
        setWorkspace(next)
        setScan(null)
        if (next.drive.external) {
          toastRef.current(`已打开工作区 · 外置设备，每页 ${next.drive.pageSize} 张`, 'warn')
        } else {
          toastRef.current('工作区已打开', 'success')
        }
        return next
      } catch (error) {
        toastRef.current(errorText(error), 'error')
        return null
      }
    },
    []
  )

  const switchWorkspace = useCallback(async (): Promise<void> => {
    try {
      const picked = await api.pickFolder({
        title: '选择新的工作区（选错的目录可以在这里换掉）',
        defaultPath: rootRef.current || undefined,
        allowCreate: true
      })
      if (!picked || picked === rootRef.current) return
      const next = await openRoot(picked)
      if (next) toastRef.current(`已切换到 ${next.root}`, 'success')
    } catch (error) {
      toastRef.current(errorText(error), 'error')
    }
  }, [openRoot])

  const closeWorkspace = useCallback((): void => {
    rootRef.current = ''
    setRoot('')
    setWorkspace(null)
    setScan(null)
    toastRef.current('工作区已关闭', 'info')
  }, [])

  const resolveImgt = useCallback(
    async (mode: 'keep' | 'reset'): Promise<void> => {
      const prompt = imgtPrompt
      if (!prompt) return
      setImgtBusy(mode === 'reset' ? 'reset' : 'keep')
      try {
        const next = await openRoot(prompt.root, mode)
        if (next) {
          setImgtPrompt(null)
          setBooting(false)
        }
      } finally {
        setImgtBusy(null)
      }
    },
    [imgtPrompt, openRoot]
  )

  const ensureWorkspace = useCallback(async (): Promise<string | null> => {
    if (rootRef.current) return rootRef.current
    try {
      const picked = await api.pickFolder({ title: '选择 / 新建图片工作区', allowCreate: true })
      if (!picked) return null
      const next = await openRoot(picked)
      return next?.root ?? null
    } catch (error) {
      toastRef.current(errorText(error), 'error')
      return null
    }
  }, [openRoot])

  useEffect(() => {
    if (!demoMode) return
    void api.workspace
      .prepare('')
      .then((next) => {
        rootRef.current = next.root
        setRoot(next.root)
        setWorkspace(next)
      })
      .catch(() => undefined)
    if (['select', 'viewer', 'scan'].includes(demoMode)) {
      void api
        .scan({ root: '', rawDir: '', jpgDir: '' })
        .then(setScan)
        .catch(() => undefined)
    }
  }, [])

  const openSettings = useCallback(() => setSettingsOpen(true), [])

  const shared = useMemo<SharedState>(
    () => ({
      root,
      workspace,
      refresh,
      ensureWorkspace,
      openRoot,
      switchWorkspace,
      closeWorkspace,
      openSettings,
      settings,
      scan,
      setScan,
      navigate: setActiveId,
      toast,
      demo: demoMode
    }),
    [root, workspace, refresh, ensureWorkspace, openRoot, switchWorkspace, closeWorkspace, openSettings, settings, scan, toast]
  )

  const active = MODULES.find((module) => module.id === activeId) ?? MODULES[0]
  const ActiveModule = active.component

  const startWorkspace = useCallback(async (): Promise<void> => {
    const picked = await ensureWorkspace()
    if (picked) setBooting(false)
  }, [ensureWorkspace])

  return (
    <div className={`app${booting ? ' app--booting' : ''}`}>
      <TitleBar
        demo={demoMode}
        drive={workspace?.drive ?? null}
        root={root}
        stage={`第 ${active.step} 步 · ${active.name}`}
      />
      <div className="app__body">
        <Sidebar
          modules={MODULES}
          activeId={active.id}
          onSelect={setActiveId}
          onSettings={openSettings}
          shared={shared}
        />
        <main className="app__main">
          <div className={`app__scroll${active.wide ? ' app__scroll--wide' : ''}`} key={active.id}>
            <ActiveModule shared={shared} />
          </div>
        </main>
      </div>
      {booting && (
        <StartPage
          onEnter={() => setBooting(false)}
          onPickWorkspace={() => void startWorkspace()}
          onSettings={openSettings}
        />
      )}
      <Modal
        open={imgtPrompt !== null}
        title="处理区已有内容"
        desc="开始新的修图批次前，需要确认上一次的入选、精修与成品如何处理。"
        width={480}
        closable={imgtBusy === null}
        onClose={imgtBusy === null ? () => setImgtPrompt(null) : undefined}
        footer={
          <>
            <button
              className="btn btn--sm"
              type="button"
              onClick={() => setImgtPrompt(null)}
              disabled={imgtBusy !== null}
            >
              取消
            </button>
            <button
              className="btn btn--sm btn--danger"
              type="button"
              onClick={() => void resolveImgt('reset')}
              disabled={imgtBusy !== null}
            >
              {imgtBusy === 'reset' ? <Loader2 size={12} className="spin" /> : null}
              清空并重新开始
            </button>
            <button
              className="btn btn--sm btn--primary"
              type="button"
              onClick={() => void resolveImgt('keep')}
              disabled={imgtBusy !== null}
            >
              {imgtBusy === 'keep' ? <Loader2 size={12} className="spin" /> : null}
              保留并继续
            </button>
          </>
        }
      >
        <div className="notice notice--warn dialog-note">
          <AlertTriangle size={15} strokeWidth={2} />
          <div>
            <b>
              处理区现有 {imgtPrompt?.files ?? 0} 个文件，约 {formatBytes(imgtPrompt?.bytes ?? 0)}
            </b>
            <span>
              清空会删除「入选照片」「精修成片」「最终成品」中的全部文件，无法恢复；RAW 原片与 JPG 预览不受影响。
            </span>
          </div>
        </div>
        <div className="kv">
          <span>工作区</span>
          <b className="kv__ellipsis" title={imgtPrompt?.root ?? ''}>
            {imgtPrompt?.root ?? ''}
          </b>
        </div>
      </Modal>
      <ToastStack items={toasts} onDismiss={dismiss} />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        state={settings}
        onChange={changeSettings}
        onToast={toast}
        workspaceRoot={root}
      />
    </div>
  )
}
