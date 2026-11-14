/* eslint-disable @typescript-eslint/no-explicit-any -- untyped YAML/xlsx input, validated by zod */
// Builds src/generated/course.json from content/*.yaml and the private word list.
// Only words that become readable in a published unit are written out (licence: never ship the full list).
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import YAML from 'yaml'
import ExcelJS from 'exceljs'
import { z } from 'zod'
import { answerStringProblems, clean, requiredItems, stripMarks } from '../src/lib/arabic'
import { parsePath } from '../src/lib/paths'
import { resolveExercises } from './exercises'

const ROOT = join(import.meta.dirname, '..')
const PUBLISHED_UNITS = ['u0', 'u1']
const y = (p: string) => YAML.parse(readFileSync(join(ROOT, p), 'utf8'))

const Visual = z.object({ type: z.string() }).passthrough()
const Cue = z.object({ at: z.string(), action: z.enum(['draw', 'show']) })
const Slide = z.object({ id: z.string(), narration: z.string(), visual: Visual, audio: z.string().optional(), cues: z.array(Cue).optional() })
  .refine((s) => (s.cues ?? []).every((c) => s.narration.toLowerCase().includes(c.at.toLowerCase())), { message: 'cue word not found in narration' })
const Step = z.object({
  kind: z.enum(['learn', 'write', 'listen', 'read', 'speak', 'exercises']),
  slides: z.array(Slide).default([]),
  exercises: z.array(z.any()).default([]),
})
const Lesson = z.object({
  id: z.string(), type: z.enum(['letter', 'symbol', 'sound', 'review', 'checkpoint']),
  title: z.string(), draft: z.boolean().default(false), free: z.boolean().optional(),
  teaches: z.array(z.string()).nullish().transform((v) => (v ?? []).filter(Boolean)),
  steps: z.array(Step),
})

const errors: string[] = []

// ---- items
const itemsY = y('content/items.yaml')
const items = (['letters', 'variants', 'marks', 'digits', 'mechanics'] as const).flatMap((group) =>
  (itemsY[group] ?? []).map((it: any, i: number) => ({ ...it, group, order: i })),
)
const itemIds = new Set(items.map((i) => i.id))

// ---- units and lessons in course order
const units = y('content/units.yaml') as { id: string; order: number; title: string; milestone: string }[]
const lessons: z.infer<typeof Lesson>[] = []
for (const u of units) {
  const dir = join(ROOT, 'content/units', u.id)
  if (!existsSync(dir)) continue
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort()) {
    const parsed = Lesson.safeParse(y(`content/units/${u.id}/${f}`))
    if (!parsed.success) { errors.push(`${u.id}/${f}: ${parsed.error.message}`); continue }
    for (const t of parsed.data.teaches) if (!itemIds.has(t)) errors.push(`${parsed.data.id}: unknown taught item "${t}"`)
    lessons.push(parsed.data)
  }
}
// Free boundary (default A6): Unit 0 + Unit 1 lessons 1–4.
for (const l of lessons) l.free ??= l.id.startsWith('u0-') || /^u1-l0[1-4]$/.test(l.id)

// ---- words
type Word = {
  id: string; source: 'core' | 'alsaid'; rank: number | null; ar: string; bare: string; en: string | null
  tr: string | null; pos: string | null; concrete: boolean; priority: number; image?: string; required: string[]
  firstLesson?: string
}
const words: Word[] = []
const TATWEEL_FIX: Record<string, string> = { 'لـ(ه)': 'لَهُ', 'بـ(ه)': 'بِهِ', 'وَحْدَ(ه)': 'وَحْدَهُ' }
const FUNCTION_POS = /^(P\\|PRO|N\\DE|N\\RP|KH)/

for (const c of y('content/vocab/core.yaml') as any[]) {
  const ar = clean(c.ar)
  words.push({
    id: `core:${ar}`, source: 'core', rank: null, ar, bare: stripMarks(ar), en: c.en, tr: c.tr,
    pos: null, concrete: !!c.concrete, priority: c.concrete ? 1 : 3, image: c.image, required: [...requiredItems(ar)],
  })
}

// Al-Said rows come from the private spreadsheet when it is here. Otherwise (e.g. on the hosting build
// server) from content/vocab/alsaid-published.json: only the rows the published units actually use, which
// is the same subset the app ships to logged-in students anyway. The full list never enters git.
type AlSaidRow = { rank: number; form: number; printed: string; pos: string | null }
const xlsx = join(ROOT, 'data/private/AlSaid_2023_MSA_Common_Words_1000.xlsx')
const SNAPSHOT = join(ROOT, 'content/vocab/alsaid-published.json')
const rows: AlSaidRow[] = []
const fromSpreadsheet = existsSync(xlsx)
if (fromSpreadsheet) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(xlsx)
  wb.getWorksheet('Word List')!.eachRow((row, n) => {
    if (n === 1) return
    const v = (i: number) => { const x = row.getCell(i).value as any; return x == null ? null : String(x?.result ?? x) }
    const printed = v(3)
    if (printed) rows.push({ rank: Number(v(1)), form: Number(v(2)), printed, pos: v(5) })
  })
} else if (existsSync(SNAPSHOT)) {
  rows.push(...JSON.parse(readFileSync(SNAPSHOT, 'utf8')))
  console.log(`  word list: using published subset (${rows.length} rows); private spreadsheet not present`)
} else {
  console.warn('! word list not found, building with core vocabulary only')
}
const rowWord = new Map<AlSaidRow, Word>()
{
  const notes = y('content/vocab/alsaid-notes.yaml') ?? {}
  for (const r of rows) {
    const { rank, form, printed, pos } = r
    const ar = clean(TATWEEL_FIX[printed] ?? printed)
    const bare = stripMarks(ar)
    const note = notes[`${rank}:${form}`] ?? {}
    const unvoweled = ar === bare
    const core = words.find((w) => w.source === 'core' && (w.ar === ar || (unvoweled && w.bare === bare && !words.some((o) => o !== w && o.source === 'core' && o.bare === bare))))
    if (core) { core.rank ??= rank; rowWord.set(r, core); continue } // core entry wins, gets the frequency rank
    const concrete = !!note.concrete
    const priority = concrete ? 2 : pos && FUNCTION_POS.test(pos) ? 5 : pos === 'N\\CN' ? 3 : 4
    const w: Word = {
      id: `as:${rank}:${form}`, source: 'alsaid', rank, ar, bare, en: note.en ?? null, tr: note.tr ?? null,
      pos, concrete, priority, required: [...requiredItems(ar)],
    }
    words.push(w)
    rowWord.set(r, w)
  }
}

// ---- readability: first lesson whose cumulative teaches cover the word
const taught = new Set<string>()
const readingSets: Record<string, string[]> = {}
for (const l of lessons) {
  l.teaches.forEach((t) => taught.add(t))
  const fresh = words
    .filter((w) => !w.firstLesson && w.required.every((r) => taught.has(r)))
    .sort((a, b) => a.priority - b.priority || (a.rank ?? 9999) - (b.rank ?? 9999))
  fresh.forEach((w) => (w.firstLesson = l.id))
  readingSets[l.id] = fresh.map((w) => w.id)
}

// ---- exercises: expand auto items, check readability against what is taught so far
{
  const cum = new Set<string>()
  lessons.forEach((l, i) => {
    l.teaches.forEach((t) => cum.add(t))
    const idx = (id?: string) => lessons.findIndex((x) => x.id === id)
    const pool = words
      .filter((w) => w.firstLesson && idx(w.firstLesson) <= i)
      .sort((a, b) => Number(b.firstLesson === l.id) - Number(a.firstLesson === l.id) || a.priority - b.priority || (a.rank ?? 9999) - (b.rank ?? 9999))
    for (const st of l.steps) {
      st.exercises = resolveExercises({ lessonId: l.id, stepKind: st.kind, raw: st.exercises, pool, allWords: words, taught: new Set(cum), teaches: l.teaches, errors })
    }
  })
}

// ---- strokes
const strokes: { letters: Record<string, any>; marks: Record<string, any> } = { letters: {}, marks: {} }
for (const f of readdirSync(join(ROOT, 'content/strokes')).filter((f) => f.endsWith('.yaml'))) {
  const s = y(`content/strokes/${f}`)
  Object.assign(strokes.letters, s.letters ?? {})
  Object.assign(strokes.marks, s.marks ?? {})
}
for (const [k, forms] of Object.entries({ ...strokes.letters, ...strokes.marks })) {
  const list = 'strokes' in (forms as any) ? [forms] : Object.values(forms as any)
  for (const def of list as any[]) for (const st of def.strokes) {
    try { parsePath(st.d) } catch (e) { errors.push(`strokes ${k}: ${(e as Error).message}`) }
  }
}

// ---- validation
for (const w of words) for (const p of answerStringProblems(w.ar)) errors.push(`word ${w.id} "${w.ar}": ${p}`)
for (const w of words.filter((w) => w.firstLesson && !w.en)) console.warn(`  missing gloss: ${w.id} ${w.ar}`)

if (errors.length) { console.error(errors.join('\n')); process.exit(1) }

const published = lessons.filter((l) => PUBLISHED_UNITS.includes(l.id.split('-')[0]))
const shipped = words.filter((w) => w.firstLesson && published.some((l) => l.id === w.firstLesson))
mkdirSync(join(ROOT, 'src/generated'), { recursive: true })
writeFileSync(
  join(ROOT, 'src/generated/course.json'),
  JSON.stringify({ units, lessons: published, items, words: shipped, readingSets, strokes }, null, 1),
)
if (fromSpreadsheet) {
  const shippedIds = new Set(shipped.map((w) => w.id))
  writeFileSync(SNAPSHOT, JSON.stringify(rows.filter((r) => shippedIds.has(rowWord.get(r)!.id)), null, 1) + '\n')
}
console.log(`✓ ${published.length} lessons, ${shipped.length} readable words shipped (of ${words.length})`)
for (const l of published) if (readingSets[l.id].length)
  console.log(`  ${l.id}: ${readingSets[l.id].map((id) => shipped.find((w) => w.id === id)!.ar).join('، ')}`)
