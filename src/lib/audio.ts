// Audio helpers: playback of recorded/placeholder clips, recording, waveform peaks and pitch contour.
import manifest from '../generated/audio.json'

const clips = manifest as Record<string, { url: string; source: 'recorded' | 'placeholder' }>

/** URL of an audio clip for an Arabic string, if one exists (recorded or generated placeholder). */
export function clipFor(text: string): string | undefined {
  return clips[text]?.url ?? clips[text.normalize('NFC')]?.url
}

let current: HTMLAudioElement | null = null
export function playUrl(url: string, opts: { slow?: boolean; onEnd?: () => void } = {}): HTMLAudioElement {
  current?.pause()
  const a = new Audio(url)
  a.preservesPitch = true
  a.playbackRate = opts.slow ? 0.75 : 1
  a.onended = () => opts.onEnd?.()
  a.onerror = () => opts.onEnd?.()
  a.play().catch(() => opts.onEnd?.())
  current = a
  return a
}
export function stopAudio() { current?.pause(); current = null }

let ctx: AudioContext | null = null
const audioCtx = () => (ctx ??= new AudioContext())

export async function decode(src: Blob | string): Promise<AudioBuffer> {
  const buf = typeof src === 'string' ? await (await fetch(src)).arrayBuffer() : await src.arrayBuffer()
  return audioCtx().decodeAudioData(buf)
}

/** Peak amplitude per bucket, 0..1, for drawing a waveform. */
export function peaks(b: AudioBuffer, n = 120): number[] {
  const d = b.getChannelData(0)
  const size = Math.max(1, Math.floor(d.length / n))
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    let m = 0
    for (let j = i * size; j < Math.min(d.length, (i + 1) * size); j++) m = Math.max(m, Math.abs(d[j]))
    out.push(m)
  }
  const max = Math.max(...out, 0.01)
  return out.map((v) => v / max)
}

/** Rough pitch contour (Hz or null for silence/unvoiced) using autocorrelation, ~25 ms frames. */
export function pitchContour(b: AudioBuffer, n = 80): (number | null)[] {
  const d = b.getChannelData(0)
  const sr = b.sampleRate
  const frame = Math.floor(sr * 0.04)
  const hop = Math.max(1, Math.floor((d.length - frame) / n))
  const minLag = Math.floor(sr / 400), maxLag = Math.floor(sr / 70)
  const out: (number | null)[] = []
  for (let k = 0; k < n; k++) {
    const s = k * hop
    let energy = 0
    for (let i = 0; i < frame && s + i < d.length; i++) energy += d[s + i] ** 2
    if (energy / frame < 1e-4) { out.push(null); continue }
    let best = 0, bestLag = 0
    for (let lag = minLag; lag <= maxLag; lag++) {
      let c = 0
      for (let i = 0; i < frame - lag && s + i + lag < d.length; i++) c += d[s + i] * d[s + i + lag]
      if (c > best) { best = c; bestLag = lag }
    }
    out.push(best / energy > 0.3 && bestLag ? sr / bestLag : null)
  }
  return out
}

/** Pick a recording format the browser supports (Safari: mp4/AAC, Chrome/Firefox: webm/opus). */
export function recordingMime(): string {
  const options = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? ''
}

export type Recording = { blob: Blob; url: string; durationMs: number; mime: string }

export class Recorder {
  private rec: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private chunks: Blob[] = []
  private started = 0

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    const mime = recordingMime()
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined)
    this.chunks = []
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data)
    this.rec.start()
    this.started = performance.now()
  }

  stop(): Promise<Recording> {
    return new Promise((resolve) => {
      const rec = this.rec!
      rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' })
        this.stream?.getTracks().forEach((t) => t.stop())
        resolve({ blob, url: URL.createObjectURL(blob), durationMs: Math.round(performance.now() - this.started), mime: blob.type })
      }
      rec.stop()
    })
  }

  cancel() { try { this.rec?.stop() } catch { /* already stopped */ } this.stream?.getTracks().forEach((t) => t.stop()) }
}
