import { useState, useCallback, useRef } from 'react'
import { ToastContext } from '../../lib/toastContext'

// In-app toasts replacing browser alert(). Top-anchored below the top bar so
// a toast can never land on top of an open BottomSheet's CTA and masquerade
// as the sheet's own button.
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
      <div className="fixed top-[calc(4rem+env(safe-area-inset-top))] inset-x-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto w-full max-w-sm rounded-card px-4 py-3 text-center text-sm font-medium shadow-raised animate-fade-in ${
              t.variant === 'success'
                ? 'bg-ink text-page'
                : 'bg-danger-solid text-on-accent'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
