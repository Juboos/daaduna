import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../lib/app-state'
import { backend } from '../lib/backend'
import { Button, Card } from '../components/ui'

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-0">
      <div><div className="font-medium">{label}</div>{hint && <div className="text-sm text-muted">{hint}</div>}</div>
      <div className="flex gap-1">{children}</div>
    </div>
  )
}

function Seg<T extends string | number | boolean>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-paper p-1">
      {options.map(([v, l]) => (
        <button key={String(v)} onClick={() => onChange(v)} className={`min-h-9 rounded-lg px-3 text-sm ${value === v ? 'bg-card font-medium shadow-sm' : 'text-muted'}`}>{l}</button>
      ))}
    </div>
  )
}

export function SettingsPage() {
  const { settings: s, updateSettings: u, resetProgress, setUser } = useApp()
  const [confirm, setConfirm] = useState(false)
  const nav = useNavigate()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card>
        <Row label="Lesson mode" hint="Read: scroll through the lesson yourself. Narrated: a voice walks you through each section step by step."><Seg value={s.narration} options={[[false, 'Read'], [true, 'Narrated']]} onChange={(v) => u({ narration: v })} /></Row>
        <Row label="Arabic speed"><Seg value={s.slow} options={[[false, 'Normal'], [true, 'Slow']]} onChange={(v) => u({ slow: v })} /></Row>
        <Row label="Transliteration" hint="Auto: on early in the course, fades out later."><Seg value={s.translit} options={[['auto', 'Auto'], ['on', 'On'], ['off', 'Off']]} onChange={(v) => u({ translit: v })} /></Row>
        <Row label="Vowel marks"><Seg value={s.showVowels} options={[[true, 'Show'], [false, 'Hide']]} onChange={(v) => u({ showVowels: v })} /></Row>
        <Row label="Text size"><Seg value={s.fontScale} options={[[0.9, 'S'], [1, 'M'], [1.15, 'L'], [1.3, 'XL']]} onChange={(v) => u({ fontScale: v })} /></Row>
        <Row label="Pen only" hint="On a tablet with a stylus: ignore finger and palm touches while tracing."><Seg value={s.penOnly} options={[[false, 'Off'], [true, 'On']]} onChange={(v) => u({ penOnly: v })} /></Row>
        <Row label="Theme"><Seg value={s.theme} options={[['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]} onChange={(v) => u({ theme: v })} /></Row>
        <Row label="Arabic font" hint="Pick the one that reads best for you.">
          <Seg value={s.arFont} options={[['noto', 'Noto Naskh'], ['amiri', 'Amiri']]} onChange={(v) => u({ arFont: v })} />
        </Row>
        <div className="flex justify-center gap-8 py-3" dir="rtl">
          <span lang="ar" className="ar text-4xl">بَيْتٌ بابٌ أنا</span>
        </div>
      </Card>
      <Card>
        <Row label="Reset progress" hint="Starts the course again and covers the letter table. Your submissions and feedback stay.">
          {confirm
            ? <><Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="danger" onClick={() => { resetProgress(); setConfirm(false); nav('/') }}>Yes, reset</Button></>
            : <Button variant="danger" onClick={() => setConfirm(true)}>Reset…</Button>}
        </Row>
        <Row label="Account"><Button variant="ghost" onClick={async () => { await backend.signOut(); setUser(null); nav('/') }}>Sign out</Button></Row>
      </Card>
    </div>
  )
}
