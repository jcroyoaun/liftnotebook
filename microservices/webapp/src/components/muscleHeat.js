// Region logic for the body diagrams: maps DB muscle names onto diagram
// regions and computes either target levels (exercise detail: primary /
// secondary) or volume heat (sets per region, normalized 0..1).

export const MUSCLE_TO_REGION = {
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
  // Hip Adductors have no diagram region — they stay in the bars/table only.
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

// Exercise-detail mode: primary wins over secondary per region.
export function computeRegionLevels(targets) {
  const levels = {}
  for (const t of targets || []) {
    const mapped = MUSCLE_TO_REGION[t.muscle_name]
    if (!mapped) continue
    const key = mapped[1]
    if (levels[key] !== 'primary') {
      levels[key] = t.target_type === 'primary' ? 'primary' : 'secondary'
    }
  }
  return levels
}

// Volume-heat mode: sum merged sets per region, normalize to the busiest
// region. Returns { region: { value, intensity } } — intensity in (0, 1].
export function computeRegionHeat(muscles) {
  const totals = {}
  for (const m of muscles || []) {
    const mapped = MUSCLE_TO_REGION[m.muscle_name]
    if (!mapped) continue
    const sets = Number(m.sets) || 0
    if (sets <= 0) continue
    totals[mapped[1]] = (totals[mapped[1]] || 0) + sets
  }
  const max = Math.max(0, ...Object.values(totals))
  if (max === 0) return {}
  const heat = {}
  for (const [region, value] of Object.entries(totals)) {
    heat[region] = { value: Math.round(value * 10) / 10, intensity: value / max }
  }
  return heat
}
