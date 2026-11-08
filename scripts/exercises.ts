/* eslint-disable @typescript-eslint/no-explicit-any -- raw YAML input */
// Expands authored exercises (explicit or `auto: n`) into concrete items, and checks that every
// Arabic string in an exercise is readable with what has been taught up to that lesson.
import { baseLetters, clean, isReadable } from '../src/lib/arabic'
import type { Exercise, Term } from '../src/lib/exercise-types'

type W = { ar: string; en: string | null; tr: string | null; concrete: boolean; priority: number; rank: number | null; firstLesson?: string }

function rng(seedStr: string) {
  let a = [...seedStr].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function resolveExercises(opts: {
  lessonId: string
  stepKind: string
  raw: any[]
  pool: W[] // readable words up to this lesson, best first
  allWords: W[]
  taught: Set<string>
  teaches: string[]
  errors: string[]
}): Exercise[] {
  const { lessonId, stepKind, raw, pool, allWords, taught, errors } = opts
  const rand = rng(lessonId + stepKind)
  const pick = <T,>(arr: T[], n: number, avoid: T[] = []) => {
    const a = arr.filter((x) => !avoid.includes(x))
    const out: T[] = []
    while (out.length < n && a.length) out.push(a.splice(Math.floor(rand() * Math.min(a.length, 6)), 1)[0])
    return out
  }
  const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }
  const term = (x: string | Term): Term => {
    const ar = clean(typeof x === 'string' ? x : x.ar)
    const w = allWords.find((w) => w.ar === ar)
    return { ar, en: (typeof x === 'object' && x.en) || w?.en || null, tr: (typeof x === 'object' && x.tr) || w?.tr || null }
  }
  const wordTerms = pool.filter((w) => w.en).map((w) => term(w.ar))
  const out: Exercise[] = []
  let n = 0
  const id = () => `${lessonId}.${stepKind}.${++n}`
  const check = (ar: string, where: string) => {
    if (!isReadable(ar, taught)) errors.push(`${lessonId} ${where}: "${ar}" uses letters or marks not taught yet`)
  }

  for (const ex of raw) {
    const count = typeof ex.auto === 'number' ? ex.auto : 1
    const isAuto = ex.auto !== undefined
    for (let k = 0; k < count; k++) {
      switch (ex.type) {
        case 'listenPick': {
          const answer = isAuto ? wordTerms[k % Math.max(wordTerms.length, 1)] : term(ex.answer)
          if (!answer) break
          const opts = isAuto ? pick(wordTerms, 2, [answer]) : (ex.options ?? []).map(term)
          out.push({ id: id(), type: 'listenPick', prompt: ex.prompt, answer, options: shuffle([answer, ...opts.filter((o: Term) => o.ar !== answer.ar)]) })
          break
        }
        case 'soundPick':
          out.push({ id: id(), type: 'soundPick', prompt: ex.prompt, answer: clean(ex.answer), options: shuffle(ex.options.map(clean)), listenFor: ex.listenFor })
          break
        case 'match': {
          const pairs = isAuto ? pick(wordTerms, Math.min(ex.auto, 4)) : ex.pairs.map(term)
          if (pairs.length >= 2) out.push({ id: id(), type: 'match', prompt: ex.prompt, pairs })
          k = count
          break
        }
        case 'flashcards': {
          const cards = isAuto ? wordTerms.slice(0, ex.auto) : ex.cards.map(term)
          if (cards.length) out.push({ id: id(), type: 'flashcards', prompt: ex.prompt, cards })
          k = count
          break
        }
        case 'trueFalse':
          out.push({ id: id(), type: 'trueFalse', prompt: ex.prompt, ar: clean(ex.ar), claim: ex.claim, answer: !!ex.answer })
          break
        case 'fillBlank': {
          const word = isAuto ? wordTerms[k % Math.max(wordTerms.length, 1)] : term(ex.word)
          if (!word) break
          const letters = baseLetters(word.ar)
          const blank = isAuto ? Math.floor(rand() * letters.length) : ex.blank
          const taughtLetters = [...new Set(pool.flatMap((w) => baseLetters(w.ar)))]
          const options = ex.options?.map(clean) ?? shuffle([letters[blank], ...pick(taughtLetters, 2, [letters[blank]])])
          out.push({ id: id(), type: 'fillBlank', prompt: ex.prompt, word, blank, options })
          break
        }
        case 'order':
          out.push({ id: id(), type: 'order', prompt: ex.prompt, items: ex.items.map(clean), hint: ex.hint })
          break
        case 'trace':
          out.push({ id: id(), type: 'trace', prompt: ex.prompt, letter: ex.letter, form: ex.form ?? 'isolated', mark: ex.mark })
          break
        case 'build': {
          const word = isAuto ? wordTerms[k % Math.max(wordTerms.length, 1)] : term(ex.word)
          if (!word) break
          const taughtLetters = [...new Set(pool.flatMap((w) => baseLetters(w.ar)))]
          out.push({ id: id(), type: 'build', prompt: ex.prompt, word, distractors: ex.distractors ?? pick(taughtLetters, 1, baseLetters(word.ar)) })
          break
        }
        case 'dictation': {
          const word = isAuto ? wordTerms[(k + 1) % Math.max(wordTerms.length, 1)] : term(ex.word)
          if (word) out.push({ id: id(), type: 'dictation', prompt: ex.prompt, word })
          break
        }
        case 'shadow':
          out.push({ id: id(), type: 'shadow', prompt: ex.prompt, term: term(ex.term), listenFor: ex.listenFor, submit: ex.submit ?? 'optional' })
          break
        case 'sheet':
          out.push({ id: id(), type: 'sheet', prompt: ex.prompt, title: ex.title, rows: ex.rows.map((r: any) => ({ ...r, ghost: r.ghost && r.ghost !== '$name' ? clean(r.ghost) : r.ghost })), submit: ex.submit ?? 'required' })
          break
        default:
          errors.push(`${lessonId}: unknown exercise type "${ex.type}"`)
      }
    }
  }

  // Readability check on every Arabic string.
  for (const e of out) {
    const strings: string[] = []
    if (e.type === 'listenPick') strings.push(e.answer.ar, ...e.options.map((o) => o.ar))
    if (e.type === 'soundPick') strings.push(e.answer, ...e.options)
    if (e.type === 'match') strings.push(...e.pairs.map((p) => p.ar))
    if (e.type === 'flashcards') strings.push(...e.cards.map((p) => p.ar))
    if (e.type === 'trueFalse') strings.push(e.ar)
    if (e.type === 'fillBlank') strings.push(e.word.ar, ...e.options)
    if (e.type === 'order') strings.push(...e.items.filter((s) => !/^[٠-٩]+$/.test(s)))
    if (e.type === 'build' || e.type === 'dictation') strings.push(e.word.ar, ...('distractors' in e ? e.distractors : []))
    if (e.type === 'shadow') strings.push(e.term.ar)
    if (e.type === 'trace' && e.letter) strings.push(e.letter)
    if (e.type === 'sheet') strings.push(...e.rows.map((r) => r.ghost).filter((g): g is string => !!g && g !== '$name'))
    for (const s of strings) check(s, e.id)
  }
  return out
}
