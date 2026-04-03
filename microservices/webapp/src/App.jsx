import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import CreateMesocycle from './pages/CreateMesocycle'
import SetupDayExercises from './pages/SetupDayExercises'
import Workout from './pages/Workout'
import Progress from './pages/Progress'
import Volume from './pages/Volume'
import MesocycleHistory from './pages/MesocycleHistory'
import Layout from './components/Layout'

function isLoggedIn() {
  return !!localStorage.getItem('token')
}

function ProtectedRoute({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="mesocycle/new" element={<CreateMesocycle />} />
        <Route path="mesocycle/:id/setup/:dayId" element={<SetupDayExercises />} />
        <Route path="workout/:sessionId" element={<Workout />} />
        <Route path="progress" element={<Progress />} />
        <Route path="mesocycle/:id/volume" element={<Volume />} />
        <Route path="mesocycles" element={<MesocycleHistory />} />
      </Route>
    </Routes>
  )
}
