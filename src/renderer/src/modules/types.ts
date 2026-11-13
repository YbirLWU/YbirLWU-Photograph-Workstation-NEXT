import type { ScanReport, SettingsState, Workspace } from '@shared/types'
import type { ToastTone } from '@/components/Toasts'

export interface SharedState {
  root: string
  workspace: Workspace | null
  refresh: (root?: string) => Promise<Workspace | null>
  ensureWorkspace: () => Promise<string | null>
  openRoot: (root: string) => Promise<Workspace | null>
  switchWorkspace: () => Promise<void>
  closeWorkspace: () => void
  openSettings: () => void
  settings: SettingsState | null
  scan: ScanReport | null
  setScan: (report: ScanReport | null) => void
  navigate: (moduleId: string) => void
  toast: (message: string, tone?: ToastTone) => void
  demo: string | null
}

export function resolvePageSize(shared: SharedState): number {
  const override = shared.settings?.settings.pageSize ?? 0
  if (override > 0) return override
  return shared.workspace?.drive.pageSize ?? 20
}
