import { useEffect, useRef, useState } from 'react'
import type { Term } from '../lib/exercise-types'
import { clipFor, playUrl, Recorder, stopAudio, type Recording } from '../lib/audio'
import { useApp } from '../lib/app-state'
import { backend } from '../lib/backend'
import { Ar } from '../components/Ar'
import { useAnalysis, Waveform } from '../components/Waveform'
import { Button, Icon } from '../components/ui'

const MAX_MS = 8000
const RATINGS = ['Hard', 'Okay', 'Easy'] as const

/**
 * Shadowing with comparison: hear the native clip, record yourself, then hear both back to back with the
 * two waveforms and pitch lines side by side. No automatic scoring: the student compares by ear and by eye.
 */
export function Shadow({ term, listenFor, lessonId, exerciseId, submit, onAnswer }: {
  term: Term; listenFor?: string; lessonId: string; exerciseId: string; submit?: 'optional' | 'required'
  onAnswer: (correct: null, response: unknown) => void
}) {
  const { user, settings } = useApp()
  const native = clipFor(term.ar)
  const nativeA = useAnalysis(native)
  const [rec, setRec] = useState<Recording | null>(null)
  const mineA = useAnalysis(rec?.blob)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState<{ which: 'native' | 'mine'; progress: number } | null>(null)
  const [rating, setRating] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const recorder = useRef<Recorder | null>(null)
  const stopTimer = useRef<number | null>(null)

  useEffect(() => () => { recorder.current?.cancel(); stopAudio() }, [])

  async function start() {
    setError(null)
    try {
      recorder.current = new Recorder()
      await recorder.current.start()
      setRecording(true)
      stopTimer.current = window.setTimeout(stop, MAX_MS)
    } catch {
      setError('Microphone not available. Allow microphone access for this site and try again.')
    }
  }
  async function stop() {
    if (stopTimer.current) clearTimeout(stopTimer.current)
    if (!recorder.current) return
    const r = await recorder.current.stop()
    recorder.current = null
    setRecording(false)
    setRec(r)
  }

  /** Play one clip and animate the progress over its waveform. */
  function play(which: 'native' | 'mine', then?: () => void) {
    const url = which === 'native' ? native : rec?.url
    if (!url) return then?.()
    const a = playUrl(url, { slow: which === 'native' && settings.slow, onEnd: () => { setPlaying(null); then?.() } })
    const tick = () => {
      if (a.paused && a.currentTime === 0) return requestAnimationFrame(tick)
      if (a.ended || a.paused) return
      setPlaying({ which, progress: a.duration ? a.currentTime / a.duration : 0 })
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }
  const compare = () => play('native', () => setTimeout(() => play('mine'), 350))

  async function send() {
    if (!user || !rec) return
    await backend.createSubmission(user.id, {
      lessonId, exerciseId, kind: 'recording', title: `Say ${term.tr ?? term.ar}`, target: term.ar,
      selfRating: rating ?? undefined, durationMs: rec.durationMs, mime: rec.mime,
    }, { audio: rec.blob })
    setSent(true)
  }

  const maxMs = Math.max(nativeA?.durationMs ?? 0, mineA?.durationMs ?? 0) || undefined

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-5">
      <Ar size="hero" tr={term.tr} en={term.en}>{term.ar}</Ar>
      {listenFor && <p className="rounded-xl bg-accent-soft px-3 py-1.5 text-center text-sm">Listen for: {listenFor}</p>}

      <div className="flex items-center gap-3">
        <button onClick={() => play('native')} className="flex h-12 items-center gap-2 rounded-full border border-line bg-card px-4 font-medium" aria-label="Listen to the model">
          {Icon.speaker} Listen
        </button>
        <button onClick={recording ? stop : start}
          className={`flex h-12 items-center gap-2 rounded-full px-5 font-medium text-on-brand shadow-lg transition ${recording ? 'animate-pulse bg-danger shadow-danger/30' : 'bg-brand shadow-brand/25'}`}>
          <span className={`size-3 rounded-full bg-current ${recording ? 'rounded-sm' : ''}`} />
          {recording ? 'Stop' : rec ? 'Record again' : 'Record'}
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}

      {rec && (
        <div className="pop-in w-full space-y-3 rounded-2xl bg-card p-4 ring-1 ring-line/70">
          <Waveform a={nativeA} tone="brand" label={native ? 'Model' : 'Model (no clip yet)'} maxMs={maxMs} progress={playing?.which === 'native' ? playing.progress : 0} />
          <Waveform a={mineA} tone="accent" label="You" maxMs={maxMs} progress={playing?.which === 'mine' ? playing.progress : 0} />
          <p className="text-xs text-muted">Bars show loudness, the line shows pitch. Time runs right to left.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={compare}>Play both</Button>
            <Button variant="ghost" onClick={() => play('mine')}>Just me</Button>
          </div>
        </div>
      )}

      {rec && (
        <div className="w-full space-y-3 text-center">
          <p className="font-medium">How close did it sound?</p>
          <div className="flex justify-center gap-2">
            {RATINGS.map((r) => (
              <button key={r} onClick={() => { setRating(r); onAnswer(null, { selfRating: r, durationMs: rec.durationMs }) }}
                className={`min-h-11 min-w-20 rounded-xl border-2 px-3 ${rating === r ? 'border-brand bg-brand-soft' : 'border-line bg-card'}`}>{r}</button>
            ))}
          </div>
          {submit && (sent
            ? <p className="text-sm text-success">Sent to your tutor. You'll get a note when it's reviewed.</p>
            : <Button variant={submit === 'required' ? 'primary' : 'ghost'} onClick={send}>Send to my tutor{submit === 'optional' ? ' (optional)' : ''}</Button>)}
        </div>
      )}
    </div>
  )
}
