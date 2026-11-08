import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Exercise } from '../lib/exercise-types'
import type { Pt } from '../lib/paths'
import { useApp } from '../lib/app-state'
import { backend, type Submission } from '../lib/backend'
import { Sheet, sheetToPng, type SheetData } from '../components/Sheet'
import { SheetEditor } from '../components/SheetEditor'
import { Button } from '../components/ui'
import { StatusChip } from '../pages/MyWork'

const draftKey = (u: string, ex: string) => `daaduna.sheet.${u}.${ex}`

/** Writing sheet inside a lesson: write on the tablet, then send it to the tutor for feedback. */
export function SheetExercise({ ex, lessonId, onAnswer }: { ex: Extract<Exercise, { type: 'sheet' }>; lessonId: string; onAnswer: (c: null, r: unknown) => void }) {
  const { user } = useApp()
  const [open, setOpen] = useState(false)
  const [strokes, setStrokes] = useState<Pt[][]>(() => {
    try { return JSON.parse(localStorage.getItem(draftKey(user!.id, ex.id)) ?? '[]') } catch { return [] }
  })
  const [subs, setSubs] = useState<Submission[]>([])
  const svgRef = useRef<SVGSVGElement>(null)

  const refresh = () => user && setSubs(backend.listSubmissions({ userId: user.id }).filter((s) => s.exerciseId === ex.id))
  useEffect(() => { refresh(); return backend.subscribe(refresh) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])
  const latest = subs[subs.length - 1]

  const data: SheetData = { title: ex.title, rows: ex.rows, nameAr: user?.nameAr ?? null, nameEn: user?.nameEn ?? '', strokes }
  const save = (s: Pt[][]) => { setStrokes(s); try { localStorage.setItem(draftKey(user!.id, ex.id), JSON.stringify(s)) } catch { /* ignore */ } }

  async function send(s: Pt[][]) {
    if (!user || !svgRef.current) return
    save(s)
    const png = await sheetToPng(svgRef.current)
    await backend.createSubmission(user.id, { lessonId, exerciseId: ex.id, kind: 'sheet', title: ex.title }, {
      strokes: JSON.stringify({ ...data, strokes: s }), png,
    })
    localStorage.removeItem(draftKey(user.id, ex.id))
    setStrokes([])
    setOpen(false)
    onAnswer(null, { submitted: true })
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <button onClick={() => setOpen(true)} className="w-full max-w-sm overflow-hidden rounded-xl shadow-lg ring-1 ring-line transition hover:-translate-y-0.5">
        <Sheet data={data} className="pointer-events-none w-full" />
      </button>
      {latest && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          <StatusChip status={latest.status} />
          <span className="text-muted">sent {new Date(latest.createdAt).toLocaleDateString()}</span>
          <Link to={`/work/${latest.id}`} className="font-medium text-brand underline-offset-2 hover:underline">See it</Link>
        </div>
      )}
      <Button onClick={() => setOpen(true)}>{latest?.status === 'needs_redo' ? 'Try the sheet again' : strokes.length ? 'Continue writing' : 'Open the sheet'}</Button>
      <p className="max-w-sm text-center text-xs text-muted">Best on a tablet, with a stylus or your finger. Your tutor sees it and leaves feedback; it never holds up the course.</p>
      {open && (
        <SheetEditor data={data} tone="ink" initial={strokes} svgRef={svgRef}
          onClose={(s) => { save(s); setOpen(false) }}
          onDone={(s) => send(s)} doneLabel="Send to my tutor" />
      )}
    </div>
  )
}
