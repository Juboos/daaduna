import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Exercise, Term } from '../lib/exercise-types'
import { baseLetters, compareAnswer, contextualForms, letterForm } from '../lib/arabic'
import { speak } from '../lib/speech'
import { useApp } from '../lib/app-state'
import { markStrokes, strokesFor } from '../lib/course'
import { Ar } from '../components/Ar'
import { Tracer } from '../components/Tracer'
import { WordBuilder } from '../components/WordBuilder'
import { ArabicKeyboard } from '../components/ArabicKeyboard'
import { Button, Icon } from '../components/ui'
import { useSection } from '../lib/lesson-context'
import { Shadow } from './Shadow'
import { SheetExercise } from './SheetExercise'

type Answer = (correct: boolean | null, response?: unknown, reveal?: ReactNode) => void
type P<T extends Exercise['type']> = { ex: Extract<Exercise, { type: T }>; onAnswer: Answer; taught: Set<string> }

const HINTS: Record<string, string> = {
  hamza_seat: 'Close. Check the hamza and its seat.',
  ta_marbuta: 'Close. Check the ending: ة or ه?',
  alif_maqsura: 'Close. Check the ending: ى or ي?',
}

function PlayButton({ ar, auto = true, label = 'Listen' }: { ar: string; auto?: boolean; label?: string }) {
  const { settings } = useApp()
  const { active } = useSection()
  const play = useCallback((slow = settings.slow) => speak(ar, 'ar', { slow }), [ar, settings.slow])
  // Auto-play only when this section comes into focus.
  useEffect(() => { if (auto && active) { const t = setTimeout(() => play(), 450); return () => clearTimeout(t) } }, [ar, auto, active, play])
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => play()} className="flex size-20 items-center justify-center rounded-full bg-brand text-on-brand shadow-md active:scale-95" aria-label={label}>
        <span className="scale-150">{Icon.speaker}</span>
      </button>
      <button onClick={() => play(true)} className="flex size-12 items-center justify-center rounded-full border border-line bg-card text-muted" aria-label="Listen slowly">{Icon.slow}</button>
    </div>
  )
}

function Choice({ children, state, onClick, disabled }: { children: ReactNode; state?: 'right' | 'wrong' | null; onClick: () => void; disabled?: boolean }) {
  const cls = state === 'right' ? 'border-success bg-success-soft' : state === 'wrong' ? 'border-danger bg-danger-soft' : 'border-line bg-card hover:border-brand'
  return <button disabled={disabled} onClick={onClick} className={`min-h-20 min-w-24 rounded-2xl border-2 px-4 py-2 transition ${cls}`}>{children}</button>
}

function ListenPick({ ex, onAnswer }: P<'listenPick'>) {
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <div className="flex flex-col items-center gap-6">
      <PlayButton ar={ex.answer.ar} />
      <div className="flex flex-wrap justify-center gap-3" dir="rtl">
        {ex.options.map((o) => (
          <Choice key={o.ar} disabled={!!picked} state={picked ? (o.ar === ex.answer.ar ? 'right' : o.ar === picked ? 'wrong' : null) : null}
            onClick={() => { setPicked(o.ar); onAnswer(o.ar === ex.answer.ar, o.ar, <>It was <Ar size="sm" tr={ex.answer.tr} en={ex.answer.en}>{ex.answer.ar}</Ar></>) }}>
            <Ar size="lg" hear={false}>{o.ar}</Ar>
          </Choice>
        ))}
      </div>
    </div>
  )
}

function SoundPick({ ex, onAnswer }: P<'soundPick'>) {
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <div className="flex flex-col items-center gap-6">
      <PlayButton ar={ex.answer} />
      {ex.listenFor && <p className="max-w-sm text-center text-sm text-muted">Listen for: {ex.listenFor}</p>}
      <div className="flex flex-wrap justify-center gap-3" dir="rtl">
        {ex.options.map((o) => (
          <Choice key={o} disabled={!!picked} state={picked ? (o === ex.answer ? 'right' : o === picked ? 'wrong' : null) : null}
            onClick={() => { setPicked(o); onAnswer(o === ex.answer, o, <>It was <Ar size="sm">{ex.answer}</Ar></>) }}>
            <Ar size="xl" hear={false}>{o}</Ar>
          </Choice>
        ))}
      </div>
    </div>
  )
}

function Match({ ex, onAnswer }: P<'match'>) {
  const english = useMemo(() => [...ex.pairs].sort((a, b) => (a.en ?? '').localeCompare(b.en ?? '')), [ex.pairs])
  const [selAr, setSelAr] = useState<string | null>(null)
  const [done, setDone] = useState<string[]>([])
  const [wrong, setWrong] = useState<string | null>(null)
  const [mistakes, setMistakes] = useState(0)
  function tryPair(en: Term) {
    if (!selAr) return
    if (en.ar === selAr) {
      const next = [...done, selAr]
      setDone(next); setSelAr(null)
      if (next.length === ex.pairs.length) onAnswer(mistakes === 0, { mistakes }, <>All matched, with {mistakes === 1 ? 'one slip' : `${mistakes} slips`} on the way.</>)
    } else { setWrong(en.ar); setMistakes((m) => m + 1); setTimeout(() => setWrong(null), 600) }
  }
  return (
    <div className="grid w-full max-w-md grid-cols-2 gap-3">
      <div className="space-y-2">
        {english.map((t) => (
          <button key={t.ar} disabled={done.includes(t.ar)} onClick={() => tryPair(t)}
            className={`min-h-16 w-full rounded-2xl border-2 px-3 ${done.includes(t.ar) ? 'border-transparent bg-success-soft text-muted' : wrong === t.ar ? 'border-accent' : 'border-line bg-card'}`}>{t.en}</button>
        ))}
      </div>
      <div className="space-y-2">
        {ex.pairs.map((t) => (
          <button key={t.ar} disabled={done.includes(t.ar)} onClick={() => { setSelAr(t.ar); speak(t.ar, 'ar') }}
            className={`min-h-16 w-full rounded-2xl border-2 ${done.includes(t.ar) ? 'border-transparent bg-success-soft' : selAr === t.ar ? 'border-brand' : 'border-line bg-card'}`}>
            <Ar size="md" hear={false}>{t.ar}</Ar>
          </button>
        ))}
      </div>
    </div>
  )
}

function TrueFalse({ ex, onAnswer }: P<'trueFalse'>) {
  const [picked, setPicked] = useState<boolean | null>(null)
  return (
    <div className="flex flex-col items-center gap-6">
      <Ar size="hero">{ex.ar}</Ar>
      <p className="text-lg">{ex.claim}</p>
      <div className="flex gap-3">
        {[true, false].map((v) => (
          <Choice key={String(v)} disabled={picked !== null} state={picked === null ? null : v === ex.answer ? 'right' : v === picked ? 'wrong' : null}
            onClick={() => { setPicked(v); onAnswer(v === ex.answer, v) }}>{v ? 'True' : 'False'}</Choice>
        ))}
      </div>
    </div>
  )
}

function Flashcards({ ex, onAnswer }: P<'flashcards'>) {
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const c = ex.cards[i]
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted">{i + 1} / {ex.cards.length}</p>
      <button onClick={() => { setFlipped((f) => !f); if (!flipped) speak(c.ar, 'ar') }} className="pop-in flex min-h-56 w-64 flex-col items-center justify-center gap-2 rounded-3xl border border-line bg-card p-6 shadow-sm" key={i + String(flipped)}>
        <span lang="ar" dir="rtl" className="ar text-6xl">{c.ar}</span>
        {flipped ? <><span className="italic text-muted">{c.tr}</span><span className="text-lg">{c.en}</span></> : <span className="text-sm text-muted">Read it, then tap to check</span>}
      </button>
      {flipped && (
        <Button onClick={() => { if (i + 1 < ex.cards.length) { setI(i + 1); setFlipped(false) } else onAnswer(null, { seen: ex.cards.length }) }}>
          {i + 1 < ex.cards.length ? 'Next card' : 'Done'}
        </Button>
      )}
    </div>
  )
}

function FillBlank({ ex, onAnswer }: P<'fillBlank'>) {
  const letters = baseLetters(ex.word.ar)
  const forms = contextualForms(letters)
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <div className="flex flex-col items-center gap-6">
      {picked ? <Ar size="hero" tr={ex.word.tr} en={ex.word.en}>{ex.word.ar}</Ar> : (
        <div className="flex items-end gap-1" dir="rtl">
          {letters.map((c, i) => i === ex.blank
            ? <span key={i} className="grid h-20 w-14 place-items-center rounded-xl border-2 border-dashed border-brand text-3xl text-brand">?</span>
            : <span key={i} lang="ar" className="ar text-6xl">{letterForm(c, forms[i])}</span>)}
        </div>
      )}
      {!picked && ex.word.en && <p className="text-muted">{ex.word.en}</p>}
      <div className="flex gap-3" dir="rtl">
        {ex.options.map((o) => (
          <Choice key={o} disabled={!!picked} state={picked ? (o === letters[ex.blank] ? 'right' : o === picked ? 'wrong' : null) : null}
            onClick={() => { setPicked(o); onAnswer(o === letters[ex.blank], o) }}>
            <Ar size="xl" hear={false}>{o}</Ar>
          </Choice>
        ))}
      </div>
    </div>
  )
}

function Order({ ex, onAnswer }: P<'order'>) {
  const shuffled = useMemo(() => [...ex.items].map((x, i) => ({ x, i })).sort((a, b) => ((a.i * 7 + 3) % 5) - ((b.i * 7 + 3) % 5)), [ex.items])
  const [seq, setSeq] = useState<number[]>([])
  const [result, setResult] = useState<boolean | null>(null)
  const digits = ex.items.every((s) => /^[٠-٩]+$/.test(s))
  return (
    <div className="flex flex-col items-center gap-6">
      {ex.hint && <p className="text-sm text-muted">{ex.hint}</p>}
      <div className={`flex min-h-24 min-w-64 flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-3 ${result ? 'border-success bg-success-soft' : result === false ? 'border-danger' : 'border-line'}`} dir={digits ? 'ltr' : 'rtl'}>
        {seq.map((i) => <button key={i} onClick={() => result === null && setSeq(seq.filter((x) => x !== i))} className="ar rounded-xl bg-card px-3 text-4xl shadow-sm">{shuffled.find((s) => s.i === i)!.x}</button>)}
      </div>
      <div className="flex flex-wrap justify-center gap-2" dir={digits ? 'ltr' : 'rtl'}>
        {shuffled.filter((s) => !seq.includes(s.i)).map((s) => (
          <button key={s.i} onClick={() => { speak(s.x, 'ar'); setSeq([...seq, s.i]) }} className="ar min-h-16 min-w-16 rounded-2xl border border-line bg-card px-3 text-4xl">{s.x}</button>
        ))}
      </div>
      {result === null && <Button disabled={seq.length !== ex.items.length} onClick={() => { const ok = seq.every((v, k) => v === k); setResult(ok); onAnswer(ok, seq) }}>Check</Button>}
      {result === false && <Button variant="ghost" onClick={() => { setSeq([]); setResult(null) }}>Try again</Button>}
    </div>
  )
}

function Trace({ ex, onAnswer }: P<'trace'>) {
  const def = ex.mark ? markStrokes(ex.mark) : strokesFor(ex.letter!, ex.form)
  const [answered, setAnswered] = useState(false)
  if (!def) return <p className="text-muted">No stroke data yet for this shape.</p>
  return <Tracer key={ex.id} def={def} onResult={(r) => { if (!answered || r.ok) { setAnswered(true); onAnswer(r.ok, { problems: r.problems.map((p) => p.kind) }) } }} />
}

function Build({ ex, onAnswer }: P<'build'>) {
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex items-center gap-3"><PlayButton ar={ex.word.ar} auto={false} />{ex.word.en && <span className="text-lg">{ex.word.en}</span>}</div>
      <WordBuilder word={ex.word.ar} distractors={ex.distractors} onResult={(ok, r) => onAnswer(ok, r)} />
    </div>
  )
}

function Dictation({ ex, onAnswer, taught }: P<'dictation'>) {
  const [text, setText] = useState('')
  const [res, setRes] = useState<ReturnType<typeof compareAnswer> | null>(null)
  const [tries, setTries] = useState(0)
  const onKey = useCallback((c: string) => !res?.ok && setText((t) => t + c), [res])
  const onBack = useCallback(() => !res?.ok && setText((t) => [...t].slice(0, -1).join('')), [res])
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <PlayButton ar={ex.word.ar} />
      <div className={`flex min-h-20 w-full max-w-sm items-center justify-center rounded-2xl border-2 bg-card px-4 ${res?.ok ? 'border-success' : res ? 'border-danger' : 'border-line'}`} dir="rtl">
        <span lang="ar" className="ar text-5xl">{text}</span><span className="ms-1 h-10 w-0.5 animate-pulse bg-brand" />
      </div>
      {res && !res.ok && <p className="text-sm">{res.hint ? HINTS[res.hint] : 'Not quite. Listen again and try.'}</p>}
      {!res?.ok && <Button disabled={!text.trim()} onClick={() => { const r = compareAnswer(text, ex.word.ar); setRes(r); setTries(tries + 1); onAnswer(r.ok, text, tries >= 1 ? <>It was <Ar size="sm" tr={ex.word.tr} en={ex.word.en}>{ex.word.ar}</Ar></> : <>Try once more.</>) }}>Check</Button>}
      <ArabicKeyboard taught={taught} onKey={onKey} onBackspace={onBack} />
      <p className="text-xs text-muted">Vowel marks are optional when you type.</p>
    </div>
  )
}

const PROMPTS: Record<Exercise['type'], string> = {
  listenPick: 'Listen and pick the word you hear.',
  soundPick: 'Which one do you hear?',
  match: 'Match each Arabic word to its meaning.',
  trueFalse: 'True or false?',
  flashcards: 'Read each card, then flip it.',
  fillBlank: 'Which letter is missing?',
  order: 'Put these in order.',
  trace: 'Trace the shape. Start at the numbered dot.',
  build: 'Build the word.',
  dictation: 'Listen and type what you hear.',
  shadow: 'Listen, record yourself, compare.',
  sheet: 'Writing sheet',
}

/** Runs one exercise. Feedback never blocks: Continue is always offered after an answer. */
export function ExerciseHost({ ex, taught, lessonId, onAnswered, onContinue }: { ex: Exercise; taught: Set<string>; lessonId: string; onAnswered: (correct: boolean | null, response: unknown) => void; onContinue: () => void }) {
  const [fb, setFb] = useState<{ correct: boolean | null; reveal?: ReactNode } | null>(null)
  const onAnswer: Answer = (correct, response, reveal) => {
    onAnswered(correct, response)
    setFb((f) => (f?.correct ? f : { correct, reveal }))
  }
  const props = { onAnswer, taught }
  const body = (() => {
    switch (ex.type) {
      case 'listenPick': return <ListenPick ex={ex} {...props} />
      case 'soundPick': return <SoundPick ex={ex} {...props} />
      case 'match': return <Match ex={ex} {...props} />
      case 'trueFalse': return <TrueFalse ex={ex} {...props} />
      case 'flashcards': return <Flashcards ex={ex} {...props} />
      case 'fillBlank': return <FillBlank ex={ex} {...props} />
      case 'order': return <Order ex={ex} {...props} />
      case 'trace': return <Trace ex={ex} {...props} />
      case 'build': return <Build ex={ex} {...props} />
      case 'dictation': return <Dictation ex={ex} {...props} />
      case 'shadow': return <Shadow term={ex.term} listenFor={ex.listenFor} submit={ex.submit} lessonId={lessonId} exerciseId={ex.id} onAnswer={onAnswer} />
      case 'sheet': return <SheetExercise ex={ex} lessonId={lessonId} onAnswer={onAnswer} />
    }
  })()
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <h2 className="text-center text-2xl font-semibold text-balance">{ex.prompt ?? PROMPTS[ex.type]}</h2>
      {body}
      {fb && (
        <div className={`pop-in flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 ${fb.correct === false ? 'bg-danger-soft' : 'bg-success-soft'}`}>
          <span className="flex-1">
            {fb.correct === true && <span className="font-medium text-success">Correct.</span>}
            {fb.correct === false && <span>Not quite. {fb.reveal}</span>}
            {fb.correct === null && <span className="text-success">Nice work.</span>}
          </span>
          <Button onClick={onContinue}>Continue</Button>
        </div>
      )}
    </div>
  )
}

