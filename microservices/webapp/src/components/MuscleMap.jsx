// Front/back body diagrams that highlight an exercise's target muscles.
// Stylized "gym chart" anatomy: silhouette in hairline tokens, primary
// muscles in solid accent, secondaries in a lighter accent — token classes
// only, so both themes work untouched.

// Exact muscle names as stored in the DB → diagram region.
const MUSCLE_TO_REGION = {
  'Pectoralis Major': ['front', 'chest'],
  'Pectoralis Minor': ['front', 'chest'],
  'Anterior Deltoid': ['front', 'delts'],
  'Middle Deltoid': ['front', 'delts'],
  'Biceps Brachii': ['front', 'biceps'],
  'Brachialis': ['front', 'biceps'],
  'Forearm Flexors & Extensors': ['front', 'forearms'],
  'Rectus Abdominis': ['front', 'abs'],
  'Transverse Abdominis': ['front', 'abs'],
  'Obliques': ['front', 'obliques'],
  'Rectus Femoris': ['front', 'quads'],
  'Vastus Lateralis': ['front', 'quads'],
  'Vastus Medialis': ['front', 'quads'],
  'Posterior Deltoid': ['back', 'rdelts'],
  'Latissimus Dorsi': ['back', 'lats'],
  'Rhomboids': ['back', 'midback'],
  'Middle Trapezius': ['back', 'traps'],
  'Lower Trapezius': ['back', 'traps'],
  'Erector Spinae': ['back', 'erectors'],
  'Triceps Brachii': ['back', 'triceps'],
  'Gluteus Maximus': ['back', 'glutes'],
  'Gluteus Medius': ['back', 'glutes'],
  'Gluteus Minimus': ['back', 'glutes'],
  'Bicep Femoris': ['back', 'hams'],
  'Semitendinosus': ['back', 'hams'],
  'Semimembranosus': ['back', 'hams'],
  'Gastrocnemius & Soleus': ['back', 'calves'],
}

function regionClass(level) {
  if (level === 'primary') return 'fill-accent-solid'
  if (level === 'secondary') return 'fill-accent-solid opacity-45'
  return 'fill-line opacity-70'
}

// Mirrored ellipse pair helper (body is symmetric around x=50).
function Pair({ cx, cy, rx, ry }) {
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
      <ellipse cx={100 - cx} cy={cy} rx={rx} ry={ry} />
    </>
  )
}

function Silhouette() {
  // Capsule person: same base for front and back views.
  return (
    <g className="fill-line opacity-35">
      <circle cx="50" cy="14" r="9" />
      <rect x="45.5" y="22" width="9" height="8" rx="3" />
      {/* torso */}
      <path d="M28 32 Q50 26 72 32 L69 74 Q66 96 60 104 L40 104 Q34 96 31 74 Z" />
      {/* arms */}
      <path d="M28 33 Q19 37 17.5 50 L14 78 Q13.5 88 16 98 L22 98 Q24 88 24.5 78 L28 52 Z" />
      <path d="M72 33 Q81 37 82.5 50 L86 78 Q86.5 88 84 98 L78 98 Q76 88 75.5 78 L72 52 Z" />
      {/* hips */}
      <path d="M40 102 L60 102 Q64 110 63 120 L37 120 Q36 110 40 102 Z" />
      {/* legs, split at the knee line */}
      <path d="M37.5 118 L49 118 L48.5 168 Q48 196 46.5 206 L40.5 206 Q38.5 196 38 168 Z" />
      <path d="M62.5 118 L51 118 L51.5 168 Q52 196 53.5 206 L59.5 206 Q61.5 196 62 168 Z" />
      <path d="M40 206 L47 206 L47 211 L40 211 Z" />
      <path d="M53 206 L60 206 L60 211 L53 211 Z" />
    </g>
  )
}

function FrontView({ levels }) {
  return (
    <svg viewBox="0 0 100 220" className="h-auto w-full" role="img" aria-label="Front muscles">
      <Silhouette />
      <g className={regionClass(levels.delts)}>
        <Pair cx={24.5} cy={39} rx={6} ry={5} />
      </g>
      <g className={regionClass(levels.chest)}>
        <path d="M33 38 Q49 35 49 42 L49 54 Q40 58 34 53 Q31 46 33 38 Z" />
        <path d="M67 38 Q51 35 51 42 L51 54 Q60 58 66 53 Q69 46 67 38 Z" />
      </g>
      <g className={regionClass(levels.biceps)}>
        <Pair cx={21.5} cy={58} rx={4.2} ry={9} />
      </g>
      <g className={regionClass(levels.forearms)}>
        <Pair cx={18.5} cy={84} rx={3.8} ry={11} />
      </g>
      <g className={regionClass(levels.abs)}>
        <rect x="43" y="60" width="14" height="36" rx="5" />
      </g>
      <g className={regionClass(levels.obliques)}>
        <path d="M41 62 L41 94 Q37 90 35.5 80 Q34.5 70 37 62 Z" />
        <path d="M59 62 L59 94 Q63 90 64.5 80 Q65.5 70 63 62 Z" />
      </g>
      <g className={regionClass(levels.quads)}>
        <Pair cx={43.5} cy={138} rx={5.5} ry={22} />
        <Pair cx={44.5} cy={148} rx={4} ry={14} />
      </g>
    </svg>
  )
}

function BackView({ levels }) {
  return (
    <svg viewBox="0 0 100 220" className="h-auto w-full" role="img" aria-label="Back muscles">
      <Silhouette />
      <g className={regionClass(levels.traps)}>
        <path d="M50 32 L61 38 L51.5 56 L48.5 56 L39 38 Z" />
      </g>
      <g className={regionClass(levels.rdelts)}>
        <Pair cx={24.5} cy={39} rx={6} ry={5} />
      </g>
      <g className={regionClass(levels.midback)}>
        <path d="M41 46 L48 50 L48 64 L41 60 Z" />
        <path d="M59 46 L52 50 L52 64 L59 60 Z" />
      </g>
      <g className={regionClass(levels.lats)}>
        <path d="M34 50 L44 58 L46 90 Q40 88 36 76 Q33 62 34 50 Z" />
        <path d="M66 50 L56 58 L54 90 Q60 88 64 76 Q67 62 66 50 Z" />
      </g>
      <g className={regionClass(levels.erectors)}>
        <rect x="45.5" y="64" width="4" height="34" rx="2" />
        <rect x="50.5" y="64" width="4" height="34" rx="2" />
      </g>
      <g className={regionClass(levels.triceps)}>
        <Pair cx={21.5} cy={60} rx={4.2} ry={9.5} />
      </g>
      <g className={regionClass(levels.glutes)}>
        <path d="M40 102 Q49 100 49 108 Q49 120 43 122 Q37 119 37 110 Q37 104 40 102 Z" />
        <path d="M60 102 Q51 100 51 108 Q51 120 57 122 Q63 119 63 110 Q63 104 60 102 Z" />
      </g>
      <g className={regionClass(levels.hams)}>
        <Pair cx={44} cy={146} rx={5.5} ry={20} />
      </g>
      <g className={regionClass(levels.calves)}>
        <Pair cx={43.5} cy={182} rx={4.5} ry={13} />
      </g>
    </svg>
  )
}

export default function MuscleMap({ targets }) {
  if (!targets?.length) return null

  const levels = {}
  for (const t of targets) {
    const mapped = MUSCLE_TO_REGION[t.muscle_name]
    if (!mapped) continue
    const key = mapped[1]
    // primary wins over secondary when both hit the same region
    if (levels[key] !== 'primary') {
      levels[key] = t.target_type === 'primary' ? 'primary' : 'secondary'
    }
  }
  if (Object.keys(levels).length === 0) return null

  return (
    <div>
      <div className="mx-auto grid max-w-72 grid-cols-2 gap-5 rounded-field bg-sunken/60 px-5 py-4">
        <div>
          <FrontView levels={levels} />
          <div className="mt-1.5 text-center text-[10px] font-medium uppercase tracking-[0.08em] text-ink-4">Front</div>
        </div>
        <div>
          <BackView levels={levels} />
          <div className="mt-1.5 text-center text-[10px] font-medium uppercase tracking-[0.08em] text-ink-4">Back</div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-accent-solid" aria-hidden="true" /> Primary
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-accent-solid opacity-45" aria-hidden="true" /> Secondary
        </span>
      </div>
    </div>
  )
}
