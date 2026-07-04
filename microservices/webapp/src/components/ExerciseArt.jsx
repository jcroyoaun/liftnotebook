// Renders a catalog exercise's line-art scene (see lib/exerciseArt.js) with
// Cobalt tokens: figure in ink, equipment in hairline gray, the moving
// implement in accent. Returns null for exercises without art yet.
import { EXERCISE_ART } from '../lib/exerciseArt'

const COLOR_CLASS = { ink: 'text-ink-2', frame: 'text-line-2', accent: 'text-accent' }

function Shape({ s }) {
  const cls = COLOR_CLASS[s.c] || COLOR_CLASS.ink
  if (s.t === 'l') {
    return <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} className={cls} stroke="currentColor" strokeWidth={s.w} strokeLinecap="round" />
  }
  if (s.t === 'c') {
    return s.fill
      ? <circle cx={s.cx} cy={s.cy} r={s.r} className={cls} fill="currentColor" />
      : <circle cx={s.cx} cy={s.cy} r={s.r} className={cls} fill="none" stroke="currentColor" strokeWidth={s.w} />
  }
  if (s.t === 'r') {
    return <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} className={cls} fill="currentColor" />
  }
  if (s.t === 'p') {
    return <path d={s.d} className={cls} fill={s.fill ? 'currentColor' : 'none'} stroke={s.fill ? 'none' : 'currentColor'} strokeWidth={s.w} strokeLinecap="round" />
  }
  return null
}

export default function ExerciseArt({ exerciseId, className = '' }) {
  const scene = EXERCISE_ART[exerciseId]
  if (!scene) return null
  return (
    <svg viewBox="0 0 100 100" className={className} data-testid="exercise-art" aria-hidden="true">
      {scene.map((s, i) => <Shape key={i} s={s} />)}
    </svg>
  )
}
