import { forwardRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import type { SheetRow } from '../lib/exercise-types'
import type { Pt } from '../lib/paths'
import { dist } from '../lib/paths'
import { toPolyline } from './ink'

export const SHEET_W = 800
const HEADER = 110
const ROW_H = 150

export const sheetHeight = (rows: SheetRow[]) => HEADER + rows.length * ROW_H + 30

export type SheetData = { title: string; rows: SheetRow[]; nameAr: string | null; nameEn: string; strokes: Pt[][] }

/**
 * A writing sheet: guide lines and ghost letters/words to trace, right to left, with ink layers on top.
 * The same component renders the student's writing, the reviewer's red ink and comment pins.
 */
export const Sheet = forwardRef<SVGSVGElement, {
  data: SheetData
  reviewInk?: Pt[][]
  pins?: { x: number; y: number; text: string }[]
  activePin?: number | null
  handlers?: Partial<Record<'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel', (e: RPointerEvent<SVGSVGElement>) => void>>
  liveStroke?: Pt[] | null
  liveTone?: 'ink' | 'review'
  className?: string
  children?: ReactNode
}>(function Sheet({ data, reviewInk = [], pins = [], activePin, handlers, liveStroke, liveTone = 'ink', className = '', children }, ref) {
  const H = sheetHeight(data.rows)
  return (
    <svg ref={ref} viewBox={`0 0 ${SHEET_W} ${H}`} className={`touch-none select-none ${className}`} style={{ touchAction: 'none', background: '#fffdf8' }} {...handlers}>
      {/* Header: always printed in light colours, like paper. */}
      <text x={40} y={52} fontSize={26} fontWeight={600} fill="#1d2030" fontFamily="Inter, sans-serif">{data.title}</text>
      <text x={40} y={84} fontSize={16} fill="#676c7e" fontFamily="Inter, sans-serif">{data.nameEn} · Daaduna</text>
      <text x={SHEET_W - 40} y={70} fontSize={44} fill="#3d5bd9" textAnchor="start" direction="rtl" className="ar">ضادُنا</text>
      {data.rows.map((r, i) => <Row key={i} row={r} y={HEADER + i * ROW_H} nameAr={data.nameAr} />)}
      {data.strokes.map((s, i) => <Ink key={i} s={s} color="#1d2030" />)}
      {liveStroke && <Ink s={liveStroke} color={liveTone === 'review' ? '#d9534a' : '#1d2030'} />}
      {reviewInk.map((s, i) => <Ink key={`r${i}`} s={s} color="#d9534a" />)}
      {pins.map((p, i) => (
        <g key={`p${i}`} transform={`translate(${p.x} ${p.y})`}>
          <circle r={15} fill={activePin === i ? '#d9534a' : '#ffffff'} stroke="#d9534a" strokeWidth={3} />
          <text y={6} textAnchor="middle" fontSize={16} fontWeight={700} fill={activePin === i ? '#fff' : '#d9534a'} fontFamily="Inter, sans-serif">{i + 1}</text>
        </g>
      ))}
      {children}
    </svg>
  )
})

function Ink({ s, color }: { s: Pt[]; color: string }) {
  if (s.length === 1) return <circle cx={s[0][0]} cy={s[0][1]} r={4} fill={color} />
  return <polyline points={toPolyline(s)} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
}

function Row({ row, y, nameAr }: { row: SheetRow; y: number; nameAr: string | null }) {
  const base = y + 100
  const left = 40, right = SHEET_W - 40
  const ghost = row.ghost === '$name' ? nameAr : row.ghost
  const n = row.empty ? 1 : Math.max(1, row.repeat ?? 1)
  const cellW = (right - left) / n
  return (
    <g>
      {row.label && <text x={right} y={y + 18} fontSize={14} fill="#676c7e" textAnchor="end" fontFamily="Inter, sans-serif">{row.label}</text>}
      {/* guide lines: ascender, baseline (bold), descender */}
      <line x1={left} x2={right} y1={base - 64} y2={base - 64} stroke="#e4e1d8" strokeWidth={1.5} strokeDasharray="6 6" />
      <line x1={left} x2={right} y1={base} y2={base} stroke="#b9c4ef" strokeWidth={2} />
      <line x1={left} x2={right} y1={base + 28} y2={base + 28} stroke="#e4e1d8" strokeWidth={1.5} strokeDasharray="6 6" />
      {ghost && !row.empty && Array.from({ length: n }, (_, k) => (
        // Cells fill from the right, like Arabic writing. The first one is the darker model.
        <text key={k} x={right - cellW * k - cellW / 2} y={base} textAnchor="middle" fontSize={ghost.length > 3 ? 70 : 88}
          fill={k === 0 ? '#9aa6d9' : '#dcdff0'} direction="rtl" className="ar">{ghost}</text>
      ))}
      {row.ghost === '$name' && !nameAr && (
        <text x={(left + right) / 2} y={base - 20} textAnchor="middle" fontSize={18} fill="#676c7e" fontFamily="Inter, sans-serif">Your Arabic name appears here once your tutor has written it.</text>
      )}
    </g>
  )
}

/** Eraser helper: index of the stroke nearest to a point (within tolerance), or -1. */
export function strokeNear(strokes: Pt[][], p: Pt, tol = 14): number {
  let best = -1, bestD = tol
  strokes.forEach((s, i) => s.forEach((q) => { const d = dist(p, q); if (d < bestD) { bestD = d; best = i } }))
  return best
}

/** Render the sheet SVG to a PNG (thumbnail for lists and email). */
export async function sheetToPng(svg: SVGSVGElement, width = 600): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const vb = svg.viewBox.baseVal
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }))
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
  const c = document.createElement('canvas')
  c.width = width
  c.height = Math.round((width * vb.height) / vb.width)
  const g = c.getContext('2d')!
  g.fillStyle = '#fffdf8'
  g.fillRect(0, 0, c.width, c.height)
  g.drawImage(img, 0, 0, c.width, c.height)
  URL.revokeObjectURL(url)
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'))
}

/** Pen / eraser state for drawing on a sheet. */
export function useSheetTool() {
  return useState<'pen' | 'eraser' | 'pin'>('pen')
}
