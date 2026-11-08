import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { backend, DEFAULT_SETTINGS, type LessonProgress, type Profile, type Settings } from './backend'

type Ctx = {
  user: Profile | null
  setUser: (u: Profile | null) => void
  refreshUser: () => void
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  progress: LessonProgress[]
  completed: Set<string>
  saveProgress: (p: LessonProgress) => void
  resetProgress: () => void
}

const AppCtx = createContext<Ctx>(null!)
export const useApp = () => useContext(AppCtx)

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(() => backend.currentUser())
  // Load synchronously so the first render already knows what is unlocked.
  const [settings, setSettings] = useState<Settings>(() => (user ? backend.getSettings(user.id) : DEFAULT_SETTINGS))
  const [progress, setProgress] = useState<LessonProgress[]>(() => (user ? backend.getProgress(user.id) : []))

  useEffect(() => {
    setSettings(user ? backend.getSettings(user.id) : DEFAULT_SETTINGS)
    setProgress(user ? backend.getProgress(user.id) : [])
  }, [user?.id])

  useEffect(() => {
    const root = document.documentElement
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => { root.dataset.theme = settings.theme === 'system' ? (mq.matches ? 'dark' : 'light') : settings.theme }
    apply()
    mq.addEventListener('change', apply)
    root.style.setProperty('--font-scale', String(settings.fontScale))
    root.style.setProperty('--ar-font', settings.arFont === 'amiri' ? "'Amiri', serif" : "'Noto Naskh Arabic', serif")
    return () => mq.removeEventListener('change', apply)
  }, [settings])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch }
      if (user) backend.saveSettings(user.id, next)
      return next
    })
  }, [user])

  const value = useMemo<Ctx>(() => ({
    user, setUser,
    refreshUser: () => setUser(backend.currentUser()),
    settings, updateSettings,
    progress,
    completed: new Set(progress.filter((p) => p.status === 'completed').map((p) => p.lessonId)),
    saveProgress: (p) => { if (!user) return; backend.saveProgress(user.id, p); setProgress(backend.getProgress(user.id)) },
    resetProgress: () => { if (!user) return; backend.resetProgress(user.id); setProgress(backend.getProgress(user.id)) },
  }), [user, settings, progress, updateSettings])

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}
