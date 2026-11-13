import type { ReactNode } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'

export function StageNext({
  hint,
  label,
  disabled,
  busy,
  onClick,
  children
}: {
  hint: ReactNode
  label: string
  disabled?: boolean
  busy?: boolean
  onClick: () => void
  children?: ReactNode
}) {
  return (
    <div className="stage-next">
      <div className="stage-next__hint">{hint}</div>
      <div className="stage-next__actions">
        {children}
        <button className="stage-next__cta" type="button" onClick={onClick} disabled={disabled || busy}>
          {busy ? <Loader2 size={15} className="spin" /> : null}
          {label}
          {!busy && <ArrowRight size={16} strokeWidth={2.4} />}
        </button>
      </div>
    </div>
  )
}