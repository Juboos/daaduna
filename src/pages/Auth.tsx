import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { backend } from '../lib/backend'
import { useApp } from '../lib/app-state'
import { Button, Card } from '../components/ui'

export function AuthPage() {
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
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
            <button key={m} onClick={() => setMode(m)} className={`min-h-10 rounded-lg text-sm font-medium ${mode === m ? 'bg-card shadow-sm' : 'text-muted'}`}>
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
          <label className="block text-sm font-medium">Password
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full">{mode === 'signup' ? 'Start learning' : 'Sign in'}</Button>
        </form>
        <p className="mt-4 text-xs text-muted">Preview build: accounts are stored in this browser only. The first account becomes the admin.</p>
      </Card>
    </div>
  )
}
