import { Outlet } from 'react-router-dom'
import TopBar from './TopBar'
import BottomNav from './BottomNav'

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar />
      {/* pb clears the fixed bottom nav plus device safe area */}
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
