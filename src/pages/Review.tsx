import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../lib/app-state'
import { backend, type Annotations, type SubmissionStatus } from '../lib/backend'
import { lessonById } from '../lib/course'
import type { Pt } from '../lib/paths'
import { SheetEditor } from '../components/SheetEditor'
import type { SheetData } from '../components/Sheet'
import { Button, Card } from '../components/ui'
import { StatusChip, SubmissionBody, Thumb, useBackendVersion, useFile } from './MyWork'
import { playUrl } from '../lib/audio'

/** Review queue: pending work by student, lesson and time (oldest first). */
export function ReviewQueue() {
  const { user } = useApp()
  useBackendVersion()
  const [status, setStatus] = useState<SubmissionStatus | 'all'>('pending')
  const [student, setStudent] = useState('all')
  const [kind, setKind] = useState('all')
  const [people, setPeople] = useState<Record<string, string>>({})
  useMemo(() => { backend.listProfiles().then((ps) => setPeople(Object.fromEntries(ps.map((p) => [p.id, p.nameEn])))) }, [])
  if (user?.role === 'student') return <p>Not available.</p>
  const all = backend.listSubmissions()
  const subs = all
    .filter((s) => (status === 'all' || s.status === status) && (student === 'all' || s.userId === student) && (kind === 'all' || s.kind === kind))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const sel = 'min-h-10 rounded-xl border border-line bg-card px-3 text-sm'
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="me-auto">
          <h1 className="text-2xl font-semibold">Review queue</h1>
          <p className="text-muted">{all.filter((s) => s.status === 'pending').length} waiting</p>
        </div>
        <select className={sel} value={status} onChange={(e) => setStatus(e.target.value as SubmissionStatus | 'all')}>
          <option value="pending">Pending</option><option value="needs_redo">Needs redo</option><option value="reviewed">Reviewed</option><option value="all">All</option>
        </select>
        <select className={sel} value={student} onChange={(e) => setStudent(e.target.value)}>
          <option value="all">All students</option>
          {[...new Set(all.map((s) => s.userId))].map((id) => <option key={id} value={id}>{people[id] ?? id.slice(0, 6)}</option>)}
        </select>
        <select className={sel} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="all">Sheets and recordings</option><option value="sheet">Sheets</option><option value="recording">Recordings</option>
        </select>
      </div>
      {subs.length === 0 && <Card><p className="text-muted">Nothing here. New work shows up as soon as a student sends it.</p></Card>}
      {subs.map((s) => (
        <Link key={s.id} to={`/review/${s.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 transition hover:border-brand">
          <Thumb sub={s} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{people[s.userId] ?? 'Student'} · {s.title}</p>
            <p className="text-xs text-muted">{lessonById(s.lessonId)?.title ?? s.lessonId} · {timeAgo(s.createdAt)}{s.selfRating ? ` · felt ${s.selfRating.toLowerCase()}` : ''}</p>
          </div>
          <StatusChip status={s.status} />
        </Link>
      ))}
    </div>
  )
}

function timeAgo(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`
}

/** Leave feedback on the work itself: red ink and pins on sheets, time markers on recordings, plus a note. */
export function ReviewItem() {
  const { id } = useParams()
  const { user } = useApp()
  const nav = useNavigate()
  useBackendVersion()
  const sub = id ? backend.getSubmission(id) : undefined
  const prev = sub ? backend.getFeedback(sub.id).at(-1) : undefined
  const [note, setNote] = useState(prev?.note ?? '')
  const [ann, setAnn] = useState<Annotations>(prev?.annotations ?? {})
  const [marking, setMarking] = useState(false)
  const [markerText, setMarkerText] = useState('')
  const [markerAt, setMarkerAt] = useState<number | null>(null)
  const strokesFile = useFile(sub?.kind === 'sheet' ? sub.id : undefined, 'strokes')
  const audio = useFile(sub?.kind === 'recording' ? sub.id : undefined, 'audio')
  const player = useRef<HTMLAudioElement | null>(null)
  if (!sub || user?.role === 'student') return <p>Not found.</p>

  async function finish(status: Exclude<SubmissionStatus, 'pending'>) {
    await backend.addFeedback(user!.id, sub!.id, { note: note.trim(), annotations: ann, status })
    nav('/review')
  }

  return (
    <div className="space-y-4">
      <Link to="/review" className="text-sm text-muted hover:text-ink">← Review queue</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="me-auto text-2xl font-semibold">{sub.title}</h1>
        <StatusChip status={sub.status} />
      </div>

      {sub.kind === 'sheet' && typeof strokesFile === 'string' && (
        <Button variant="ghost" onClick={() => setMarking(true)}>Mark up the sheet (red pen, comments)</Button>
      )}
      {sub.kind === 'recording' && audio instanceof Blob && (
        <Card className="space-y-2">
          <p className="text-sm font-medium">Add a note at a moment in the recording</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => { player.current = playUrl(URL.createObjectURL(audio)) }}>Play</Button>
            <Button variant="ghost" onClick={() => { const t = player.current ? Math.round(player.current.currentTime * 1000) : 0; player.current?.pause(); setMarkerAt(t) }}>Pause and mark here</Button>
          </div>
          {markerAt !== null && (
            <div className="flex gap-2">
              <span className="self-center font-mono text-sm text-danger">{(markerAt / 1000).toFixed(1)}s</span>
              <input autoFocus value={markerText} onChange={(e) => setMarkerText(e.target.value)} placeholder="e.g. the 'th' should be softer here" className="min-h-10 flex-1 rounded-xl border border-line bg-paper px-3" />
              <Button onClick={() => { setAnn({ ...ann, markers: [...(ann.markers ?? []), { tMs: markerAt, text: markerText }].sort((a, b) => a.tMs - b.tMs) }); setMarkerAt(null); setMarkerText('') }}>Add</Button>
            </div>
          )}
        </Card>
      )}

      <SubmissionBody sub={sub} annotations={ann} />

      <Card className="space-y-3">
        <label className="block text-sm font-medium">Note to the student
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-line bg-paper p-3" placeholder="What went well, and one thing to work on." />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => finish('reviewed')}>Send feedback</Button>
          <Button variant="danger" onClick={() => finish('needs_redo')}>Ask them to redo it</Button>
        </div>
      </Card>

      {marking && typeof strokesFile === 'string' && (
        <SheetEditor data={JSON.parse(strokesFile) as SheetData} tone="review" initial={(ann.ink ?? []) as Pt[][]} pins={ann.pins ?? []}
          onClose={(ink, pins) => { setAnn({ ...ann, ink, pins }); setMarking(false) }}
          onDone={(ink, pins) => { setAnn({ ...ann, ink, pins }); setMarking(false) }} doneLabel="Done marking" />
      )}
    </div>
  )
}

/** Emails that will be sent through Resend once Supabase is connected. */
export function Outbox() {
  useBackendVersion()
  const mails = backend.outbox()
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Email outbox</h1>
      <p className="text-muted">Emails queued by the database. Once the send-email function is set up, sent ones are delivered through Resend.</p>
      {mails.map((m) => (
        <Card key={m.id}>
          <p className="text-xs text-muted">To {m.to} · {new Date(m.createdAt).toLocaleString()}</p>
          <p className="font-medium">{m.subject}</p>
          <p className="text-sm text-muted">{m.body}</p>
        </Card>
      ))}
    </div>
  )
}
