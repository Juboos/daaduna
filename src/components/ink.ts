import { useCallback, useRef, useState, type PointerEvent } from 'react'
import type { Pt } from '../lib/paths'

/**
 * Pointer-event ink capture in SVG viewBox coordinates. Works with finger, mouse and stylus.
 * penOnly ignores touch so a palm resting on an iPad does not draw.
 */
export function useInk({ penOnly = false, disabled = false } = {}) {
  const [strokes, setStrokes] = useState<Pt[][]>([])
  const current = useRef<Pt[] | null>(null)
  const [, force] = useState(0)

  const toPt = (e: PointerEvent<SVGSVGElement>): Pt => {
    const svg = e.currentTarget
    const m = svg.getScreenCTM()
    if (!m) return [0, 0]
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]
  }

  const onPointerDown = useCallback((e: PointerEvent<SVGSVGElement>) => {
    if (disabled || (penOnly && e.pointerType === 'touch')) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* unknown pointer id */ }
    current.current = [toPt(e)]
    force((x) => x + 1)
  }, [penOnly, disabled])

  const onPointerMove = useCallback((e: PointerEvent<SVGSVGElement>) => {
    if (!current.current) return
    // Coalesced events give smoother Apple Pencil lines.
    const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? []
    const evts = (coalesced.length ? coalesced : [e.nativeEvent]) as globalThis.PointerEvent[]
    for (const ev of evts) current.current.push(toPt({ ...e, clientX: ev.clientX, clientY: ev.clientY } as PointerEvent<SVGSVGElement>))
    force((x) => x + 1)
  }, [])

  const onPointerUp = useCallback(() => {
    if (!current.current) return
    const s = current.current
    current.current = null
    setStrokes((all) => [...all, s])
  }, [])

  const clear = () => { current.current = null; setStrokes([]) }
  const undo = () => setStrokes((s) => s.slice(0, -1))
  const all = current.current ? [...strokes, current.current] : strokes

  return { strokes, all, clear, undo, setStrokes, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } }
}

export const toPolyline = (s: Pt[]) => s.map((p) => p.join(',')).join(' ')
