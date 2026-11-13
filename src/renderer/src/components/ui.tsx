import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { JPG_EXTS, formatName, isRawExt } from '@shared/media'

export function StatusPill({
  tone = 'idle',
  children
}: {
  tone?: 'idle' | 'ok' | 'warn' | 'busy' | 'accent'
  children: ReactNode
}) {
  return (
    <span className={`status-pill${tone === 'idle' ? '' : ` status-pill--${tone}`}`}>
      <span className="status-pill__dot" />
      {children}
    </span>
  )
}

export function StepCard({
  index,
  title,
  desc,
  locked = false,
  extra,
  children
}: {
  index: string
  title: string
  desc?: string
  locked?: boolean
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={`step${locked ? ' step--muted step--locked' : ''}`}>
      <div className="step__head">
        <span className={`step__num${locked ? ' step__num--locked' : ''}`}>{index}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="step__title">
            {title}
            {extra}
          </div>
          {desc && <p className="step__desc">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export function Stat({
  value,
  label,
  tone
}: {
  value: ReactNode
  label: string
  tone?: 'accent' | 'ok' | 'warn'
}) {
  return (
    <div className={`stat${tone ? ` stat--${tone}` : ''}`}>
      <div className="stat__value">{value}</div>
      <div className="stat__label">{label}</div>
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: Array<{ value: T; label: ReactNode; title?: string }>
  onChange: (value: T) => void
}) {
  return (
    <div className="seg" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          title={option.title}
          aria-selected={option.value === value}
          className={`seg__item${option.value === value ? ' is-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function ExtBadge({ ext }: { ext: string }) {
  const label = ext ? ext.replace('.', '').toUpperCase().slice(0, 4) : '—'
  const tone = isRawExt(ext) ? 'raw' : JPG_EXTS.has(ext.toLowerCase()) ? 'jpg' : 'other'
  return (
    <span className={`ext-badge ext-badge--${tone}`} title={formatName(ext)}>
      {label}
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  desc,
  actions
}: {
  icon: ReactNode
  title: string
  desc?: string
  actions?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty__icon">{icon}</div>
      <div className="empty__title">{title}</div>
      {desc && <p className="empty__desc">{desc}</p>}
      {actions && <div className="empty__actions">{actions}</div>}
    </div>
  )
}

export function Modal({
  open,
  title,
  desc,
  width,
  closable = true,
  onClose,
  children,
  footer
}: {
  open: boolean
  title: ReactNode
  desc?: ReactNode
  width?: number
  closable?: boolean
  onClose?: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open || !closable || !onClose) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closable, onClose])

  if (!open) return null
  return createPortal(
    <div className="modal-layer">
      <div className="modal-scrim" onClick={() => closable && onClose?.()} />
      <div className="modal" style={width ? { width } : undefined} role="dialog" aria-modal>
        <div className="modal__head">
          <div className="modal__title">{title}</div>
          {closable && onClose && (
            <button className="icon-btn icon-btn--close" type="button" onClick={onClose} title="关闭">
              <X size={14} />
            </button>
          )}
        </div>
        {desc && <div className="modal__desc">{desc}</div>}
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

export function Meter({ percent, tone }: { percent: number; tone?: 'accent' | 'ok' }) {
  const value = Math.max(0, Math.min(100, percent))
  return (
    <div className="meter">
      <div className={`meter__bar${tone ? ` meter__bar--${tone}` : ''}`} style={{ width: `${value}%` }} />
    </div>
  )
}
