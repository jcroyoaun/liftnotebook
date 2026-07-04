import { useState, useEffect } from 'react'
import { api } from '../../api/client'
import BottomSheet from '../../components/ui/BottomSheet'
import ExerciseArt from '../../components/ExerciseArt'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

// Mid-workout exercise swap: machine's taken, gear's missing, shoulder says
// no. Pick a replacement, then choose whether it's just for today or a
// permanent change to the day.
export default function SwapSheet({ open, exercise, excludeIds, canPersist, onSwap, onClose }) {
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

  async function confirm(persist) {
    setSaving(true)
    try {
      await onSwap(selected, persist)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={`Swap ${exercise?.exercise_name || ''}`}>
      {!selected ? (
        <div className="space-y-2">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a replacement..."
            autoFocus
          />
          <div className="max-h-64 overflow-y-auto rounded-field border border-line">
            {filtered.length === 0 && <p className="p-3 text-sm text-ink-3">No matches</p>}
            {filtered.map((ex) => (
              <button
                key={ex.id}
                onClick={() => setSelected(ex)}
                className="flex min-h-11 w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink transition-colors hover:bg-wash active:bg-wash"
              >
                <ExerciseArt exerciseId={ex.id} className="h-9 w-9 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{ex.name}</span>
                <span className="shrink-0 text-xs text-ink-4">{ex.movement_pattern}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-field bg-sunken px-3 py-2.5 text-center text-sm">
            <span className="text-ink-3 line-through">{exercise?.exercise_name}</span>
            <span className="mx-2 text-ink-4">→</span>
            <span className="font-semibold text-ink">{selected.name}</span>
          </div>
          <Button onClick={() => confirm(false)} disabled={saving} className="w-full min-h-12">
            Just this workout
          </Button>
          {canPersist && (
            <Button variant="secondary" onClick={() => confirm(true)} disabled={saving} className="w-full min-h-12">
              For the rest of the block
            </Button>
          )}
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
