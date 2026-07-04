import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import CreateMesocycle from './pages/CreateMesocycle'
import SetupDayExercises from './pages/SetupDayExercises'
import Workout from './features/workout/WorkoutSession'
import SessionDetail from './pages/SessionDetail'
import Progress from './pages/Progress'
import Volume from './pages/Volume'
import MesocycleHistory from './pages/MesocycleHistory'
import Templates from './pages/Templates'
import AdminTemplates from './pages/AdminTemplates'
import AdminTemplateEditor from './pages/AdminTemplateEditor'
import AdminUsers from './pages/AdminUsers'
import Settings from './pages/Settings'
import AppLayout from './components/layout/AppLayout'
import FocusLayout from './components/layout/FocusLayout'
import { ToastProvider } from './components/ui/Toast'
import { isTokenValid, clearSession, isAdmin } from './auth/session'

function ProtectedRoute({ children }) {
  if (!isTokenValid()) {
    clearSession()
    return <Navigate to="/login" />
  }
  return children
}

function AdminRoute({ children }) {
  if (!isAdmin()) {
    return <Navigate to="/" replace />
  }
  return children
}

export default function App() {
  return (
    <ToastProvider>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Tab destinations share the app chrome (top bar + bottom nav) */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/programs" element={<Navigate to="/programs/history" replace />} />
        <Route path="/programs/new" element={<CreateMesocycle />} />
        <Route path="/programs/templates" element={<Templates />} />
        <Route path="/programs/:id/setup/:dayId" element={<SetupDayExercises />} />
        <Route path="/programs/:id/volume" element={<Volume />} />
        <Route path="/programs/history" element={<MesocycleHistory />} />
        {/* Read-only view of a logged workout; editing stays in /workout */}
        <Route path="/sessions/:id" element={<SessionDetail />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/settings" element={<Settings />} />

        {/* Coach's corner — admin-only surfaces */}
        <Route path="/admin/templates" element={<AdminRoute><AdminTemplates /></AdminRoute>} />
        <Route path="/admin/templates/new" element={<AdminRoute><AdminTemplateEditor /></AdminRoute>} />
        <Route path="/admin/templates/:id/edit" element={<AdminRoute><AdminTemplateEditor /></AdminRoute>} />
        <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
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
