import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import CreateMesocycle from './pages/CreateMesocycle'
import SetupDayExercises from './pages/SetupDayExercises'
import Workout from './features/workout/WorkoutSession'
import Progress from './pages/Progress'
import Volume from './pages/Volume'
import MesocycleHistory from './pages/MesocycleHistory'
import Settings from './pages/Settings'
import AppLayout from './components/layout/AppLayout'
import FocusLayout from './components/layout/FocusLayout'
import { ToastProvider } from './components/ui/Toast'
import { isTokenValid, clearSession } from './auth/session'

function ProtectedRoute({ children }) {
  if (!isTokenValid()) {
    clearSession()
    return <Navigate to="/login" />
  }
  return children
}

export default function App() {
  return (
    <ToastProvider>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Tab destinations share the app chrome (top bar + bottom nav) */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        {/* /programs index becomes the template browser in Phase 2 */}
        <Route path="/programs" element={<Navigate to="/programs/history" replace />} />
        <Route path="/programs/new" element={<CreateMesocycle />} />
        <Route path="/programs/:id/setup/:dayId" element={<SetupDayExercises />} />
        <Route path="/programs/:id/volume" element={<Volume />} />
        <Route path="/programs/history" element={<MesocycleHistory />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* Active workout gets a chrome-less full-focus layout */}
      <Route element={<ProtectedRoute><FocusLayout /></ProtectedRoute>}>
        <Route path="/workout/:sessionId" element={<Workout />} />
      </Route>

      {/* Legacy routes */}
      <Route path="/mesocycle/new" element={<Navigate to="/programs/new" replace />} />
      <Route path="/mesocycles" element={<Navigate to="/programs/history" replace />} />
    </Routes>
    </ToastProvider>
  )
}
