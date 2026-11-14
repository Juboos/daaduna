import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { backend, backendKind } from '../lib/backend'
import { useApp } from '../lib/app-state'
import { Button, Card } from '../components/ui'

export function AuthPage() {
  const [mode, setMode] = useState<'signup' | 'login' | 'forgot'>('signup')
  const [sent, setSent] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { setUser } = useApp()
  const nav = useNavigate()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (mode === 'forgot') { await backend.requestPasswordReset(email); setSent(true); return }
      const u = mode === 'signup' ? await backend.signUp(email, password, nameEn) : await backend.signIn(email, password)
      setUser(u)
      nav('/')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const field = 'mt-1 block w-full min-h-11 rounded-xl border border-line bg-paper px-3'
  return (
    <div className="mx-auto max-w-md pt-6">
      <div className="mb-6 text-center">
        <p lang="ar" dir="rtl" className="ar text-6xl text-brand">ضادُنا</p>
        <p className="mt-2 text-muted">Learn to read, write, hear and say Arabic, from the first letter.</p>
      </div>
      <Card>
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-paper p-1">
          {(['signup', 'login'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`min-h-10 rounded-lg text-sm font-medium ${mode === m || (m === 'login' && mode === 'forgot') ? 'bg-card shadow-sm' : 'text-muted'}`}>
              {m === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <label className="block text-sm font-medium">Your name (in English)
              <input required value={nameEn} onChange={(e) => setNameEn(e.target.value)} className={field} autoComplete="given-name" />
              <span className="mt-1 block text-xs text-muted">Your tutor will write it in Arabic for you.</span>
            </label>
          )}
          <label className="block text-sm font-medium">Email
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} autoComplete="email" />
          </label>
          {mode === 'forgot' && <p className="text-sm text-muted">{sent ? 'If an account exists for this email, a reset link is on its way. Check your inbox.' : "Enter your email and we'll send you a link to choose a new password."}</p>}
          {mode !== 'forgot' && <label className="block text-sm font-medium">Password
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          </label>}
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={mode === 'forgot' && sent}>{mode === 'signup' ? 'Start learning' : mode === 'login' ? 'Sign in' : 'Send reset link'}</Button>
          {mode === 'login' && backendKind === 'supabase' && <button type="button" onClick={() => { setMode('forgot'); setError(null); setSent(false) }} className="w-full text-center text-sm text-muted hover:text-ink">Forgot your password?</button>}
          {mode === 'forgot' && <button type="button" onClick={() => setMode('login')} className="w-full text-center text-sm text-muted hover:text-ink">Back to sign in</button>}
        </form>
        {backendKind === 'local' && <p className="mt-4 text-xs text-muted">Preview build: accounts are stored in this browser only. The first account becomes the admin.</p>}
      </Card>
    </div>
  )
}
