import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../lib/app-state'
import type { Pt } from '../lib/paths'
import { useInk } from './ink'
import { Sheet, SHEET_W, sheetHeight, strokeNear, type SheetData } from './Sheet'
import { Button, Icon } from './ui'

const svgPoint = (e: RPointerEvent<SVGSVGElement>): Pt => {
  const m = e.currentTarget.getScreenCTM()
  if (!m) return [0, 0]
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
  return [p.x, p.y]
}

/**
 * Full-screen sheet for writing with finger or stylus. Used by students (black ink) and reviewers
 * (red ink + comment pins on top of the student's writing).
 */
export function SheetEditor({ data, tone, initial = [], pins: initialPins = [], onClose, onDone, doneLabel, extra, svgRef }: {
  data: SheetData
  tone: 'ink' | 'review'
  initial?: Pt[][]
  pins?: { x: number; y: number; text: string }[]
  onClose: (strokes: Pt[][], pins: { x: number; y: number; text: string }[]) => void
  onDone?: (strokes: Pt[][], pins: { x: number; y: number; text: string }[]) => void
  doneLabel?: string
  extra?: ReactNode
  svgRef?: React.RefObject<SVGSVGElement | null>
}) {
  const { settings } = useApp()
  const [tool, setTool] = useState<'pen' | 'eraser' | 'pin'>('pen')
  const ink = useInk({ penOnly: settings.penOnly })
  const [pins, setPins] = useState(initialPins)
  const [activePin, setActivePin] = useState<number | null>(null)
  const H = sheetHeight(data.rows)
  const wrap = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(600)

  useEffect(() => { ink.setStrokes(initial) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Fit the whole page on screen (it's a sheet of paper, not a scrolling page).
  useEffect(() => {
    const fit = () => {
      const el = wrap.current
      if (!el) return
      setW(Math.min(el.clientWidth - 16, ((el.clientHeight - 16) * SHEET_W) / H))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [H])

  const handlers = {
    ...ink.handlers,
    onPointerDown: (e: RPointerEvent<SVGSVGElement>) => {
      if (tool === 'pen') return ink.handlers.onPointerDown(e)
      const p = svgPoint(e)
      if (tool === 'eraser') {
        const i = strokeNear(ink.strokes, p)
        if (i >= 0) ink.setStrokes(ink.strokes.filter((_, k) => k !== i))
      } else {
        setPins((ps) => [...ps, { x: p[0], y: p[1], text: '' }])
        setActivePin(pins.length)
        setTool('pen')
      }
    },
  }

  const view = tone === 'review'
    ? { data, reviewInk: ink.strokes, liveStroke: ink.all.length > ink.strokes.length ? ink.all[ink.all.length - 1] : null, liveTone: 'review' as const }
    : { data: { ...data, strokes: ink.strokes }, liveStroke: ink.all.length > ink.strokes.length ? ink.all[ink.all.length - 1] : null }

  const toolBtn = (t: typeof tool, label: string) => (
    <button onClick={() => setTool(t)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tool === t ? 'bg-card text-ink shadow-sm' : 'text-muted'}`}>{label}</button>
  )

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-paper">
      <header className="flex flex-wrap items-center gap-2 border-b border-line/60 px-3 py-2">
        <button onClick={() => onClose(ink.strokes, pins)} className="grid size-10 place-items-center rounded-xl text-muted hover:bg-card-2" aria-label="Close sheet">{Icon.close}</button>
        <p className="me-auto truncate font-semibold">{data.title}</p>
        <div className="flex rounded-xl bg-card-2 p-1">
          {toolBtn('pen', tone === 'review' ? 'Red pen' : 'Pen')}
          {toolBtn('eraser', 'Eraser')}
          {tone === 'review' && toolBtn('pin', 'Comment')}
        </div>
        <Button variant="ghost" onClick={ink.undo} disabled={!ink.strokes.length}>Undo</Button>
        {onDone && <Button onClick={() => onDone(ink.strokes, pins)}>{doneLabel ?? 'Done'}</Button>}
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div ref={wrap} className="grid min-w-0 flex-1 place-items-center overflow-hidden p-2">
          <Sheet ref={svgRef} {...view} pins={pins} activePin={activePin} handlers={handlers}
            className="sheet-fit rounded-md shadow-xl ring-1 ring-black/5" />
        </div>
        {(tone === 'review' && pins.length > 0) || extra ? (
          <aside className="max-h-48 w-full shrink-0 space-y-3 overflow-y-auto border-t border-line/60 p-3 md:max-h-none md:w-72 md:border-s md:border-t-0">
            {pins.map((p, i) => (
              <label key={i} className="block">
                <span className="mb-1 flex items-center justify-between text-xs font-semibold text-danger">Comment {i + 1}
                  <button onClick={() => setPins(pins.filter((_, k) => k !== i))} className="text-muted hover:text-danger">remove</button>
                </span>
                <textarea autoFocus={activePin === i} value={p.text} onFocus={() => setActivePin(i)}
                  onChange={(e) => setPins(pins.map((q, k) => (k === i ? { ...q, text: e.target.value } : q)))}
                  className="w-full rounded-xl border border-line bg-card p-2 text-sm" rows={2} placeholder="What should they look at?" />
              </label>
            ))}
            {extra}
          </aside>
        ) : null}
      </div>
      {settings.penOnly && <p className="pb-2 text-center text-xs text-muted">Pen only: finger touches are ignored.</p>}
      <style>{`.sheet-fit{width:${w}px;height:auto}`}</style>
    </div>,
    document.body,
  )
}
