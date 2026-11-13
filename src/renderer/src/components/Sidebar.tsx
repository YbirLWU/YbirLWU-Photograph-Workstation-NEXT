import { Check, Settings2 } from 'lucide-react'
import type { ModuleDef } from '@/modules/registry'
import type { SharedState } from '@/modules/types'
import { APP_PLATFORM, APP_VERSION_LABEL } from '@shared/version'
import { WorkspaceCard } from './WorkspaceCard'

interface SidebarProps {
  modules: ModuleDef[]
  activeId: string
  onSelect: (id: string) => void
  onSettings: () => void
  shared: SharedState
}

export function Sidebar({ modules, activeId, onSelect, onSettings, shared }: SidebarProps) {
  const counts = shared.workspace?.counts
  const pendingRounds =
    shared.workspace?.session.rounds.filter((round) => round.status === 'pending').length ?? 0

  const badgeOf = (id: string): string => {
    if (id === 'scan') return shared.scan ? `${shared.scan.stats.matched}` : ''
    if (id === 'select') return counts ? `${counts.choRaw}` : ''
    if (id === 'retouch') return counts && counts.edp > 0 ? `${counts.edp}` : pendingRounds > 0 ? `${pendingRounds}` : ''
    if (id === 'frame') return counts && counts.end > 0 ? `${counts.end}` : ''
    return ''
  }

  const doneOf = (id: string): boolean => {
    if (id === 'scan') return Boolean(shared.scan && shared.scan.pairs.length > 0)
    if (id === 'select') return Boolean(counts && counts.choRaw > 0)
    if (id === 'retouch') return Boolean(counts && counts.edp > 0)
    if (id === 'frame') return Boolean(counts && counts.end > 0)
    return false
  }

  const doneCount = modules.filter((module) => doneOf(module.id)).length

  return (
    <aside className="sidebar">
      <div className="sidebar__head">
        <span className="sidebar__label">工作流程</span>
        <span className="sidebar__progress">
          已完成 {doneCount} / {modules.length}
        </span>
      </div>

      <nav className="sidebar__nav">
        {modules.map((module) => {
          const Icon = module.icon
          const active = module.id === activeId
          const badge = badgeOf(module.id)
          const done = doneOf(module.id)
          return (
            <button
              key={module.id}
              className={`flow-step${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
              onClick={() => onSelect(module.id)}
              type="button"
              title={`第 ${module.step} 步 · ${module.name}：${module.tagline}`}
            >
              <span className="flow-step__mark">
                {done ? <Check size={13} strokeWidth={3} /> : <span>{module.step}</span>}
              </span>
              <span className="flow-step__body">
                <span className="flow-step__top">
                  <Icon className="flow-step__icon" size={14} strokeWidth={1.9} />
                  <span className="flow-step__name">{module.name}</span>
                  {badge && <span className="flow-step__badge">{badge}</span>}
                </span>
                <span className="flow-step__desc">{module.tagline}</span>
              </span>
            </button>
          )
        })}
      </nav>

      <div className="sidebar__spacer" />

      <button className="sidebar__settings" type="button" onClick={onSettings} title="外观主题、背景图、每页张数与开发者选项">
        <Settings2 size={14} strokeWidth={1.9} />
        <span>设置</span>
        <span className="sidebar__settings-meta">更改您的YPW应用程式</span>
      </button>

      <WorkspaceCard shared={shared} />

      <div className="sidebar__foot">
        <span>{APP_VERSION_LABEL}</span>
        <span>{APP_PLATFORM}</span>
      </div>
    </aside>
  )
}
