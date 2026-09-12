import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AppShell } from '../components/AppShell/AppShell'
import { LandingPage } from '../features/landing/LandingPage'
import { LearningPathPage } from '../features/learning-path/LearningPathPage'
import { KeyLabPage } from '../features/key-lab/KeyLabPage'

export function App() {
  const navigate = useNavigate()

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<LandingPage onNavigate={navigate} />} />
        <Route path="/learn" element={<LearningPathPage onNavigate={navigate} />} />
        <Route path="/lab/keys" element={<KeyLabPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
