import { useEffect, useState } from 'react'
import { decode, peaks, pitchContour } from '../lib/audio'

export type Analysis = { peaks: number[]; pitch: (number | null)[]; durationMs: number }

export function useAnalysis(src: Blob | string | undefined) {
  const [a, setA] = useState<Analysis | null>(null)
  useEffect(() => {
    let alive = true
    setA(null)
    if (!src) return
    decode(src)
      .then((b) => alive && setA({ peaks: peaks(b, 90), pitch: pitchContour(b, 60), durationMs: b.duration * 1000 }))
      .catch(() => alive && setA({ peaks: [], pitch: [], durationMs: 0 }))
    return () => { alive = false }
  }, [src])
  return a
}

/**
 * Waveform bars with the pitch line drawn over them. Time runs right-to-left, matching how Arabic is read.
 * `progress` (0..1) highlights what has played; markers are reviewer notes at a time.
 */
export function Waveform({ a, tone = 'brand', progress = 0, markers = [], label, onSeek, maxMs }: {
  a: Analysis | null; tone?: 'brand' | 'accent'; progress?: number; markers?: { tMs: number; text: string }[]
  label?: string; onSeek?: (ms: number) => void; maxMs?: number
}) {
  const W = 300, H = 64
  const color = tone === 'brand' ? 'var(--brand)' : 'var(--accent)'
  const scale = a && maxMs ? Math.min(1, a.durationMs / maxMs) : 1 // shared time axis for side-by-side comparison
  const width = W * scale
  const n = a?.peaks.length ?? 0
  const voiced = a?.pitch.filter((p): p is number => p !== null) ?? []
  const lo = Math.min(...voiced, 90), hi = Math.max(...voiced, 260)
  const x = (i: number, count: number) => W - (i / Math.max(1, count - 1)) * width

  return (
    <div className="w-full">
      {label && <p className="mb-1 text-xs font-medium text-muted">{label}</p>}
      <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full cursor-pointer" preserveAspectRatio="none"
        onClick={(e) => {
          if (!a || !onSeek) return
          const r = e.currentTarget.getBoundingClientRect()
          const frac = (r.right - e.clientX) / (r.width * scale)
          onSeek(Math.max(0, Math.min(1, frac)) * a.durationMs)
        }}>
        {!a && <rect x={0} y={H / 2 - 1} width={W} height={2} fill="var(--line)" />}
        {a?.peaks.map((p, i) => {
          const h = Math.max(2, p * (H - 8))
          const played = (i / n) < progress
          return <rect key={i} x={x(i, n) - width / n / 2} y={(H - h) / 2} width={Math.max(1, (width / n) * 0.6)} height={h} rx={1}
            fill={color} opacity={played ? 0.9 : 0.35} />
        })}
        {a && voiced.length > 2 && (
          <polyline fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
            points={a.pitch.map((p, i) => (p === null ? null : `${x(i, a.pitch.length)},${H - 6 - ((p - lo) / (hi - lo || 1)) * (H - 12)}`)).filter(Boolean).join(' ')} />
        )}
        {a && markers.map((m, i) => {
          const mx = W - (m.tMs / a.durationMs) * width
          return <g key={i}><line x1={mx} x2={mx} y1={0} y2={H} stroke="var(--danger)" strokeWidth={2} /><circle cx={mx} cy={6} r={5} fill="var(--danger)" /></g>
        })}
      </svg>
    </div>
  )
}
