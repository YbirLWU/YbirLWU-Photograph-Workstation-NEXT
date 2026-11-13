import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { PREVIEWABLE_EXTS, extLabel, isRawExt } from '@shared/media'
import { imageSrc } from '@/lib/bridge'

interface ThumbProps {
  file: { name: string; absPath: string; ext: string; previewUrl?: string }
  kind?: 'thumb' | 'preview' | 'full'
  className?: string
}

export function Thumb({ file, kind = 'thumb', className }: ThumbProps) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const raw = isRawExt(file.ext)
  const label = extLabel(file.ext)

  if (raw || !PREVIEWABLE_EXTS.has(file.ext) || state === 'failed') {
    return (
      <div
        className={`thumb-fallback${raw ? ' thumb-fallback--raw' : ''}${className ? ` ${className}` : ''}`}
        title={file.name}
      >
        {raw ? (
          <span className="thumb-fallback__label">{label}</span>
        ) : (
          <>
            <ImageOff size={15} strokeWidth={1.6} />
            <span className="thumb-fallback__label">{label}</span>
          </>
        )}
      </div>
    )
  }

  return (
    <span className={`thumb${state === 'loading' ? ' thumb--loading' : ''}${className ? ` ${className}` : ''}`}>
      <img
        src={imageSrc(file, kind)}
        alt={file.name}
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={() => setState('ready')}
        onError={() => setState('failed')}
      />
    </span>
  )
}
