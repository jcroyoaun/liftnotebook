import BottomSheet from './BottomSheet'
import Button from './Button'

// Destructive-action confirmation replacing browser confirm().
export default function ConfirmSheet({ open, title, body, confirmLabel = 'Delete', onConfirm, onClose }) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <p className="mb-4 text-sm text-ink-2">{body}</p>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          className="flex-1"
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </BottomSheet>
  )
}
