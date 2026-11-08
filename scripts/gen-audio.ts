/* eslint-disable @typescript-eslint/no-explicit-any -- walks untyped course JSON */
// Placeholder Arabic audio: every Arabic string the shipped course uses gets an .m4a made with the macOS
// voice "Majed". Your own recordings replace them: drop content/audio/ar/<text>.m4a (file named by the
// exact voweled text) and it wins over the placeholder. Writes src/generated/audio.json (text → url).
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { hasArabic } from '../src/lib/arabic'

const ROOT = join(import.meta.dirname, '..')
const OUT = join(ROOT, 'public/audio/ar')
const RECORDED = join(ROOT, 'content/audio/ar')
const course = JSON.parse(readFileSync(join(ROOT, 'src/generated/course.json'), 'utf8'))

const texts = new Set<string>()
const walk = (x: any) => {
  if (typeof x === 'string') { if (hasArabic(x) && x.length < 80) texts.add(x) }
  else if (Array.isArray(x)) x.forEach(walk)
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) if (!['strokes', 'd', 'name', 'title'].includes(k)) walk(v)
}
walk(course.lessons)
walk(course.words.map((w: any) => w.ar))
course.items.filter((i: any) => i.glyph).forEach((i: any) => texts.add(i.glyph))
// Phrases split into words too, so each word can be tapped on its own.
for (const t of [...texts]) if (t.includes(' ') && !/[٠-٩]/.test(t)) t.split(' ').forEach((w) => texts.add(w))

mkdirSync(OUT, { recursive: true })
const recorded = existsSync(RECORDED) ? new Set(readdirSync(RECORDED)) : new Set<string>()
let hasSay = true
try { execFileSync('say', ['-v', '?'], { stdio: 'ignore' }) } catch { hasSay = false }

const manifest: Record<string, { url: string; source: 'recorded' | 'placeholder' }> = {}
let made = 0
for (const text of texts) {
  const hash = createHash('sha1').update(text).digest('hex').slice(0, 12)
  const file = `${hash}.m4a`
  const target = join(OUT, file)
  if (recorded.has(`${text}.m4a`)) {
    copyFileSync(join(RECORDED, `${text}.m4a`), target)
    manifest[text] = { url: `/audio/ar/${file}`, source: 'recorded' }
    continue
  }
  if (!existsSync(target)) {
    if (!hasSay) continue
    const tmp = join(OUT, `${hash}.aiff`)
    execFileSync('say', ['-v', 'Majed', '-r', '150', '-o', tmp, text])
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '48000', '-c', '1', tmp, target])
    rmSync(tmp)
    made++
  }
  manifest[text] = { url: `/audio/ar/${file}`, source: 'placeholder' }
}
writeFileSync(join(ROOT, 'src/generated/audio.json'), JSON.stringify(manifest))
console.log(`✓ audio: ${Object.keys(manifest).length} clips (${made} new placeholders)${hasSay ? '' : ' — macOS "say" not found, using browser voice'}`)
