import { useState, useEffect } from 'react'
import { api } from '../../api/client'
import BottomSheet from '../../components/ui/BottomSheet'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

// Mid-workout plan edits, one sheet: swap an exercise (machine's taken,
// shoulder says no), add one beyond the plan, or drop one from today.
// Everything lands on this workout only — whether it also becomes the plan
// is a single question asked once, at save time.
export default function SwapSheet({ open, exercise, excludeIds, mode = 'swap', onPick, onRemove, onClose }) {
  const [all, setAll] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setSearch('')
    setSelected(null)
    api.getExercises()
      .then((d) => setAll(d.exercises || []))
      .catch(() => setAll([]))
  }, [open])

  const filtered = all.filter(
    (e) => !excludeIds.has(e.id) && e.name.toLowerCase().includes(search.toLowerCase())
  )

  async function confirm() {
    setSaving(true)
    try {
      await onPick(selected)
    } finally {
      setSaving(false)
    }
  }

  const title = mode === 'add' ? 'Add exercise' : `Swap ${exercise?.exercise_name || ''}`

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {!selected ? (
        <div className="space-y-2">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={mode === 'add' ? 'Search an exercise...' : 'Search a replacement...'}
            autoFocus
          />
          <div className="max-h-64 overflow-y-auto rounded-field border border-line">
            {filtered.length === 0 && <p className="p-3 text-sm text-ink-3">No matches</p>}
            {filtered.map((ex) => (
              <button
                key={ex.id}
                onClick={() => setSelected(ex)}
                className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-wash active:bg-wash"
              >
                <span>{ex.name}</span>
                <span className="text-xs text-ink-4">{ex.movement_pattern}</span>
              </button>
            ))}
          </div>
          {mode === 'swap' && onRemove && (
            <button
              onClick={() => onRemove(exercise)}
              className="mt-1 block min-h-11 w-full rounded-btn py-2 text-center text-sm font-medium text-danger transition-colors active:bg-danger-wash"
            >
              Remove from this workout
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {mode === 'add' ? (
            <div className="rounded-field bg-sunken px-3 py-2.5 text-center text-sm">
              <span className="font-semibold text-ink">+ {selected.name}</span>
            </div>
          ) : (
            <div className="rounded-field bg-sunken px-3 py-2.5 text-center text-sm">
              <span className="text-ink-3 line-through">{exercise?.exercise_name}</span>
              <span className="mx-2 text-ink-4">→</span>
              <span className="font-semibold text-ink">{selected.name}</span>
            </div>
          )}
          <Button onClick={confirm} disabled={saving} className="w-full min-h-12">
            {mode === 'add' ? 'Add to workout' : 'Swap in'}
          </Button>
          <button
            onClick={() => setSelected(null)}
            className="block w-full py-1 text-center text-sm font-medium text-accent"
          >
            Pick a different exercise
          </button>
        </div>
      )}
    </BottomSheet>
  )
}
