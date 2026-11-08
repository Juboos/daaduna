import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { AppProvider, useApp } from './lib/app-state'
import { Shell } from './components/ui'
import { AuthPage } from './pages/Auth'
import { UnitMap } from './pages/UnitMap'
import { LessonPlayer } from './pages/LessonPlayer'
import { CoveredTable } from './pages/CoveredTable'
import { Admin } from './pages/Admin'
import { SettingsPage } from './pages/Settings'
import { StrokeEditor } from './pages/StrokeEditor'
import { MyWork, WorkDetail } from './pages/MyWork'
import { Outbox, ReviewItem, ReviewQueue } from './pages/Review'

function Routed() {
  const { user } = useApp()
  if (!user) return <Shell><AuthPage /></Shell>
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<UnitMap />} />
        <Route path="/lesson/:id" element={<LessonPlayer />} />
        <Route path="/table" element={<CoveredTable />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin/strokes" element={<StrokeEditor />} />
        <Route path="/admin/outbox" element={<Outbox />} />
        <Route path="/work" element={<MyWork />} />
        <Route path="/work/:id" element={<WorkDetail />} />
        <Route path="/review" element={<ReviewQueue />} />
        <Route path="/review/:id" element={<ReviewItem />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Shell>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider><Routed /></AppProvider>
    </BrowserRouter>
  </StrictMode>,
)
