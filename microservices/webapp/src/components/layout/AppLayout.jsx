import { Outlet } from 'react-router-dom'
import TopBar from './TopBar'
import BottomNav from './BottomNav'

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-page">
      <TopBar />
      {/* pb clears the fixed bottom nav (and the active-workout mini-bar
          when present) plus device safe area */}
      <main className="mx-auto max-w-2xl px-5 py-6 pb-44">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
