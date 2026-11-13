import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface FolderPickerProps {
  label: string
  hint: string
  value: string
  icon: ReactNode
  tone: 'indigo' | 'teal'
  onPick: () => void
  onClear: () => void
  disabled?: boolean
}

const TONES = {
  indigo: { bg: '#eef0fe', fg: '#4f46e5', border: '#e0e2fb' },
  teal: { bg: '#e8f6f3', fg: '#0f766e', border: '#c3e7e0' }
}

export function FolderPicker({
  label,
  hint,
  value,
  icon,
  tone,
  onPick,
  onClear,
  disabled = false
}: FolderPickerProps) {
  const palette = TONES[tone]

  return (
    <div
      className={`picker${value ? ' is-set' : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      style={disabled ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
      onClick={() => {
        if (!disabled) onPick()
      }}
      onKeyDown={(event) => {
        if (disabled) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onPick()
        }
      }}
    >
      <span
        className="picker__icon"
        style={{ background: palette.bg, color: palette.fg, border: `1px solid ${palette.border}` }}
      >
        {icon}
      </span>
      <span className="picker__body">
        <span className="picker__label">{label}</span>
        <span className={`picker__value${value ? '' : ' picker__value--empty'}`} title={value}>
          {value || '点击选择文件夹'}
        </span>
        <span className="picker__meta">{value ? `期望后缀 ${hint}` : hint}</span>
      </span>
      {value && !disabled && (
        <button
          className="picker__clear"
          type="button"
          aria-label="清除选择"
          title="清除选择"
          onClick={(event) => {
            event.stopPropagation()
            onClear()
          }}
        >
          <X size={13} strokeWidth={2.2} />
        </button>
      )}
    </div>
  )
}
