import { course, coveredItems } from '../lib/course'
import { useApp } from '../lib/app-state'
import { markOnCarrier } from '../lib/arabic'
import { speak } from '../lib/speech'

const GROUPS = [
  ['letters', 'Letters'], ['variants', 'Variants'], ['marks', 'Vowel marks'], ['digits', 'Digits'],
] as const

export function CoveredTable() {
  const { completed, settings } = useApp()
  const covered = coveredItems(completed)
  const tableItems = course.items.filter((i) => i.group !== 'mechanics')
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Your letter table</h1>
        <p className="text-muted">{tableItems.filter((i) => covered.has(i.id)).length} of {tableItems.length} uncovered. Tiles turn over as you complete lessons.</p>
      </div>
      {GROUPS.map(([g, label]) => (
        <section key={g}>
          <h2 className="mb-2 text-sm font-semibold text-muted uppercase">{label}</h2>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-7" dir="rtl">
            {course.items.filter((i) => i.group === g).map((it) => {
              const on = covered.has(it.id)
              const glyph = it.glyph ?? markOnCarrier(it.mark!)
              return (
                <button
                  key={it.id}
                  disabled={!on}
                  onClick={() => it.glyph && speak(it.glyph, 'ar', { slow: settings.slow })}
                  className={`flex aspect-square flex-col items-center justify-center rounded-xl border transition ${on ? 'border-brand bg-brand-soft text-ink' : 'border-line bg-line/40 text-transparent'}`}
                  aria-label={on ? it.name : 'Covered tile'}
                >
                  <span lang="ar" className="ar text-3xl">{on ? glyph : '·'}</span>
                  <span className={`text-[10px] ${on ? 'text-muted' : ''}`} dir="ltr">{on ? it.name : ''}</span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
