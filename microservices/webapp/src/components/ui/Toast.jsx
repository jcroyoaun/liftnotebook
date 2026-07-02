import { useState, useCallback, useRef } from 'react'
import { ToastContext } from '../../lib/toastContext'

// In-app toasts replacing browser alert(). Bottom-anchored above the tab bar.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const showToast = useCallback((message, variant = 'error') => {
    const id = nextId.current++
    setToasts((t) => [...t, { id, message, variant }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed bottom-20 inset-x-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto max-w-sm w-full text-center text-sm font-medium rounded-xl px-4 py-3 shadow-lg ${
              t.variant === 'success'
                ? 'bg-slate-900 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
