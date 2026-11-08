import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../lib/app-state'
import { backend, type Annotations, type Feedback, type Submission, type SubmissionStatus } from '../lib/backend'
import { clipFor, playUrl } from '../lib/audio'
import { lessonById } from '../lib/course'
import { Sheet, type SheetData } from '../components/Sheet'
import { useAnalysis, Waveform } from '../components/Waveform'
import { Ar } from '../components/Ar'
import { Button, Card, Icon } from '../components/ui'

export function StatusChip({ status }: { status: SubmissionStatus }) {
  const s = {
    pending: ['Waiting for review', 'bg-accent-soft text-ink'],
    reviewed: ['Reviewed', 'bg-success-soft text-success'],
    needs_redo: ['Please try again', 'bg-danger-soft text-danger'],
  }[status]
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${s[1]}`}>{s[0]}</span>
}

/** Re-render when backend data changes (including from another tab). */
export function useBackendVersion() {
  const [v, setV] = useState(0)
  useEffect(() => backend.subscribe(() => setV((x) => x + 1)), [])
  return v
}

export function useFile(id: string | undefined, kind: 'audio' | 'strokes' | 'png') {
  const [f, setF] = useState<Blob | string | undefined>()
  useEffect(() => { if (id) backend.getSubmissionFile(id, kind).then(setF) }, [id, kind])
  return f
}

export function Thumb({ sub }: { sub: Submission }) {
  const png = useFile(sub.kind === 'sheet' ? sub.id : undefined, 'png')
  const url = useMemo(() => (png instanceof Blob ? URL.createObjectURL(png) : undefined), [png])
  if (sub.kind === 'recording') return <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">{Icon.headphones}</div>
  return url ? <img src={url} alt="" className="h-14 w-11 shrink-0 rounded-md object-cover object-top ring-1 ring-line" /> : <div className="h-14 w-11 shrink-0 rounded-md bg-card-2" />
}

export function MyWork() {
  const { user } = useApp()
  useBackendVersion()
  const subs = user ? backend.listSubmissions({ userId: user.id }).slice().reverse() : []
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">My work</h1>
        <p className="text-muted">Writing sheets and recordings you sent to your tutor. Feedback never blocks your progress.</p>
      </div>
      {subs.length === 0 && <Card><p className="text-muted">Nothing sent yet. Writing sheets and recordings in lessons have a "Send to my tutor" button.</p></Card>}
      {subs.map((s) => (
        <Link key={s.id} to={`/work/${s.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 transition hover:border-brand">
          <Thumb sub={s} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{s.title}</p>
            <p className="text-xs text-muted">{lessonById(s.lessonId)?.title} · {new Date(s.createdAt).toLocaleString()}</p>
          </div>
          <StatusChip status={s.status} />
        </Link>
      ))}
    </div>
  )
}

/** The student's view of one piece of work, with the tutor's feedback on it. */
export function WorkDetail() {
  const { id } = useParams()
  const { user } = useApp()
  useBackendVersion()
  const sub = id ? backend.getSubmission(id) : undefined
  if (!sub || !user || (sub.userId !== user.id && user.role === 'student')) return <p>Not found.</p>
  const feedback = backend.getFeedback(sub.id)
  const last = feedback[feedback.length - 1]
  return (
    <div className="space-y-4">
      <Link to="/work" className="text-sm text-muted hover:text-ink">← My work</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="me-auto text-2xl font-semibold">{sub.title}</h1>
        <StatusChip status={sub.status} />
      </div>
      {last ? (
        <Card className={last.status === 'needs_redo' ? 'border-danger/40' : 'border-success/40'}>
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">{last.reviewerName} · {new Date(last.createdAt).toLocaleString()}</p>
          <p className="mt-1 text-lg whitespace-pre-wrap">{last.note || (last.status === 'reviewed' ? 'Looks good.' : 'Please try this again.')}</p>
          {last.status === 'needs_redo' && <Link to={`/lesson/${sub.lessonId}`} className="mt-3 inline-block font-medium text-brand">Go back to the lesson to try again →</Link>}
        </Card>
      ) : <Card><p className="text-muted">Your tutor hasn't reviewed this yet. You'll get a notification when they do.</p></Card>}
      <SubmissionBody sub={sub} feedback={last} />
    </div>
  )
}

/** Renders the work itself with any annotations: sheet with red ink and pins, or recording with markers. */
export function SubmissionBody({ sub, feedback, annotations }: { sub: Submission; feedback?: Feedback; annotations?: Annotations }) {
  const a = annotations ?? feedback?.annotations
  const strokesFile = useFile(sub.kind === 'sheet' ? sub.id : undefined, 'strokes')
  const audio = useFile(sub.kind === 'recording' ? sub.id : undefined, 'audio')
  if (sub.kind === 'sheet') {
    if (typeof strokesFile !== 'string') return <p className="text-muted">Loading…</p>
    const data = JSON.parse(strokesFile) as SheetData
    return (
      <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
        <Sheet data={data} reviewInk={a?.ink ?? []} pins={a?.pins ?? []} className="w-full rounded-md shadow-lg ring-1 ring-line" />
        {a?.pins?.length ? (
          <ol className="space-y-2">
            {a.pins.map((p, i) => (
              <li key={i} className="flex gap-2 rounded-xl bg-card p-3 ring-1 ring-line/70">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-danger text-xs font-bold text-white">{i + 1}</span>
                <span className="text-sm">{p.text || '—'}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    )
  }
  return <RecordingView sub={sub} audio={audio instanceof Blob ? audio : undefined} markers={a?.markers ?? []} />
}

function RecordingView({ sub, audio, markers }: { sub: Submission; audio?: Blob; markers: { tMs: number; text: string }[] }) {
  const url = useMemo(() => (audio ? URL.createObjectURL(audio) : undefined), [audio])
  const mine = useAnalysis(audio)
  const nativeUrl = sub.target ? clipFor(sub.target) : undefined
  const native = useAnalysis(nativeUrl)
  const maxMs = Math.max(mine?.durationMs ?? 0, native?.durationMs ?? 0) || undefined
  return (
    <Card className="space-y-4">
      {sub.target && <div className="text-center"><Ar size="xl">{sub.target}</Ar></div>}
      <Waveform a={native} label="Model" maxMs={maxMs} />
      <Waveform a={mine} tone="accent" label="Recording" maxMs={maxMs} markers={markers} onSeek={(ms) => { if (url) { const el = playUrl(url); el.currentTime = ms / 1000 } }} />
      <div className="flex flex-wrap gap-2">
        {nativeUrl && <Button variant="ghost" onClick={() => playUrl(nativeUrl)}>Model</Button>}
        {url && <Button onClick={() => playUrl(url)}>Play recording</Button>}
        {sub.selfRating && <span className="self-center text-sm text-muted">Self-rating: {sub.selfRating}</span>}
      </div>
      {markers.length > 0 && (
        <ol className="space-y-2">
          {markers.map((m, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <button onClick={() => { if (url) { const el = playUrl(url); el.currentTime = m.tMs / 1000 } }} className="shrink-0 rounded-md bg-danger-soft px-2 font-mono text-danger">{(m.tMs / 1000).toFixed(1)}s</button>
              <span>{m.text}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
