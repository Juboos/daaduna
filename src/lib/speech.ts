import { clipFor, playUrl, stopAudio } from './audio'

// Arabic plays a recorded or generated clip when one exists; otherwise the browser's speech engine.
// Recorded files replace this per slide/word (PLAN.md §5).

let voices: SpeechSynthesisVoice[] = []
function refresh() { voices = typeof speechSynthesis !== 'undefined' ? speechSynthesis.getVoices() : [] }
if (typeof speechSynthesis !== 'undefined') { refresh(); speechSynthesis.onvoiceschanged = refresh }

function pick(lang: 'ar' | 'en') {
  return voices.find((v) => v.lang.startsWith(lang) && /Majed|Maged|Tarik|Laila/i.test(v.name)) ?? voices.find((v) => v.lang.startsWith(lang))
}

export function hasArabicVoice() { return !!pick('ar') }

type Opts = { slow?: boolean; onEnd?: () => void; onBoundary?: (charIndex: number) => void; onStart?: () => void }

let token = 0
/** Speak text. onBoundary reports the character index of each word as it is spoken (drives cues and karaoke). */
export function speak(text: string, lang: 'ar' | 'en', opts: Opts = {}) {
  const url = lang === 'ar' ? clipFor(text) : undefined
  if (url) {
    const my = ++token
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
    opts.onStart?.()
    playUrl(url, { slow: opts.slow, onEnd: () => { if (my === token) opts.onEnd?.() } })
    return
  }
  if (typeof speechSynthesis === 'undefined') { opts.onEnd?.(); return }
  stopAudio()
  const my = ++token
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const v = pick(lang)
  if (v) u.voice = v
  u.lang = lang === 'ar' ? 'ar-SA' : 'en-GB'
  u.rate = opts.slow ? 0.6 : lang === 'ar' ? 0.85 : 1
  u.onstart = () => opts.onStart?.()
  u.onboundary = (e) => { if (my === token && e.name !== 'sentence') opts.onBoundary?.(e.charIndex) }
  u.onend = () => { if (my === token) opts.onEnd?.() }
  u.onerror = () => { if (my === token) opts.onEnd?.() }
  speechSynthesis.speak(u)
}

export function stopSpeaking() { token++; stopAudio(); if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel() }
