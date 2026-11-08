import { Link } from 'react-router-dom'
import { course, isUnlocked, lessonsOf } from '../lib/course'
import { useApp } from '../lib/app-state'
import { Icon } from '../components/ui'
import { Ar } from '../components/Ar'

export function UnitMap() {
  const { user, completed, progress } = useApp()
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Hello, {user?.nameEn}</h1>
        <p className="text-muted">
          {user?.nameAr ? <>Your name in Arabic: <Ar size="sm" tr={user.nameArTr}>{user.nameAr}</Ar></> : 'Your Arabic name is coming soon. Your tutor is writing it for you.'}
        </p>
      </section>
      {course.units.map((u) => {
        const lessons = lessonsOf(u.id)
        const done = lessons.filter((l) => completed.has(l.id)).length
        return (
          <section key={u.id}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Unit {u.order} · {u.title}</h2>
              {lessons.length > 0 && <span className="text-sm text-muted">{done}/{lessons.length}</span>}
            </div>
            {lessons.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">Coming in a later phase.</p>
            ) : (
              <ol className="grid gap-2 sm:grid-cols-2">
                {lessons.map((l, i) => {
                  const open = isUnlocked(l.id, completed)
                  const isDone = completed.has(l.id)
                  const started = progress.some((p) => p.lessonId === l.id)
                  const inner = (
                    <div className={`flex min-h-16 items-center gap-3 rounded-2xl border p-3 transition ${open ? 'border-line bg-card hover:border-brand' : 'border-line/60 bg-paper text-muted'}`}>
                      <span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${isDone ? 'bg-brand text-on-brand' : open ? 'bg-brand-soft text-brand' : 'bg-line/60'}`}>
                        {isDone ? Icon.check : open ? i + 1 : Icon.lock}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{l.title}</span>
                        <span className="text-xs text-muted capitalize">{l.type}{started && !isDone ? ' · in progress' : ''}{l.draft ? ' · draft' : ''}{!l.free ? ' · paid' : ''}</span>
                      </span>
                    </div>
                  )
                  return <li key={l.id}>{open ? <Link to={`/lesson/${l.id}`}>{inner}</Link> : inner}</li>
                })}
              </ol>
            )}
          </section>
        )
      })}
    </div>
  )
}
