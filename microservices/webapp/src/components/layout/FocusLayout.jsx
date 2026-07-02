import { Outlet } from 'react-router-dom'

// Chrome-less layout for the active workout: no nav bars to fat-finger
// mid-set, maximum screen space for logging.
export default function FocusLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-2xl mx-auto px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
    </div>
  )
}
