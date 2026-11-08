import { describe, expect, it } from 'vitest'
import {
  answerStringProblems, compareAnswer, isReadable, letterForm, markOnCarrier,
  normalizeForCompare, requiredItems, toEasternDigits,
} from './arabic'

const U1 = new Set(['alif', 'alif_hamza_above', 'ba', 'ta', 'tha', 'nun', 'ya', 'fatha', 'damma', 'kasra', 'sukun'])

describe('normalizeForCompare', () => {
  it('strips vowel marks, tatweel and joiners', () => {
    expect(normalizeForCompare('بَيْتٌ')).toBe('بيت')
    expect(normalizeForCompare('بـيـت')).toBe('بيت')
    expect(normalizeForCompare('‍ب‍')).toBe('ب')
  })
  it('composes decomposed hamza (NFC) and keeps the seat', () => {
    expect(normalizeForCompare('أنا')).toBe('أنا')
    expect(normalizeForCompare('أنا')).not.toBe(normalizeForCompare('انا'))
  })
  it('maps Persian look-alikes', () => {
    expect(normalizeForCompare('بیت')).toBe('بيت')
  })
})

describe('compareAnswer', () => {
  it('accepts unvoweled typing', () => expect(compareAnswer('بيت', 'بَيْت').ok).toBe(true))
  it('gives a hamza hint', () => expect(compareAnswer('انا', 'أنا')).toEqual({ ok: false, hint: 'hamza_seat' }))
  it('gives a ta marbuta hint', () => expect(compareAnswer('مدرسه', 'مَدْرَسة')).toEqual({ ok: false, hint: 'ta_marbuta' }))
})

describe('requiredItems / isReadable', () => {
  it('counts letters and printed marks', () => {
    expect([...requiredItems('بَيْت')].sort()).toEqual(['ba', 'fatha', 'sukun', 'ta', 'ya'])
  })
  it('Unit 1 words', () => {
    for (const w of ['بَيْت', 'باب', 'أنا', 'بِنْت', 'تِين', 'ابْن']) expect(isReadable(w, U1)).toBe(true)
    for (const w of ['كِتاب', 'بُنّ', 'لا', 'مَدْرَسة']) expect(isReadable(w, U1)).toBe(false)
  })
  it('derived items', () => {
    expect(requiredItems('لا').has('lam_alif')).toBe(true)
    expect(requiredItems('الشَّمْس').has('sun_article')).toBe(true)
    expect(requiredItems('القَمَر').has('sun_article')).toBe(false)
  })
})

describe('display helpers', () => {
  it('letter forms use ZWJ, non-connectors do not join left', () => {
    expect(letterForm('ب', 'initial')).toBe('ب‍')
    expect(letterForm('ا', 'medial')).toBe('‍ا')
  })
  it('mark on carrier', () => expect(markOnCarrier('fatha')).toBe('\u0640\u0640\u064E\u0640'))
  it('eastern digits', () => expect(toEasternDigits(2025)).toBe('٢٠٢٥'))
  it('answer validator', () => {
    expect(answerStringProblems('بـ')).toContain('contains tatweel')
    expect(answerStringProblems('بيت')).toEqual([])
  })
})

import { contextualForms, baseLetters } from './arabic'
describe('contextualForms', () => {
  it('handles connectors and non-connectors', () => {
    expect(contextualForms([...'بيت'])).toEqual(['initial', 'medial', 'final'])
    expect(contextualForms([...'باب'])).toEqual(['initial', 'final', 'isolated'])
    expect(contextualForms([...'ابن'])).toEqual(['isolated', 'initial', 'final'])
  })
  it('base letters keep hamza', () => expect(baseLetters('أَب')).toEqual(['أ', 'ب']))
})
