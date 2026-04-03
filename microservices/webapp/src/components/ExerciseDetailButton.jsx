import { useState } from 'react'
import ExerciseDetailModal from './ExerciseDetailModal'

export default function ExerciseDetailButton({ exerciseId, className, children, title = 'View target muscles' }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} title={title}>
        {children}
      </button>
      {open && <ExerciseDetailModal exerciseId={exerciseId} onClose={() => setOpen(false)} />}
    </>
  )
}
