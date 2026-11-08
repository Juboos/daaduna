import { useState } from 'react'
import { useApp } from '../lib/app-state'
import { clean, stripMarks } from '../lib/arabic'
import { speak } from '../lib/speech'
import { translitMode, useLessonCtx } from '../lib/lesson-context'

type Props = {
  children: string
  tr?: string | null
  en?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero'
  hear?: boolean
  className?: string
}

const SIZES = { sm: 'text-xl', md: 'text-3xl', lg: 'text-5xl', xl: 'text-7xl', hero: 'text-7xl sm:text-8xl' }

/**
 * Every piece of Arabic renders through this component (PLAN.md §1.3).
 * Tap to hear; words light up as they are spoken (karaoke).
 */
export function Ar({ children, tr, en, size = 'md', hear = true, className = '' }: Props) {
  const { settings } = useApp()
  const { unitOrder } = useLessonCtx()
  const [active, setActive] = useState<number | null>(null) // index of word being spoken; -1 = whole
  const [revealTr, setRevealTr] = useState(false)
  const text = clean(children)
  const shown = settings.showVowels ? text : stripMarks(text)
  const words = shown.split(' ')
  const starts: number[] = []
  text.split(' ').forEach((_w, i, all) => starts.push(i === 0 ? 0 : starts[i - 1] + all[i - 1].length + 1))
  const mode = translitMode(settings, unitOrder)

  function play() {
    setActive(-1)
    speak(text, 'ar', {
      slow: settings.slow,
      onBoundary: (ci) => { const i = starts.findLastIndex((s) => s <= ci); if (i >= 0 && words.length > 1) setActive(i) },
      onEnd: () => setActive(null),
    })
  }

  const body = (
    <span lang="ar" dir="rtl" className={`ar ${SIZES[size]} text-ink`}>
      {words.map((w, i) => (
        <span key={i}>
          {i > 0 && ' '}
          <span className={`rounded-md transition-colors duration-150 ${active === i || (active === -1 && words.length === 1) ? 'bg-brand-soft text-brand' : ''}`}>{w}</span>
        </span>
      ))}
    </span>
  )
  return (
    <span className={`inline-flex flex-col items-center gap-0.5 ${className}`}>
      {hear ? (
        <button type="button" onClick={play} className="rounded-xl px-2 transition hover:bg-brand-soft/60 focus-visible:outline-2 focus-visible:outline-brand" aria-label={`Hear ${tr ?? 'this'}`}>
          {body}
        </button>
      ) : body}
      {tr && mode === 'show' && <span className="text-sm italic text-muted">{tr}</span>}
      {tr && mode === 'tap' && (revealTr
        ? <span className="text-sm italic text-muted">{tr}</span>
        : <button onClick={() => setRevealTr(true)} className="text-xs text-muted underline decoration-dotted">sounds like…</button>)}
      {en && <span className="text-sm text-muted">{en}</span>}
    </span>
  )
}
