// Mobile bottom sheet: the phone-friendly replacement for modals.
export default function BottomSheet({ open, onClose, title, children }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />
      <div className="absolute bottom-0 inset-x-0 max-h-[85vh] overflow-y-auto rounded-t-sheet bg-card shadow-sheet pb-[env(safe-area-inset-bottom)] animate-rise">
        <div className="sticky top-0 bg-card px-4 pt-2.5 pb-2 border-b border-line">
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-line-2" aria-hidden="true" />
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[17px] font-semibold text-ink">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 grid h-11 w-11 place-items-center rounded-full text-ink-3 transition-colors hover:bg-sunken hover:text-ink active:scale-95"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
