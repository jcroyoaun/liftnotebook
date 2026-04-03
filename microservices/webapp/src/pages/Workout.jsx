import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import ExerciseDetailButton from '../components/ExerciseDetailButton'

function NumInput({ value, onCommit, step, min, max, parse = parseFloat, fallback = 0 }) {
  const [display, setDisplay] = useState(String(value ?? ''))
  const prev = useRef(value)

  // Sync from parent when the actual data changes (e.g. new set added)
  if (value !== prev.current) {
    prev.current = value
    setDisplay(String(value ?? ''))
  }

  return (
    <input
      type="number"
      value={display}
      step={step}
      min={min}
      max={max}
      onFocus={e => e.target.select()}
      onChange={e => setDisplay(e.target.value)}
      onBlur={() => {
        if (display === '' && fallback === null) {
          if (value !== null) onCommit(null)
          return
        }
        const parsed = parse(display)
        const final = (display === '' || isNaN(parsed)) ? (fallback ?? 0) : parsed
        setDisplay(String(final))
        if (final !== value) onCommit(final)
      }}
      className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
    />
  )
}

export default function Workout() {
  const { sessionId } = useParams()
  const [session, setSession] = useState(null)
  const [sets, setSets] = useState([])
  const [dayExercises, setDayExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { loadSession() }, [sessionId])

  async function loadSession() {
    try {
      const data = await api.getSession(sessionId)
      setSession(data.session)
      setSets(data.sets || [])

      // Load training day exercises for the template
      const mesoData = await api.getMesocycle(data.session.mesocycle_id)
      const day = (mesoData.days || []).find(d => d.id === data.session.training_day_id)
      setDayExercises(day?.exercises || [])
    } catch (err) {
      console.error('Failed to load session:', err)
    } finally {
      setLoading(false)
    }
  }

  async function logSet(exerciseId, exerciseName) {
    const existingSets = sets.filter(s => s.exercise_id === exerciseId)
    const setNumber = existingSets.length + 1

    // Default to last set's values if available
    const lastSet = existingSets[existingSets.length - 1]
    const weight = lastSet ? lastSet.weight : 0
    const reps = lastSet ? lastSet.reps : 1
    const rir = lastSet?.rir != null ? lastSet.rir : 3

    try {
      const data = await api.logSet({
        workout_session_id: parseInt(sessionId),
        exercise_id: exerciseId,
        set_number: setNumber,
        weight,
        reps,
        rir,
      })
      setSets(prev => [...prev, { ...data.set, exercise_name: exerciseName }])
    } catch (err) {
      alert(err.message)
    }
  }

  async function updateSet(setId, field, value) {
    const setData = sets.find(s => s.id === setId)
    if (!setData) return

    const updates = {
      weight: setData.weight,
      reps: setData.reps,
      rir: setData.rir,
      recorded: setData.recorded,
      [field]: value,
    }

    try {
      await api.updateSet(setId, updates)
      setSets(prev => prev.map(s => s.id === setId ? { ...s, [field]: value } : s))
    } catch (err) {
      alert(err.message)
    }
  }

  async function recordSet(setId) {
    const setData = sets.find(s => s.id === setId)
    if (!setData) return

    const updates = {
      weight: setData.weight,
      reps: setData.reps,
      rir: setData.rir,
      recorded: true,
    }

    try {
      await api.updateSet(setId, updates)
      setSets(prev => prev.map(s => s.id === setId ? { ...s, recorded: true } : s))
    } catch (err) {
      alert(err.message)
    }
  }

  async function deleteSet(setId) {
    try {
      await api.deleteSet(setId)
      setSets(prev => prev.filter(s => s.id !== setId))
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <div className="text-center py-12 text-slate-400">Loading...</div>

  // Group sets by exercise
  const exerciseGroups = []
  const exerciseOrder = dayExercises.length > 0
    ? dayExercises.map(e => ({ id: e.exercise_id, name: e.exercise_name, target_sets: e.target_sets }))
    : [...new Map(sets.map(s => [s.exercise_id, { id: s.exercise_id, name: s.exercise_name, target_sets: 3 }])).values()]

  for (const ex of exerciseOrder) {
    exerciseGroups.push({
      ...ex,
      sets: sets.filter(s => s.exercise_id === ex.id),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{session?.day_label}</h2>
          <p className="text-xs text-slate-500">
            {session?.performed_at && new Date(session.performed_at).toLocaleDateString()}
          </p>
        </div>
        <button onClick={() => navigate('/')}
          className="text-sm bg-green-600 text-white px-4 py-1.5 rounded-lg hover:bg-green-700">
          Finish
        </button>
      </div>

      {exerciseGroups.map(ex => {
        const recordedCount = ex.sets.filter(s => s.recorded).length
        return (
          <div key={ex.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <ExerciseDetailButton
                exerciseId={ex.id}
                className="text-left text-sm font-semibold text-slate-800 hover:text-blue-600"
              >
                {ex.name}
              </ExerciseDetailButton>
              <span className="text-xs text-slate-400">{recordedCount}/{ex.target_sets} sets</span>
            </div>

            {/* Header */}
            <div className="grid grid-cols-12 gap-1 px-4 py-1.5 text-xs text-slate-400 font-medium border-b border-slate-100">
              <div className="col-span-1">#</div>
              <div className="col-span-3">Weight</div>
              <div className="col-span-2">Reps</div>
              <div className="col-span-2">RIR</div>
              <div className="col-span-4"></div>
            </div>

            {/* Sets */}
            {ex.sets.map(set => (
              <div key={set.id} className={`grid grid-cols-12 gap-1 px-4 py-1.5 items-center border-b border-slate-50 ${set.recorded ? 'bg-green-50' : ''}`}>
                <div className="col-span-1 text-xs text-slate-400">{set.set_number}</div>
                <div className="col-span-3">
                  <NumInput value={set.weight} step="2.5" min="0"
                    onCommit={v => updateSet(set.id, 'weight', v)} fallback={0} />
                </div>
                <div className="col-span-2">
                  <NumInput value={set.reps} min="1"
                    parse={parseInt} onCommit={v => updateSet(set.id, 'reps', v)} fallback={1} />
                </div>
                <div className="col-span-2">
                  <NumInput value={set.rir} min="0" max="10"
                    parse={parseInt} onCommit={v => updateSet(set.id, 'rir', v)} fallback={null} />
                </div>
                <div className="col-span-4 flex items-center justify-end gap-1">
                  {!set.recorded ? (
                    <button onClick={() => recordSet(set.id)}
                      className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 font-medium">
                      Done
                    </button>
                  ) : (
                    <span className="text-xs text-green-600 font-medium px-2">Recorded</span>
                  )}
                  <button onClick={() => deleteSet(set.id)} className="text-xs text-red-400 hover:text-red-600 px-1">x</button>
                </div>
              </div>
            ))}

            <button onClick={() => logSet(ex.id, ex.name)}
              className="w-full py-2 text-sm text-blue-600 hover:bg-blue-50 font-medium">
              + Add Set
            </button>
          </div>
        )
      })}
    </div>
  )
}
