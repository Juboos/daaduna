import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { backend } from '../lib/backend'
import { Button, Card } from '../components/ui'

/** Opened from the reset email: the link signs the user in, then they choose a new password. */
export function ResetPassword() {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const nav = useNavigate()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (pw !== pw2) return setError('The two passwords are different.')
    try { await backend.updatePassword(pw); setDone(true); setTimeout(() => nav('/'), 1500) } catch (err) { setError((err as Error).message) }
  }

  const field = 'mt-1 block w-full min-h-11 rounded-xl border border-line bg-paper px-3'
  return (
    <div className="mx-auto max-w-md pt-6">
      <Card>
        <h1 className="mb-3 text-xl font-semibold">Choose a new password</h1>
        {done ? <p className="text-success">Password changed. Taking you to the course…</p> : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm font-medium">New password
              <input required type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={field} />
            </label>
            <label className="block text-sm font-medium">Repeat it
              <input required type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={field} />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full">Save password</Button>
          </form>
        )}
      </Card>
    </div>
  )
}
