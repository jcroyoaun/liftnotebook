// Mobile bottom sheet: the phone-friendly replacement for modals.
export default function BottomSheet({ open, onClose, title, children }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        <div className="sticky top-0 bg-white px-4 pt-3 pb-2 border-b border-slate-100 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-800">{title}</div>
          <button onClick={onClose} aria-label="Close" className="p-2 -mr-2 text-slate-400 hover:text-slate-700">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
