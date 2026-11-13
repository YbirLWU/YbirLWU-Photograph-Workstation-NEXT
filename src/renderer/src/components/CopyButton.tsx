import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ClipboardCopy } from 'lucide-react'
import { api, errorText } from '@/lib/bridge'

type Tone = 'success' | 'info'

interface CopyButtonProps {
  text: string | (() => string | Promise<string>)
  label?: string
  copiedLabel?: string
  className?: string
  title?: string
  tone?: Tone
  onCopied?: (message: string) => void
  onError?: (message: string) => void
  showIcon?: boolean
  children?: React.ReactNode
}

export function CopyButton({
  text,
  label = '复制',
  copiedLabel = '已复制',
  className,
  title,
  onCopied,
  onError,
  showIcon = true,
  children
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const run = useCallback(async () => {
    try {
      const value = typeof text === 'function' ? await text() : text
      if (!value) throw new Error('没有可复制的内容')
      await api.clipboard.write(value)
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1600)
      onCopied?.('已复制到剪贴板')
    } catch (error) {
      onError?.(errorText(error))
    }
  }, [text, onCopied, onError])
  return (
    <button
      className={`${className ?? 'btn btn--sm'}${copied ? ' is-copied' : ''}`}
      type="button"
      title={title ?? '复制到剪贴板'}
      onClick={() => void run()}
      aria-live="polite"
    >
      {showIcon && (copied ? <Check size={12} strokeWidth={2.8} /> : <ClipboardCopy size={12} strokeWidth={1.9} />)}
      {copied ? copiedLabel : (children ?? label)}
    </button>
  )
}