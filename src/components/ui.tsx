import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { backend } from '../lib/backend'
import { useApp } from '../lib/app-state'

export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const v = {
    primary: 'bg-brand text-on-brand hover:opacity-90',
    ghost: 'border border-line bg-card text-ink hover:bg-brand-soft',
    danger: 'border border-danger/40 text-danger hover:bg-danger-soft',
  }[variant]
  return <button {...p} className={`min-h-11 rounded-xl px-4 font-medium transition disabled:opacity-40 ${v} ${className}`} />
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card p-5 ${className}`}>{children}</div>
}

export const Icon = {
  lock: <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>,
  check: <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 12 5 5 9-10" /></svg>,
  play: <svg viewBox="0 0 24 24" className="size-5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>,
  replay: <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>,
  back: <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>,
  next: <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>,
  speaker: <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /></svg>,
  mute: <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="m22 9-6 6M16 9l6 6" /></svg>,
  slow: <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 16c0-4 3.5-7 8-7s8 3 8 7z" /><path d="M20 16h2M6 16v2M18 16v2" /><circle cx="12" cy="13" r="1" /></svg>,
  sun: <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>,
  moon: <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>,
  pause: <svg viewBox="0 0 24 24" className="size-5" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>,
  skipBack: <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 20 9 12l10-8z" /><path d="M5 19V5" /></svg>,
  skipFwd: <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 4 10 8-10 8z" /><path d="M19 5v14" /></svg>,
  book: <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5" /></svg>,
  headphones: <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><rect x="3" y="14" width="4" height="7" rx="1.5" /><rect x="17" y="14" width="4" height="7" rx="1.5" /></svg>,
  bell: <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>,
  gear: <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
  close: <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" /></svg>,
}

/** In-app notifications: new work for reviewers, feedback for students. */
export function NotificationBell() {
  const { user } = useApp()
  const [open, setOpen] = useState(false)
  const [, setV] = useState(0)
  const nav = useNavigate()
  useEffect(() => backend.subscribe(() => setV((x) => x + 1)), [])
  if (!user) return null
  const list = backend.notifications(user.id)
  const unread = list.filter((n) => !n.readAt).length
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative grid size-10 place-items-center rounded-xl text-muted hover:bg-card-2 hover:text-ink" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
        {Icon.bell}
        {unread > 0 && <span className="absolute end-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="pop-in absolute end-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-2">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && <button onClick={() => backend.markRead(user.id)} className="text-xs text-brand">Mark all read</button>}
            </div>
            <ul className="max-h-96 overflow-y-auto">
              {list.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Nothing yet.</li>}
              {list.slice(0, 30).map((n) => (
                <li key={n.id}>
                  <button onClick={() => { backend.markRead(user.id, [n.id]); setOpen(false); nav(n.kind === 'submission' ? `/review/${n.refId}` : `/work/${n.refId}`) }}
                    className={`flex w-full gap-3 px-4 py-3 text-start text-sm hover:bg-card-2 ${n.readAt ? 'text-muted' : ''}`}>
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-brand'}`} />
                    <span>{n.text}<span className="block text-xs text-muted">{new Date(n.createdAt).toLocaleString()}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

/** One-tap light/dark switch (system preference is the starting point). */
export function ThemeToggle() {
  const { settings, updateSettings } = useApp()
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  return (
    <button onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })} className="grid size-10 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-card-2 hover:text-ink" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
      {dark ? Icon.sun : Icon.moon}
    </button>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const { user } = useApp()
  const link = ({ isActive }: { isActive: boolean }) => `shrink-0 rounded-lg px-2 py-2 text-sm font-medium sm:px-3 ${isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:text-ink'}`
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line/70 bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-2">
          <Link to="/" className="me-auto flex items-baseline gap-2">
            <span lang="ar" dir="rtl" className="ar text-2xl text-brand">ضادُنا</span>
            <span className="hidden font-semibold sm:inline">Daaduna</span>
          </Link>
          {user && (
            <nav className="no-scrollbar -me-1 flex gap-0.5 overflow-x-auto sm:gap-1">
              <NavLink to="/" end className={link}>Course</NavLink>
              <NavLink to="/table" className={link}>Letters</NavLink>
              <NavLink to="/work" className={link}>My work</NavLink>
              {user.role !== 'student' && <NavLink to="/review" className={link}>Review</NavLink>}
              {user.role !== 'student' && <NavLink to="/admin" className={link}>Admin</NavLink>}
            </nav>
          )}
          <NotificationBell />
          <ThemeToggle />
          {user && <NavLink to="/settings" className={({ isActive }) => `grid size-10 shrink-0 place-items-center rounded-xl ${isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-card-2 hover:text-ink'}`} aria-label="Settings">{Icon.gear}</NavLink>}
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  )
}
