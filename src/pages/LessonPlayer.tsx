import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { coveredItems, course, isUnlocked, lessonById, nextLesson, type Slide, type Step } from '../lib/course'
import type { Exercise } from '../lib/exercise-types'
import { useApp } from '../lib/app-state'
import { backend } from '../lib/backend'
import { markOnCarrier } from '../lib/arabic'
import { speak, stopSpeaking } from '../lib/speech'
import { LessonCtx, SectionCtx } from '../lib/lesson-context'
import { SlideVisual } from '../components/SlideVisual'
import { ExerciseHost } from '../exercises/Exercises'
import { Button, Icon, ThemeToggle } from '../components/ui'

const STEP_ORDER: Step['kind'][] = ['learn', 'write', 'listen', 'read', 'speak', 'exercises']
const STEP_LABEL: Record<Step['kind'], string> = { learn: 'Learn', write: 'Write', listen: 'Listen', read: 'Read', speak: 'Speak', exercises: 'Practice' }

/** Split narration into sentences: in narrated mode each sentence is one step of the section. */
const sentences = (t: string) => t.match(/[^.!?]+[.!?]+["'’”)]*\s*|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [t]

type Section =
  | { kind: 'slide'; step: Step['kind']; slide: Slide; beats: string[]; drawBeat: number; showBeat: number }
  | { kind: 'ex'; step: Step['kind']; ex: Exercise }
  | { kind: 'end'; step: Step['kind'] }

function beatOf(beats: string[], word?: string) {
  if (!word) return -1
  const i = beats.findIndex((b) => b.toLowerCase().includes(word.toLowerCase()))
  return i === -1 ? 0 : i
}

export function LessonPlayer() {
  const { id = '' } = useParams()
  const lesson = lessonById(id)
  const { user, completed, progress, saveProgress, settings, updateSettings } = useApp()
  const nav = useNavigate()
  const narrated = settings.narration

  const sections = useMemo<Section[]>(() => {
    if (!lesson) return []
    const steps = [...lesson.steps].sort((a, b) => STEP_ORDER.indexOf(a.kind) - STEP_ORDER.indexOf(b.kind))
    const list: Section[] = steps.flatMap((st) => [
      ...st.slides.map((slide) => {
        const beats = sentences(slide.narration)
        return {
          kind: 'slide' as const, step: st.kind, slide, beats,
          drawBeat: beatOf(beats, slide.cues?.find((c) => c.action === 'draw')?.at),
          showBeat: beatOf(beats, slide.cues?.find((c) => c.action === 'show')?.at),
        }
      }),
      ...st.exercises.map((ex) => ({ kind: 'ex' as const, step: st.kind, ex })),
    ])
    list.push({ kind: 'end', step: list[list.length - 1]?.step ?? 'learn' })
    return list
  }, [lesson])

  const saved = progress.find((p) => p.lessonId === id)
  const initial = saved && saved.status !== 'completed' ? Math.min(saved.lastSlide, sections.length - 1) : 0
  // pos = section in focus + narrated step within it
  const [pos, setPos] = useState({ sec: initial, beat: 0 })
  const [playing, setPlaying] = useState(false)
  const [activations, setActivations] = useState<Record<number, number>>({ [initial]: 1 })
  const [done, setDone] = useState<string[] | null>(null)
  const [score, setScore] = useState({ right: 0, total: 0 })
  const scroller = useRef<HTMLDivElement>(null)
  const refs = useRef<(HTMLElement | null)[]>([])
  const programmatic = useRef(0)

  const unitOrder = lesson ? course.units.find((u) => lesson.id.startsWith(u.id + '-'))?.order ?? null : null
  const taught = useMemo(() => {
    const s = coveredItems(completed)
    lesson?.teaches.forEach((t) => s.add(t))
    return s
  }, [completed, lesson])

  const goTo = useCallback((i: number) => {
    const el = refs.current[Math.max(0, Math.min(sections.length - 1, i))]
    if (!el) return
    programmatic.current = Date.now()
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [sections.length])

  // Start at the saved section.
  useLayoutEffect(() => { refs.current[initial]?.scrollIntoView({ block: 'center' }) }, [initial])

  // The section crossing the middle of the screen is the one in focus.
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        const i = Number((e.target as HTMLElement).dataset.idx)
        setPos((p) => (p.sec === i ? p : { sec: i, beat: 0 }))
      }
    }, { root: scroller.current, rootMargin: '-45% 0px -45% 0px' })
    refs.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [sections.length])

  // On focus change: save the place, replay the section's animation.
  useEffect(() => {
    if (!lesson) return
    if (sections[pos.sec]?.kind !== 'end') saveProgress({ lessonId: lesson.id, status: 'in_progress', lastSlide: pos.sec })
    setActivations((a) => ({ ...a, [pos.sec]: (a[pos.sec] ?? 0) + 1 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.sec])

  // Narrated playback: speak the current step, then move to the next step or section.
  useEffect(() => {
    if (!narrated || !playing) return
    const s = sections[pos.sec]
    if (!s || s.kind !== 'slide') return // exercises wait for the student
    speak(s.beats[pos.beat] ?? '', 'en', {
      onEnd: () => {
        if (pos.beat < s.beats.length - 1) setPos((p) => (p.sec === pos.sec ? { ...p, beat: p.beat + 1 } : p))
        else setTimeout(() => goTo(pos.sec + 1), 500)
      },
    })
    return () => stopSpeaking()
  }, [narrated, playing, pos, sections, goTo])

  useEffect(() => { if (!narrated) { setPlaying(false); stopSpeaking() } }, [narrated])
  useEffect(() => () => stopSpeaking(), [])

  // Keyboard: up/down moves between sections.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); goTo(pos.sec + 1) }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goTo(pos.sec - 1) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [pos.sec, goTo])

  if (!lesson) return <Navigate to="/" />
  if (!isUnlocked(lesson.id, completed)) return <Navigate to="/" />

  const cur = sections[pos.sec]
  const beatsHere = cur?.kind === 'slide' ? cur.beats.length : 1

  function stepFwd() {
    if (cur?.kind === 'slide' && pos.beat < cur.beats.length - 1) setPos((p) => ({ ...p, beat: p.beat + 1 }))
    else goTo(pos.sec + 1)
  }
  function stepBack() {
    if (pos.beat > 0) setPos((p) => ({ ...p, beat: p.beat - 1 }))
    else goTo(pos.sec - 1)
  }
  function complete() {
    stopSpeaking()
    const before = coveredItems(completed)
    saveProgress({ lessonId: lesson!.id, status: 'completed', lastSlide: 0, completedAt: new Date().toISOString() })
    setDone(lesson!.teaches.filter((t) => !before.has(t)))
  }

  if (done) {
    const nxt = nextLesson(lesson.id)
    const items = course.items.filter((it) => done.includes(it.id) && it.group !== 'mechanics')
    return (
      <div className="fixed inset-0 z-30 grid place-items-center bg-paper p-6" style={{ backgroundImage: 'var(--glow)' }}>
        <div className="max-w-md space-y-6 text-center">
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">Lesson completed</p>
          <h1 className="text-3xl font-semibold">{lesson.title}</h1>
          {items.length > 0 && (
            <div>
              <p className="mb-3 text-muted">New tiles on your letter table</p>
              <div className="flex flex-wrap justify-center gap-3" style={{ perspective: 600 }}>
                {items.map((it, k) => (
                  <div key={it.id} className="tile-reveal grid size-20 place-items-center rounded-2xl bg-brand text-on-brand shadow-lg shadow-brand/20" style={{ animationDelay: `${k * 200}ms` }}>
                    <span lang="ar" dir="rtl" className="ar text-4xl">{it.glyph ?? (it.mark ? markOnCarrier(it.mark) : '')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-center gap-2">
            <Button variant="ghost" onClick={() => nav('/')}>Course map</Button>
            {nxt && <Button onClick={() => { setDone(null); nav(`/lesson/${nxt.id}`) }}>Next: {nxt.title}</Button>}
          </div>
        </div>
      </div>
    )
  }

  const presentSteps = new Set(sections.filter((s) => s.kind !== 'end').map((s) => s.step))

  return (
    <LessonCtx.Provider value={{ unitOrder }}>
      <div className="fixed inset-0 z-30 flex flex-col bg-paper" style={{ backgroundImage: 'var(--glow)' }}>
        {/* Top bar */}
        <header className="z-10 border-b border-line/60 bg-paper/75 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl items-center gap-2 px-3 py-2">
            <Link to="/" onClick={() => stopSpeaking()} className="grid size-10 place-items-center rounded-xl text-muted hover:bg-card-2 hover:text-ink" aria-label="Close lesson">{Icon.close}</Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{lesson.title}</p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${(pos.sec / Math.max(1, sections.length - 1)) * 100}%` }} />
              </div>
            </div>
            <div className="flex rounded-xl bg-card-2 p-1 text-sm" role="radiogroup" aria-label="Lesson mode">
              {([[false, 'Read', Icon.book], [true, 'Narrated', Icon.headphones]] as const).map(([v, label, icon]) => (
                <button key={label} role="radio" aria-checked={narrated === v} onClick={() => updateSettings({ narration: v })}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition ${narrated === v ? 'bg-card text-ink shadow-sm' : 'text-muted'}`}>
                  {icon}<span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            <ThemeToggle />
          </div>
          <nav className="no-scrollbar mx-auto flex max-w-4xl gap-1 overflow-x-auto px-3 pb-2" aria-label="Lesson parts">
            {STEP_ORDER.filter((st) => presentSteps.has(st)).map((st) => (
              <button key={st} onClick={() => goTo(sections.findIndex((s) => s.step === st))}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${cur?.step === st && cur.kind !== 'end' ? 'bg-brand-soft text-brand' : 'text-muted hover:text-ink'}`}>
                {STEP_LABEL[st]}
              </button>
            ))}
          </nav>
        </header>

        {/* Sections */}
        <div ref={scroller} className="flex-1 snap-y snap-proximity overflow-y-auto scroll-smooth">
          <div className="h-[30dvh]" />
          {sections.map((s, i) => {
            const active = i === pos.sec
            const firstOfStep = i === 0 || sections[i - 1].step !== s.step
            return (
              <section key={i} data-idx={i} ref={(el) => { refs.current[i] = el }}
                onClick={active ? undefined : () => goTo(i)}
                className={`mx-auto flex min-h-[56dvh] max-w-2xl snap-center flex-col justify-center px-5 py-8 transition-[opacity,filter,transform] duration-500 ease-out ${active ? 'opacity-100' : 'cursor-pointer opacity-30 blur-[1.5px] saturate-50 scale-[0.97] select-none'}`}
                aria-current={active ? 'step' : undefined}>
                <SectionCtx.Provider value={{ active }}>
                  <div className={active ? '' : 'pointer-events-none'}>
                    {firstOfStep && s.kind !== 'end' && <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-accent uppercase">{STEP_LABEL[s.step]}</p>}
                    {s.kind === 'slide' && (
                      <SlideSection s={s} active={active} narrated={narrated} beat={active ? pos.beat : 0} playKey={activations[i] ?? 0} lessonId={lesson.id} />
                    )}
                    {s.kind === 'ex' && (
                      <ExerciseHost ex={s.ex} taught={taught} lessonId={lesson.id}
                        onAnswered={(correct, response) => {
                          if (user) backend.logAttempt(user.id, { lessonId: lesson.id, exerciseId: s.ex.id, type: s.ex.type, correct, response })
                          if (correct !== null) setScore((sc) => ({ right: sc.right + (correct ? 1 : 0), total: sc.total + 1 }))
                        }}
                        onContinue={() => goTo(i + 1)} />
                    )}
                    {s.kind === 'end' && (
                      <div className="space-y-4 text-center">
                        <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">The end</p>
                        <h2 className="text-3xl font-semibold">You made it through {lesson.title.toLowerCase()}.</h2>
                        {score.total > 0 && <p className="text-muted">{score.right} of {score.total} checked answers right. Mistakes go into your review list; they never hold you back.</p>}
                        <Button onClick={complete} className="px-8">Completed</Button>
                      </div>
                    )}
                  </div>
                </SectionCtx.Provider>
              </section>
            )
          })}
          <div className="h-[30dvh]" />
        </div>

        {/* Narrated mode player */}
        {narrated && (
          <div className="border-t border-line/60 bg-paper/80 backdrop-blur-md">
            <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2.5">
              <button onClick={stepBack} className="grid size-11 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink" aria-label="Previous step">{Icon.skipBack}</button>
              <button onClick={() => setPlaying((p) => { if (p) stopSpeaking(); return !p })}
                className="grid size-14 place-items-center rounded-full bg-brand text-on-brand shadow-lg shadow-brand/25 transition active:scale-95" aria-label={playing ? 'Pause' : 'Play'}>
                <span className="scale-125">{playing ? Icon.pause : Icon.play}</span>
              </button>
              <button onClick={stepFwd} className="grid size-11 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-ink" aria-label="Next step">{Icon.skipFwd}</button>
              <div className="ms-1 min-w-0 flex-1">
                <div className="flex gap-1">
                  {Array.from({ length: beatsHere }, (_, k) => <span key={k} className={`h-1.5 flex-1 rounded-full transition ${k <= pos.beat ? 'bg-brand' : 'bg-line'}`} />)}
                </div>
                <p className="mt-1 truncate text-xs text-muted">
                  {cur?.kind === 'ex' ? 'Your turn. Answer, then Continue.' : cur?.kind === 'end' ? 'End of lesson' : `Step ${pos.beat + 1} of ${beatsHere}`}
                </p>
              </div>
              <button onClick={() => updateSettings({ slow: !settings.slow })} className={`grid size-10 place-items-center rounded-full ${settings.slow ? 'bg-brand-soft text-brand' : 'text-muted'}`} title="Slow Arabic audio" aria-label="Slow Arabic audio">{Icon.slow}</button>
            </div>
          </div>
        )}
      </div>
    </LessonCtx.Provider>
  )
}

/** A teaching section. Read mode: everything shown. Narrated mode: sentences and visuals appear step by step. */
function SlideSection({ s, active, narrated, beat, playKey, lessonId }: {
  s: Extract<Section, { kind: 'slide' }>; active: boolean; narrated: boolean; beat: number; playKey: number; lessonId: string
}) {
  const stepped = narrated && active
  const [heading, ...rest] = s.beats
  const drawKey = !stepped ? playKey : s.drawBeat === -1 || beat >= s.drawBeat ? playKey * 100 + Math.max(0, s.drawBeat) : 0
  const showThen = !stepped || s.showBeat === -1 || beat >= s.showBeat
  const sentenceCls = (k: number) => !stepped ? '' : k < beat ? 'text-ink/70' : k === beat ? 'text-ink' : 'opacity-0'

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className={`text-2xl leading-snug font-semibold text-balance transition-opacity duration-300 sm:text-3xl ${sentenceCls(0)}`}>{heading}</h2>
        {rest.length > 0 && (
          <p className="text-lg leading-relaxed text-muted">
            {rest.map((t, k) => <span key={k} className={`transition-opacity duration-300 ${sentenceCls(k + 1)} ${stepped && k + 1 === beat ? 'rounded bg-accent-soft/70 box-decoration-clone px-0.5' : ''}`}>{t} </span>)}
          </p>
        )}
      </div>
      <div className="rounded-3xl bg-card/70 p-4 shadow-[0_1px_0_var(--line),0_12px_40px_-24px_rgb(0_0_0/0.25)] ring-1 ring-line/60 sm:p-8">
        <SlideVisual v={s.slide.visual} lessonId={lessonId} drawKey={drawKey} showThen={showThen} />
      </div>
    </div>
  )
}
