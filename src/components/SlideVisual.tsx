import type { Visual } from '../lib/course'
import { course, wordById } from '../lib/course'
import { markOnCarrier } from '../lib/arabic'
import { markStrokes } from '../lib/course'
import { LetterCard } from './LetterCard'
import { StrokeAnimator } from './StrokeAnimator'
import { useApp } from '../lib/app-state'
import { Ar } from './Ar'

const STEPS = ['Learn', 'Write', 'Listen', 'Read', 'Speak', 'Exercises']

/** `drawKey` > 0 means the narration has reached the draw cue (or there is none). `showThen` reveals `v.then`. */
export function SlideVisual({ v, lessonId, drawKey = 1, showThen = true }: { v: Visual; lessonId: string; drawKey?: number; showThen?: boolean }) {
  const then = v.then as Visual | undefined
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <Main v={v} lessonId={lessonId} drawKey={drawKey} />
      {then && showThen && <div className="pop-in"><Main v={then} lessonId={lessonId} drawKey={drawKey} /></div>}
    </div>
  )
}

function Main({ v, lessonId, drawKey }: { v: Visual; lessonId: string; drawKey: number }) {
  const { user } = useApp()
  const s = (k: string) => (v[k] as string | undefined) ?? undefined

  switch (v.type) {
    case 'arabic':
      return <Ar size="hero" tr={s('tr')} en={s('en')}>{s('ar')!}</Ar>

    case 'text':
      return <p className="max-w-md text-center text-xl leading-relaxed">{s('text')}</p>

    case 'skills':
      return (
        <div className="grid grid-cols-2 gap-3 text-center">
          {[['Read', 'اِقْرَأ'], ['Write', 'اُكْتُب'], ['Listen', 'اِسْمَع'], ['Speak', 'تَكَلَّم']].map(([en, ar]) => (
            <div key={en} className="rounded-2xl border border-line bg-paper px-6 py-4">
              <div className="font-semibold">{en}</div>
              <span lang="ar" dir="rtl" className="ar text-2xl text-muted">{ar}</span>
            </div>
          ))}
        </div>
      )

    case 'steps':
      return (
        <ol className="flex flex-wrap justify-center gap-2">
          {STEPS.map((x, i) => (
            <li key={x} className="rounded-full border border-line bg-paper px-4 py-2 text-sm"><span className="me-1 font-semibold text-brand">{i + 1}</span>{x}</li>
          ))}
        </ol>
      )

    case 'name':
      return (
        <div className="text-center">
          <p className="mb-2 text-muted">{user?.nameEn}</p>
          {user?.nameAr
            ? <Ar size="hero" tr={user.nameArTr}>{user.nameAr}</Ar>
            : <p className="rounded-2xl border border-dashed border-line px-6 py-8 text-muted">Your Arabic name appears here once your tutor has written it.</p>}
        </div>
      )

    case 'direction':
      return (
        <div className="flex flex-col items-center gap-4">
          <Ar size="hero">{s('ar') ?? 'بَيْت'}</Ar>
          <div className="relative h-2 w-64 overflow-hidden rounded-full bg-line" aria-label="Read from right to left">
            <div className="absolute inset-y-0 end-0 w-1/3 rounded-full bg-brand" style={{ animation: 'rtl-sweep 2s ease-in-out infinite' }} />
          </div>
          <p className="text-sm text-muted">right → left</p>
        </div>
      )

    case 'letter':
      return <LetterCard letter={s('letter')!} drawKey={drawKey} />

    case 'words': {
      const list = (v.words as { ar: string; tr?: string; en?: string }[]) ?? []
      return (
        <div className="flex flex-wrap justify-center gap-3" dir="rtl">
          {list.map((w) => {
            const known = course.words.find((x) => x.ar === w.ar)
            return <div key={w.ar} className="rounded-2xl border border-line bg-paper px-3 py-2" dir="ltr"><Ar size="lg" tr={w.tr ?? known?.tr} en={w.en ?? known?.en}>{w.ar}</Ar></div>
          })}
        </div>
      )
    }

    case 'mark': {
      const item = course.items.find((i) => i.id === s('mark'))
      const def = markStrokes(s('mark')!)
      return (
        <div className="flex flex-col items-center gap-3">
          <span className="text-lg font-semibold">{item?.name}</span>
          <div className="flex items-center gap-6">
            {def && drawKey > 0
              ? <StrokeAnimator def={def} playKey={drawKey} className="size-48 rounded-3xl border border-line bg-paper" />
              : <span lang="ar" dir="rtl" className="ar grid size-48 place-items-center rounded-3xl border border-line bg-paper text-8xl">{markOnCarrier(s('mark')!)}</span>}
          </div>
        </div>
      )
    }

    case 'readingSet': {
      const ids = course.readingSets[lessonId] ?? []
      if (!ids.length) return <p className="text-muted">No new words in this lesson. The next letters unlock more.</p>
      return (
        <div className="flex max-w-xl flex-wrap justify-center gap-3" dir="rtl">
          {ids.map((id) => {
            const w = wordById(id)!
            return (
              <div key={id} className={`rounded-2xl border px-3 py-2 ${w.concrete ? 'border-brand/40 bg-brand-soft/40' : 'border-line bg-paper'}`} dir="ltr">
                <Ar size="lg" tr={w.tr} en={w.en}>{w.ar}</Ar>
              </div>
            )
          })}
        </div>
      )
    }

    default:
      return <p className="text-muted">[{v.type}]</p>
  }
}
