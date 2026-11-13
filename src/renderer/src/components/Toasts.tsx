import { X } from 'lucide-react'

export interface ToastItem {
  id: string
  message: string
  tone: ToastTone
}

export type ToastTone = 'info' | 'success' | 'error' | 'warn'

export function ToastStack({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`toast toast--${item.tone}`}>
          <span className="toast__dot" />
          <span>{item.message}</span>
          <button className="toast__close" onClick={() => onDismiss(item.id)} aria-label="关闭提示">
            <X size={12} strokeWidth={2.2} />
          </button>
        </div>
      ))}
    </div>
  )
}
