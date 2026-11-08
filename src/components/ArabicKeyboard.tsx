import { useEffect } from 'react'
import { itemIdForChar } from '../lib/arabic'
import { useSection } from '../lib/lesson-context'

// Standard Arabic (101) layout, so it matches a real keyboard later. Variants on the last row.
const ROWS = [
  ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د'],
  ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط'],
  ['ئ', 'ء', 'ؤ', 'ر', 'ى', 'ة', 'و', 'ز', 'ظ', 'ذ'],
  ['أ', 'إ', 'آ'],
]

/** On-screen Arabic keyboard. Letters already taught are highlighted; the rest stay usable but dim. */
export function ArabicKeyboard({ taught, onKey, onBackspace }: { taught: Set<string>; onKey: (c: string) => void; onBackspace: () => void }) {
  const { active } = useSection()
  // Physical keyboards (with an Arabic layout) work too, for the section in focus.
  useEffect(() => {
    if (!active) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') { onBackspace(); e.preventDefault() }
      else if (e.key.length === 1 && /[ء-ي ]/.test(e.key)) { onKey(e.key); e.preventDefault() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onKey, onBackspace, active])

  return (
    <div className="w-full max-w-xl space-y-1.5 rounded-2xl bg-line/40 p-2 select-none" dir="rtl">
      {ROWS.map((row, r) => (
        <div key={r} className="flex justify-center gap-1">
          {row.map((c) => {
            const known = taught.has(itemIdForChar(c) ?? '')
            return (
              <button key={c} onClick={() => onKey(c)}
                className={`ar h-11 min-w-0 flex-1 basis-0 rounded-lg text-2xl sm:h-12 ${known ? 'bg-card text-ink shadow-sm' : 'bg-card/50 text-muted/60'} ${r === 3 ? 'max-w-14' : 'max-w-12'}`}>
                {c}
              </button>
            )
          })}
          {r === 3 && (
            <>
              <button onClick={() => onKey(' ')} className="h-11 max-w-56 flex-[4] rounded-lg bg-card text-sm text-muted shadow-sm sm:h-12" dir="ltr">space</button>
              <button onClick={onBackspace} className="h-11 max-w-16 flex-1 rounded-lg bg-card text-muted shadow-sm sm:h-12" aria-label="Delete">
                <svg viewBox="0 0 24 24" className="mx-auto size-5 -scale-x-100" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 5H9l-6 7 6 7h12z" /><path d="m12 9 6 6M18 9l-6 6" /></svg>
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
