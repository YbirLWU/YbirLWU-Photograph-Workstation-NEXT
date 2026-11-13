import { useMemo } from 'react'
import type { HistogramData } from '@shared/types'
import { peakOf, toAreaPath, toLinePath } from '@/lib/histogram'

export function Histogram({ data, height = 84 }: { data: HistogramData | null; height?: number }) {
  const paths = useMemo(() => {
    if (!data || data.samples === 0) return null
    const rgbPeak = peakOf(data.r, data.g, data.b)
    const lumaPeak = peakOf(data.l)
    return {
      r: toAreaPath(data.r, rgbPeak, height),
      g: toAreaPath(data.g, rgbPeak, height),
      b: toAreaPath(data.b, rgbPeak, height),
      l: toLinePath(data.l, lumaPeak, height)
    }
  }, [data, height])

  if (!paths) return <div className="histo histo--empty">直方图不可用</div>

  return (
    <div className="histo" aria-label="直方图">
      <svg viewBox={`0 0 256 ${height}`} preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id="histo-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <rect width="256" height={height} fill="url(#histo-bg)" />
        {[1, 2, 3].map((i) => (
          <line
            key={i}
            x1={(256 / 4) * i}
            x2={(256 / 4) * i}
            y1="0"
            y2={height}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        ))}
        <g style={{ mixBlendMode: 'screen' }}>
          <path d={paths.r} fill="#ef5350" opacity="0.55" />
          <path d={paths.g} fill="#66bb6a" opacity="0.55" />
          <path d={paths.b} fill="#42a5f5" opacity="0.6" />
        </g>
        <path d={paths.l} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.9" />
      </svg>
      <div className="histo__scale">
        <span>0</span>
        <span>128</span>
        <span>255</span>
      </div>
    </div>
  )
}
