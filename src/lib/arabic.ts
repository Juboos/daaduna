// All Arabic text rules live here. See PLAN.md §1.3.

export const MARKS = {
  tanwin_fath: 'ً',
  tanwin_damm: 'ٌ',
  tanwin_kasr: 'ٍ',
  fatha: 'َ',
  damma: 'ُ',
  kasra: 'ِ',
  shadda: 'ّ',
  sukun: 'ْ',
  dagger_alif: 'ٰ',
} as const

export type MarkId = keyof typeof MARKS

const MARK_BY_CHAR: Record<string, MarkId> = Object.fromEntries(
  Object.entries(MARKS).map(([k, v]) => [v, k as MarkId]),
)

export const LETTERS: Record<string, string> = {
  ا: 'alif', ب: 'ba', ت: 'ta', ث: 'tha', ج: 'jim', ح: 'hha', خ: 'kha', د: 'dal', ذ: 'dhal',
  ر: 'ra', ز: 'zay', س: 'sin', ش: 'shin', ص: 'sad', ض: 'dad', ط: 'tta', ظ: 'zza', ع: 'ayn',
  غ: 'ghayn', ف: 'fa', ق: 'qaf', ك: 'kaf', ل: 'lam', م: 'mim', ن: 'nun', ه: 'ha', و: 'waw', ي: 'ya',
}

/** Variants tracked as their own taught items. */
export const VARIANTS: Record<string, string> = {
  أ: 'alif_hamza_above', إ: 'alif_hamza_below', آ: 'alif_madda', ء: 'hamza',
  ؤ: 'waw_hamza', ئ: 'ya_hamza', ة: 'ta_marbuta', ى: 'alif_maqsura', ٱ: 'alif_wasla',
}

export const SUN_LETTERS = new Set('تثدذرزسشصضطظلن')
export const NON_CONNECTORS = new Set('اأإآٱدذرزوؤة')

const TATWEEL = 'ـ'
const ZWJ = '‍'
const ZWNJ = '‌'

const LOOKALIKES: Record<string, string> = { 'ی': 'ي', 'ي': 'ي', 'ک': 'ك', 'ە': 'ه', 'ۀ': 'ة' }

const ALL_MARKS_RE = /[ً-ْٰ]/g

/** Unicode-normalize and map keyboard look-alikes. Keeps marks. */
export function clean(s: string): string {
  let out = s.normalize('NFC').replaceAll(TATWEEL, '').replaceAll(ZWJ, '').replaceAll(ZWNJ, '')
  for (const [from, to] of Object.entries(LOOKALIKES)) out = out.replaceAll(from, to)
  return out.trim().replace(/\s+/g, ' ')
}

export function stripMarks(s: string): string {
  return s.replace(ALL_MARKS_RE, '')
}

/** For checking typed answers: strip vowel marks first, then match. Hamza seats, ة and ى stay distinct. */
export function normalizeForCompare(s: string): string {
  return stripMarks(clean(s))
}

export type CompareResult = { ok: true } | { ok: false; hint?: 'hamza_seat' | 'ta_marbuta' | 'alif_maqsura' }

export function compareAnswer(given: string, expected: string): CompareResult {
  const g = normalizeForCompare(given)
  const e = normalizeForCompare(expected)
  if (g === e) return { ok: true }
  const fold = (x: string) => x.replace(/[أإآٱ]/g, 'ا').replace(/[ؤئ]/g, 'ء')
  if (fold(g) === fold(e)) return { ok: false, hint: 'hamza_seat' }
  if (g.replace(/ة/g, 'ه') === e.replace(/ة/g, 'ه')) return { ok: false, hint: 'ta_marbuta' }
  if (g.replace(/ى/g, 'ي') === e.replace(/ى/g, 'ي')) return { ok: false, hint: 'alif_maqsura' }
  return { ok: false }
}

export type Position = 'isolated' | 'initial' | 'medial' | 'final'

/** Display-only contextual form using ZWJ. Never store the result in answer data. */
export function letterForm(letter: string, position: Position): string {
  const joinsLeft = !NON_CONNECTORS.has(letter)
  switch (position) {
    case 'isolated':
      return letter
    case 'initial':
      return joinsLeft ? letter + ZWJ : letter
    case 'medial':
      return joinsLeft ? ZWJ + letter + ZWJ : ZWJ + letter
    case 'final':
      return ZWJ + letter
  }
}

/**
 * Show a lone vowel mark on a carrier, for DISPLAY only (never in answer data).
 * Uses tatweel: every Arabic font positions marks on it; the dotted circle U+25CC
 * is missing from the web Arabic fonts and breaks mark placement.
 */
export function markOnCarrier(mark: MarkId | string): string {
  const ch = mark in MARKS ? MARKS[mark as MarkId] : mark
  return TATWEEL + TATWEEL + ch + TATWEEL
}

/**
 * The taught items a word needs before it counts as readable:
 * every base letter or variant, and every printed mark.
 * Derived items: lam_alif ligature, sun_article (ال before a sun letter).
 */
export function requiredItems(word: string): Set<string> {
  const w = clean(word)
  const items = new Set<string>()
  const bases = [...w].filter((c) => !MARK_BY_CHAR[c])
  for (const c of w) {
    if (MARK_BY_CHAR[c]) items.add(MARK_BY_CHAR[c])
    else if (VARIANTS[c]) items.add(VARIANTS[c])
    else if (LETTERS[c]) items.add(LETTERS[c])
    else if (c === ' ') continue
    else if ('٠١٢٣٤٥٦٧٨٩'.includes(c)) items.add(`digit_${'٠١٢٣٤٥٦٧٨٩'.indexOf(c)}`)
    else items.add(`unknown:${c}`)
  }
  for (let i = 0; i < bases.length - 1; i++) {
    if (bases[i] === 'ل' && 'اأإآ'.includes(bases[i + 1])) items.add('lam_alif')
  }
  for (const token of w.split(' ')) {
    const b = [...stripMarks(token)]
    if ((b[0] === 'ا' || b[0] === 'ٱ') && b[1] === 'ل' && b[2] && SUN_LETTERS.has(b[2])) items.add('sun_article')
  }
  return items
}

export function isReadable(word: string, taught: Set<string>): boolean {
  for (const it of requiredItems(word)) if (!taught.has(it)) return false
  return true
}

/** Content validator: answer strings must not contain tatweel or joiners. */
export function answerStringProblems(s: string): string[] {
  const p: string[] = []
  if (s.includes(TATWEEL)) p.push('contains tatweel')
  if (s.includes(ZWJ) || s.includes(ZWNJ)) p.push('contains zero-width joiner')
  if (/[0-9]/.test(s)) p.push('contains Western digits')
  return p
}

const EASTERN = '٠١٢٣٤٥٦٧٨٩'
export function toEasternDigits(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => EASTERN[Number(d)])
}

export function hasArabic(s: string): boolean {
  return /[؀-ۿ]/.test(s)
}

/** Contextual position of each letter in a sequence (for showing how letters join). */
export function contextualForms(letters: string[]): Position[] {
  return letters.map((c, i) => {
    const prevJoins = i > 0 && !NON_CONNECTORS.has(letters[i - 1]) && letters[i - 1] !== ' '
    const nextExists = i < letters.length - 1 && letters[i + 1] !== ' '
    const joinsLeft = !NON_CONNECTORS.has(c) && nextExists
    if (prevJoins && joinsLeft) return 'medial'
    if (prevJoins) return 'final'
    if (joinsLeft) return 'initial'
    return 'isolated'
  })
}

/** Base letters of a word (marks removed, hamza seats kept). */
export function baseLetters(word: string): string[] {
  return [...stripMarks(clean(word))].filter((c) => c !== ' ')
}

export function itemIdForChar(c: string): string | undefined {
  return VARIANTS[c] ?? LETTERS[c]
}
