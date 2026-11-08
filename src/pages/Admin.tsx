import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { backend, type Profile } from '../lib/backend'
import { useApp } from '../lib/app-state'
import { answerStringProblems, clean, hasArabic } from '../lib/arabic'
import { Ar } from '../components/Ar'
import { Button, Card } from '../components/ui'

export function Admin() {
  const { user, refreshUser } = useApp()
  const [people, setPeople] = useState<Profile[]>([])
  const load = () => backend.listProfiles().then(setPeople)
  useEffect(() => { load() }, [])

  if (user?.role === 'student') return <p>Not available.</p>
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between"><h1 className="text-2xl font-semibold">Students</h1><span className="flex gap-4"><Link to="/admin/outbox" className="text-sm font-medium text-brand underline-offset-2 hover:underline">Email outbox</Link><Link to="/admin/strokes" className="text-sm font-medium text-brand underline-offset-2 hover:underline">Stroke editor</Link></span></div>
        <p className="text-muted">Write each student's name in Arabic. They see it in lessons, and trace it at the end of Unit 1.</p>
      </div>
      {people.map((p) => <NameRow key={p.id} p={p} onSaved={() => { load(); refreshUser() }} />)}
    </div>
  )
}

function NameRow({ p, onSaved }: { p: Profile; onSaved: () => void }) {
  const [ar, setAr] = useState(p.nameAr ?? '')
  const [tr, setTr] = useState(p.nameArTr ?? '')
  const problems = ar ? [...answerStringProblems(ar), ...(hasArabic(ar) ? [] : ['not Arabic text'])] : []
  return (
    <Card className="flex flex-wrap items-center gap-4">
      <div className="min-w-40">
        <div className="font-medium">{p.nameEn} <span className="text-xs text-muted">({p.role})</span></div>
        <div className="text-sm text-muted">{p.email}</div>
      </div>
      <input lang="ar" dir="rtl" value={ar} onChange={(e) => setAr(e.target.value)} placeholder="الاسم" className="ar min-h-11 w-40 rounded-xl border border-line bg-paper px-3 text-2xl" />
      <input value={tr} onChange={(e) => setTr(e.target.value)} placeholder="transliteration" className="min-h-11 w-36 rounded-xl border border-line bg-paper px-3" />
      <Button disabled={problems.length > 0} onClick={async () => { await backend.setArabicName(p.id, clean(ar), tr.trim()); onSaved() }}>Save</Button>
      {p.nameAr && <Ar size="md" tr={p.nameArTr}>{p.nameAr}</Ar>}
      {problems.length > 0 && <p className="w-full text-sm text-red-600">{problems.join(', ')}</p>}
    </Card>
  )
}
