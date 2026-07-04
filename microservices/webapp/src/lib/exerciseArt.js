// Hand-authored line-art illustrations for every catalog exercise — one
// consistent style, zero licensing. Scenes are plain shape lists in a
// 100×100 viewBox so both the React renderer (ExerciseArt) and the node
// contact-sheet tool draw identical output.
//
// Colors are semantic slots, resolved at render time:
//   ink    — the athlete (figure)
//   frame  — equipment structure (benches, towers, machines)
//   accent — the implement that moves (bar, handle, pad, cable)
//
// Side view, ground at y≈90. Figure joints are hand-tuned per pose.

const L = (x1, y1, x2, y2, c = 'ink', w = 4.5) => ({ t: 'l', x1, y1, x2, y2, c, w })
const C = (cx, cy, r, c = 'ink', fill = true, w = 3) => ({ t: 'c', cx, cy, r, c, fill, w })
const R = (x, y, w, h, c = 'frame', rx = 1.5) => ({ t: 'r', x, y, w, h, c, rx })
const P = (d, c = 'frame', w = 3, fill = false) => ({ t: 'p', d, c, w, fill })

// Figure from joints: head circle + capsule-stroke segments. Any joint pair
// can be omitted (e.g. no arms visible behind a machine).
function fig(j, w = 4.5) {
  const s = []
  if (j.head) s.push(C(j.head[0], j.head[1], 5, 'ink'))
  const seg = (a, b) => a && b && s.push(L(a[0], a[1], b[0], b[1], 'ink', w))
  seg(j.shoulder, j.hip)
  seg(j.hip, j.knee)
  seg(j.knee, j.ankle)
  if (j.ankle && j.toe) seg(j.ankle, j.toe)
  seg(j.shoulder, j.elbow)
  seg(j.elbow, j.hand)
  // optional second limbs for split stances
  seg(j.hip, j.knee2)
  seg(j.knee2, j.ankle2)
  if (j.ankle2 && j.toe2) seg(j.ankle2, j.toe2)
  seg(j.shoulder, j.elbow2)
  seg(j.elbow2, j.hand2)
  return s
}

const ground = (x1 = 8, x2 = 92) => L(x1, 90, x2, 90, 'frame', 2.5)

// Side-view barbell at a point: plate face + bar hint through it.
const plate = (x, y, r = 9) => [C(x, y, r, 'accent', false, 3.5), C(x, y, 1.8, 'accent')]
// Dumbbell held at a point.
const dumbbell = (x, y, ang = 0) => {
  const dx = Math.cos(ang) * 5, dy = Math.sin(ang) * 5
  return [L(x - dx, y - dy, x + dx, y + dy, 'accent', 3), C(x - dx, y - dy, 2.6, 'accent'), C(x + dx, y + dy, 2.6, 'accent')]
}
// Flat bench (top-of-pad at y), facing right.
const bench = (x, y, len = 40) => [R(x, y, len, 5, 'frame'), L(x + 6, y + 5, x + 6, 90, 'frame', 3), L(x + len - 6, y + 5, x + len - 6, 90, 'frame', 3)]
// Incline pad: from (x,y) base leaning back-right at ~45°.
const inclinePad = (x, y, len = 34) => [
  P(`M ${x} ${y} L ${x + len * 0.6} ${y - len * 0.75}`, 'frame', 6),
  L(x + 4, y + 2, x + 4, 90, 'frame', 3), L(x + 16, y + 6, x + 16, 90, 'frame', 3),
]
// Cable tower on a side, with pulley at (px, py).
const tower = (x, py, tall = true) => [R(x, tall ? 12 : 40, 5, (tall ? 78 : 50), 'frame'), C(x + 2.5, py, 3, 'frame', false, 2.5)]
// Generic machine seat with back pad.
const seat = (x, y) => [R(x, y, 16, 4.5, 'frame'), R(x + 13, y - 20, 4.5, 20, 'frame'), L(x + 8, y + 4.5, x + 8, 90, 'frame', 3)]

export const EXERCISE_ART = {
  // 1 Barbell Back Squat — mid squat, bar behind shoulders
  1: [ground(), ...plate(42, 32, 7), L(38, 33, 54, 34, 'accent', 3),
    ...fig({ head: [58, 24], shoulder: [52, 34], hip: [42, 56], knee: [56, 64], ankle: [52, 86], toe: [62, 86], elbow: [58, 42], hand: [52, 35] })],
  // 2 Barbell Front Squat — bar racked on front delts, elbows high
  2: [ground(), ...plate(58, 33, 6.5),
    ...fig({ head: [52, 23], shoulder: [50, 32], hip: [42, 56], knee: [56, 64], ankle: [52, 86], toe: [62, 86], elbow: [61, 37], hand: [58, 30] })],
  // 3 Sumo Deadlift — wide stance hinge, bar at shins
  3: [ground(), ...plate(58, 76), L(44, 76, 70, 76, 'accent', 3),
    ...fig({ head: [48, 36], shoulder: [48, 44], hip: [38, 60], knee: [30, 72], ankle: [26, 86], toe: [18, 86], knee2: [52, 72], ankle2: [58, 86], toe2: [66, 86], elbow: [52, 56], hand: [56, 74] })],
  // 4 Conventional Deadlift — hinge, bar mid-shin
  4: [ground(), ...plate(60, 76),
    ...fig({ head: [50, 34], shoulder: [50, 42], hip: [36, 56], knee: [44, 72], ankle: [46, 86], toe: [56, 86], elbow: [55, 55], hand: [59, 73] })],
  // 5 Deficit Straight Legged Deadlift — straight legs, deep hinge, standing on block
  5: [ground(), R(38, 84, 22, 6, 'frame'), ...plate(60, 72),
    ...fig({ head: [52, 32], shoulder: [52, 40], hip: [38, 52], knee: [42, 68], ankle: [46, 84], toe: [54, 84], elbow: [56, 52], hand: [59, 69] })],
  // 6 Overhand Pull-up — hanging, chin toward bar
  6: [L(20, 14, 80, 14, 'accent', 3.5), L(24, 8, 24, 14, 'frame', 3), L(76, 8, 76, 14, 'frame', 3),
    ...fig({ head: [50, 24], shoulder: [50, 32], hip: [50, 54], knee: [46, 68], ankle: [52, 80], elbow: [58, 22], hand: [60, 15] })],
  // 7 Underhand Chin-up
  7: [L(20, 14, 80, 14, 'accent', 3.5), L(24, 8, 24, 14, 'frame', 3), L(76, 8, 76, 14, 'frame', 3),
    ...fig({ head: [50, 24], shoulder: [50, 32], hip: [50, 54], knee: [46, 68], ankle: [52, 80], elbow: [42, 22], hand: [42, 15] })],
  // 8 Machine Row (Chest Supported) — seated, chest on pad, pulling handle
  8: [ground(), ...seat(28, 62), R(46, 34, 5, 26, 'frame'),
    ...fig({ head: [40, 26], shoulder: [42, 34], hip: [36, 60], knee: [50, 66], ankle: [56, 84], toe: [64, 84], elbow: [52, 44], hand: [60, 42] }),
    L(60, 42, 74, 42, 'accent', 2), L(74, 36, 74, 48, 'accent', 3)],
  // 9 Overhead Press — standing, bar locked out overhead
  9: [ground(), ...plate(56, 10, 6.5), L(45, 10, 64, 10, 'accent', 3),
    ...fig({ head: [46, 24], shoulder: [50, 34], hip: [50, 58], knee: [50, 72], ankle: [50, 88], toe: [58, 88], elbow: [57, 22], hand: [55, 11] })],
  // 10 Lateral raises — arms out with dumbbells, front stance
  10: [ground(), ...dumbbell(24, 36, 0.3), ...dumbbell(76, 36, -0.3),
    ...fig({ head: [50, 20], shoulder: [50, 32], hip: [50, 56], knee: [44, 70], ankle: [42, 88], toe: [36, 88], knee2: [56, 70], ankle2: [58, 88], toe2: [64, 88], elbow: [36, 34], hand: [26, 36], elbow2: [64, 34], hand2: [74, 36] })],
  // 11 Flat Barbell Bench Press — lying, bar above chest
  11: [ground(), ...bench(28, 64), ...plate(52, 40), L(44, 40, 60, 40, 'accent', 3),
    ...fig({ head: [34, 58], shoulder: [42, 60], hip: [58, 60], knee: [66, 68], ankle: [70, 88], elbow: [50, 50], hand: [52, 41] })],
  // 12 Incline Barbell Bench Press
  12: [ground(), ...inclinePad(30, 78), ...plate(56, 32), L(48, 32, 64, 32, 'accent', 3),
    ...fig({ head: [40, 30], shoulder: [44, 38], hip: [36, 62], knee: [52, 70], ankle: [56, 88], elbow: [52, 44], hand: [56, 33] })],
  // 13 Machine Chest Press — seated, pressing handles forward
  13: [ground(), ...seat(24, 62),
    ...fig({ head: [36, 26], shoulder: [38, 34], hip: [34, 60], knee: [48, 66], ankle: [52, 84], toe: [60, 84], elbow: [48, 40], hand: [60, 36] }),
    L(60, 30, 60, 42, 'accent', 3), L(60, 36, 70, 36, 'frame', 2.5), R(68, 20, 5, 45, 'frame')],
  // 14 Hip Thrust — shoulders on bench, bar on hips, bridge
  14: [ground(), R(14, 52, 18, 5, 'frame'), L(18, 57, 18, 90, 'frame', 3), ...plate(52, 46),
    ...fig({ head: [24, 42], shoulder: [30, 50], hip: [52, 54], knee: [66, 60], ankle: [64, 88], toe: [72, 88], elbow: [40, 56], hand: [50, 52] })],
  // 15 Dumbbell Pullover — lying, dumbbell overhead arc
  15: [ground(), ...bench(30, 64), ...dumbbell(22, 42, 1.2),
    ...fig({ head: [36, 58], shoulder: [44, 60], hip: [60, 60], knee: [68, 68], ankle: [72, 88], elbow: [34, 52], hand: [24, 44] })],
  // 16 Dumbbell Fly — lying, arms wide with dumbbells
  16: [ground(), ...bench(28, 66), ...dumbbell(30, 40, 0), ...dumbbell(66, 40, 0),
    ...fig({ head: [34, 60], shoulder: [44, 62], hip: [60, 62], knee: [68, 70], ankle: [72, 88], elbow: [36, 50], hand: [31, 42], elbow2: [56, 50], hand2: [65, 42] })],
  // 17 Preacher Bicep Curl — arms on angled pad
  17: [ground(), P('M 40 56 L 56 44', 'frame', 6), L(44, 58, 44, 90, 'frame', 3), ...dumbbell(60, 32, 0.5),
    ...fig({ head: [38, 30], shoulder: [40, 38], hip: [38, 62], knee: [50, 70], ankle: [52, 88], elbow: [52, 48], hand: [59, 34] })],
  // 18 Incline Bicep Curl — lying back on incline, arm hanging with dumbbell
  18: [ground(), ...inclinePad(34, 80), ...dumbbell(44, 66, 0.2),
    ...fig({ head: [44, 28], shoulder: [47, 36], hip: [40, 60], knee: [54, 68], ankle: [58, 88], elbow: [48, 50], hand: [45, 64] })],
  // 19 Lying Horizontal Bicep Curl — lying, cable curl toward face
  19: [ground(), ...bench(30, 66), ...tower(84, 60, false), L(84, 60, 46, 56, 'accent', 2), L(44, 52, 48, 60, 'accent', 3),
    ...fig({ head: [36, 60], shoulder: [44, 62], hip: [60, 62], knee: [68, 70], ankle: [72, 88], elbow: [50, 52], hand: [46, 56] })],
  // 20 Cable Pushdown — standing at tower, elbows locked, pressing down
  20: [ground(), ...tower(70, 18), L(72, 18, 56, 46, 'accent', 2), L(50, 46, 62, 46, 'accent', 3),
    ...fig({ head: [42, 22], shoulder: [44, 32], hip: [42, 58], knee: [46, 72], ankle: [44, 88], toe: [52, 88], elbow: [52, 40], hand: [56, 46] })],
  // 21 Overhead Tricep Extension — standing, weight behind head
  21: [ground(), ...dumbbell(58, 22, 0.9),
    ...fig({ head: [46, 22], shoulder: [48, 32], hip: [48, 58], knee: [48, 72], ankle: [48, 88], toe: [56, 88], elbow: [56, 28], hand: [58, 23] })],
  // 22 Front Foot Elevated Split Squat — front foot on block
  22: [ground(), R(16, 80, 16, 10, 'frame'), ...dumbbell(52, 60, 1.3),
    ...fig({ head: [48, 20], shoulder: [46, 30], hip: [44, 52], knee: [30, 62], ankle: [28, 80], toe: [20, 80], knee2: [56, 68], ankle2: [62, 86], toe2: [70, 88], elbow: [50, 44], hand: [52, 56] })],
  // 23 Hip Abductor Machine — seated, knees pressing outward
  23: [ground(), ...seat(38, 62), P('M 34 70 L 26 78', 'accent', 4), P('M 66 70 L 74 78', 'accent', 4),
    ...fig({ head: [52, 28], shoulder: [52, 36], hip: [50, 60], knee: [38, 68], ankle: [40, 84], knee2: [62, 68], ankle2: [60, 84] })],
  // 24 Seated Leg Extensions — shin raising pad
  24: [ground(), ...seat(30, 60), C(62, 72, 3.5, 'accent', false, 3),
    ...fig({ head: [42, 26], shoulder: [42, 34], hip: [40, 58], knee: [54, 62], ankle: [62, 70], toe: [66, 66], elbow: [46, 46], hand: [42, 56] })],
  // 25 Lying Leg Curl — prone, heels curling pad up
  25: [ground(), ...bench(26, 64), C(64, 50, 3.5, 'accent', false, 3),
    ...fig({ head: [30, 56], shoulder: [38, 60], hip: [56, 60], knee: [64, 62], ankle: [64, 50], elbow: [34, 66], hand: [28, 66] })],
  // 26 Weighted 45-Degree Back Extension
  26: [ground(), P('M 28 74 L 48 58', 'frame', 6), L(32, 76, 32, 90, 'frame', 3), C(36, 46, 4, 'accent', false, 3),
    ...fig({ head: [30, 34], shoulder: [34, 42], hip: [48, 58], knee: [54, 70], ankle: [50, 84], elbow: [34, 50], hand: [37, 46] })],
  // 27 Hack Squat — reclined on sled rail, feet on low platform
  27: [ground(), P('M 20 86 L 66 22', 'frame', 5), P('M 28 84 L 52 84', 'accent', 4),
    ...fig({ head: [58, 30], shoulder: [54, 37], hip: [44, 54], knee: [55, 63], ankle: [44, 82], toe: [36, 84] })],
  // 28 Leg Press — reclined, feet on sled plate
  28: [ground(), P('M 62 24 L 80 54', 'accent', 4), ...seat(20, 60),
    ...fig({ head: [30, 34], shoulder: [32, 42], hip: [34, 60], knee: [52, 48], ankle: [64, 34], elbow: [38, 52], hand: [36, 62] })],
  // 29 Hip Adduction Machine — seated, knees squeezing inward
  29: [ground(), ...seat(38, 62), P('M 40 76 L 48 70', 'accent', 4), P('M 60 76 L 52 70', 'accent', 4),
    ...fig({ head: [52, 28], shoulder: [52, 36], hip: [50, 60], knee: [40, 70], ankle: [42, 86], knee2: [60, 70], ankle2: [58, 86] })],
  // 30 Glute Ham Raise — knees anchored, torso lowering
  30: [ground(), R(52, 68, 14, 5, 'frame'), L(58, 73, 58, 90, 'frame', 3), C(70, 78, 3, 'frame', false, 2.5),
    ...fig({ head: [24, 40], shoulder: [28, 48], hip: [46, 62], knee: [58, 66], ankle: [68, 76], elbow: [24, 56], hand: [20, 62] })],
  // 31 Machine Incline Chest Press
  31: [ground(), ...inclinePad(26, 80), L(62, 26, 62, 40, 'accent', 3), L(62, 33, 72, 33, 'frame', 2.5), R(70, 16, 5, 48, 'frame'),
    ...fig({ head: [38, 28], shoulder: [42, 36], hip: [34, 60], knee: [50, 68], ankle: [54, 88], elbow: [52, 42], hand: [61, 33] })],
  // 32 Cable Horizontal Row — seated upright, pulling low cable
  32: [ground(), ...tower(78, 62, false), L(78, 62, 50, 54, 'accent', 2), L(48, 49, 52, 59, 'accent', 3),
    ...fig({ head: [36, 26], shoulder: [38, 36], hip: [38, 62], knee: [54, 58], ankle: [64, 66], toe: [70, 60], elbow: [46, 48], hand: [50, 54] })],
  // 33 Incline Bench Tricep Pushdown — lying on incline, pressing cable down
  33: [ground(), ...inclinePad(28, 80), ...tower(78, 22), L(78, 22, 58, 46, 'accent', 2), L(53, 46, 63, 46, 'accent', 3),
    ...fig({ head: [40, 30], shoulder: [44, 38], hip: [36, 62], knee: [52, 70], ankle: [56, 88], elbow: [52, 42], hand: [58, 46] })],
  // 34 Machine Dips — seated dip, pressing handles down
  34: [ground(), ...seat(30, 58), L(52, 48, 64, 48, 'accent', 3),
    ...fig({ head: [42, 22], shoulder: [44, 32], hip: [40, 56], knee: [54, 64], ankle: [50, 84], elbow: [52, 40], hand: [56, 48] })],
  // 35 Rear Delt Machine Reverse Fly — chest on pad, arms sweeping back
  35: [ground(), R(44, 34, 5, 28, 'frame'), L(48, 62, 48, 90, 'frame', 3),
    ...fig({ head: [38, 26], shoulder: [40, 34], hip: [36, 58], knee: [48, 66], ankle: [52, 84], elbow: [26, 38], hand: [16, 40] }),
    L(16, 34, 16, 46, 'accent', 3)],
  // 36 Standing Machine Calf Raise — pads on shoulders, heels up
  36: [ground(), R(40, 83, 22, 4, 'frame'), R(41, 26, 19, 5, 'accent'),
    ...fig({ head: [50, 16], shoulder: [50, 30], hip: [50, 54], knee: [50, 68], ankle: [49, 80], toe: [57, 83] })],
  // 37 Seated Calf Raise — pad on knees, heels raised
  37: [ground(), ...seat(34, 60), R(46, 52, 16, 5, 'accent'),
    ...fig({ head: [46, 26], shoulder: [46, 34], hip: [44, 58], knee: [56, 60], ankle: [56, 80], toe: [62, 76] })],
  // 38 Standing Single Leg Calf Raise
  38: [ground(), R(40, 84, 20, 6, 'frame'),
    ...fig({ head: [50, 16], shoulder: [50, 28], hip: [50, 54], knee: [50, 70], ankle: [49, 82], toe: [56, 84], knee2: [56, 68], ankle2: [60, 78] })],
  // 39 Wide Grip Pull-up
  39: [L(14, 14, 86, 14, 'accent', 3.5), L(18, 8, 18, 14, 'frame', 3), L(82, 8, 82, 14, 'frame', 3),
    ...fig({ head: [50, 26], shoulder: [50, 34], hip: [50, 56], knee: [46, 70], ankle: [52, 82], elbow: [64, 24], hand: [70, 15], elbow2: [36, 24], hand2: [30, 15] })],
  // 40 T-Bar Row — hinged over, rowing loaded bar end
  40: [ground(), P('M 26 88 L 66 70', 'frame', 3), ...plate(62, 72),
    ...fig({ head: [44, 34], shoulder: [46, 42], hip: [34, 56], knee: [42, 72], ankle: [42, 88], toe: [52, 88], elbow: [52, 54], hand: [58, 66] })],
  // 41 Hammer Curls
  41: [ground(), ...dumbbell(62, 44, 1.4),
    ...fig({ head: [46, 20], shoulder: [48, 32], hip: [48, 58], knee: [48, 72], ankle: [48, 88], toe: [56, 88], elbow: [54, 44], hand: [61, 45] })],
  // 42 Weighted Chin-up — chin-up with plate on belt
  42: [L(20, 14, 80, 14, 'accent', 3.5), L(24, 8, 24, 14, 'frame', 3), L(76, 8, 76, 14, 'frame', 3),
    C(50, 62, 6, 'accent', false, 3), L(50, 54, 50, 58, 'frame', 2),
    ...fig({ head: [50, 24], shoulder: [50, 32], hip: [50, 54], knee: [46, 66], ankle: [52, 78], elbow: [42, 22], hand: [42, 15] })],
  // 43 SSB Bulgarian Split Squat — rear foot on bench, yoke bar
  43: [ground(), R(62, 70, 18, 5, 'frame'), L(68, 75, 68, 90, 'frame', 3), ...plate(38, 28, 6),
    ...fig({ head: [46, 20], shoulder: [44, 30], hip: [40, 52], knee: [48, 62], ankle: [42, 84], toe: [50, 86], knee2: [56, 62], ankle2: [66, 70], elbow: [50, 35], hand: [44, 29] })],
  // 44 Pendulum Squat — squat under swinging shoulder pad
  44: [ground(), C(74, 18, 3, 'frame', false, 2.5), P('M 74 18 L 52 30', 'frame', 3), L(45, 32, 56, 29, 'accent', 4),
    ...fig({ head: [46, 21], shoulder: [50, 32], hip: [42, 56], knee: [56, 64], ankle: [50, 86], toe: [58, 86] })],
  // 45 Machine Hip Press — seated low, driving platform with feet
  45: [ground(), ...seat(20, 64), P('M 66 40 L 78 66', 'accent', 4),
    ...fig({ head: [30, 38], shoulder: [32, 46], hip: [34, 64], knee: [52, 54], ankle: [66, 46], elbow: [38, 56], hand: [36, 66] })],
  // 46 Machine Deadlift — standing pull on machine handles
  46: [ground(), R(64, 30, 5, 55, 'frame'), L(58, 62, 64, 62, 'accent', 3),
    ...fig({ head: [46, 28], shoulder: [47, 36], hip: [40, 56], knee: [46, 72], ankle: [46, 88], toe: [54, 88], elbow: [52, 50], hand: [58, 62] })],
  // 47 Machine Back Extension — driving the back pad rearward
  47: [ground(), ...seat(36, 62), R(28, 34, 5, 22, 'accent'),
    ...fig({ head: [38, 28], shoulder: [36, 38], hip: [44, 60], knee: [58, 64], ankle: [58, 84], elbow: [42, 48], hand: [46, 56] })],
  // 48 Standing Cable Pullover — hinged slightly, sweeping high cable down
  48: [ground(), ...tower(76, 16), L(76, 16, 42, 40, 'accent', 2), L(38, 36, 46, 44, 'accent', 3),
    ...fig({ head: [46, 26], shoulder: [48, 34], hip: [44, 58], knee: [48, 72], ankle: [46, 88], toe: [54, 88], elbow: [46, 40], hand: [42, 40] })],
  // 49 Incline Bench Cable Pullover
  49: [ground(), ...inclinePad(30, 80), ...tower(80, 20), L(80, 20, 40, 34, 'accent', 2), L(36, 30, 44, 38, 'accent', 3),
    ...fig({ head: [42, 30], shoulder: [46, 38], hip: [38, 62], knee: [54, 70], ankle: [58, 88], elbow: [44, 34], hand: [40, 34] })],
  // 50 Machine Pullover — seated, elbows sweeping overhead bar down
  50: [ground(), ...seat(34, 60), P('M 60 20 A 26 26 0 0 1 72 44', 'frame', 2.5), L(56, 26, 66, 22, 'accent', 4),
    ...fig({ head: [46, 26], shoulder: [46, 34], hip: [44, 58], knee: [58, 62], ankle: [58, 82], elbow: [54, 26], hand: [60, 24] })],
  // 51 Single Leg Leg Curl — seated machine, one shin flexing pad
  51: [ground(), ...seat(30, 60), C(58, 78, 3.5, 'accent', false, 3),
    ...fig({ head: [42, 26], shoulder: [42, 34], hip: [40, 58], knee: [54, 62], ankle: [58, 76], toe: [56, 80], knee2: [52, 64], ankle2: [50, 84], elbow: [46, 46], hand: [42, 56] })],
  // 52 Single Leg Leg Extension
  52: [ground(), ...seat(30, 60), C(62, 70, 3.5, 'accent', false, 3),
    ...fig({ head: [42, 26], shoulder: [42, 34], hip: [40, 58], knee: [54, 62], ankle: [62, 68], toe: [66, 64], knee2: [52, 64], ankle2: [50, 84], elbow: [46, 46], hand: [42, 56] })],
  // 53 Seated Bayesian Cable Curl — seated facing away from low cable
  53: [ground(), ...seat(44, 60), ...tower(14, 64, false), L(14, 64, 36, 56, 'accent', 2), L(34, 52, 38, 60, 'accent', 3),
    ...fig({ head: [56, 26], shoulder: [56, 34], hip: [54, 58], knee: [66, 62], ankle: [66, 84], elbow: [48, 44], hand: [37, 56] })],
  // 54 Bayesian Cable Curl — standing facing away, arm behind body line
  54: [ground(), ...tower(16, 60, false), L(16, 60, 44, 52, 'accent', 2), L(42, 48, 46, 56, 'accent', 3),
    ...fig({ head: [56, 20], shoulder: [56, 32], hip: [56, 58], knee: [56, 72], ankle: [54, 88], toe: [62, 88], elbow: [50, 42], hand: [45, 52] })],
  // 55 Incline Bench Cable Overhead Tricep Extension
  55: [ground(), ...inclinePad(30, 80), ...tower(14, 20, true), L(14, 20, 40, 26, 'accent', 2), L(38, 22, 44, 30, 'accent', 3),
    ...fig({ head: [46, 32], shoulder: [48, 40], hip: [40, 62], knee: [56, 70], ankle: [60, 88], elbow: [46, 30], hand: [41, 26] })],
  // 56 Incline Bench Cable Tricep Extension
  56: [ground(), ...inclinePad(30, 80), ...tower(80, 16, true), L(80, 16, 50, 30, 'accent', 2), L(46, 26, 54, 34, 'accent', 3),
    ...fig({ head: [44, 32], shoulder: [46, 40], hip: [38, 62], knee: [54, 70], ankle: [58, 88], elbow: [50, 32], hand: [50, 30] })],
  // 57 Seated Leg Curl — both shins flexing pad under seat
  57: [ground(), ...seat(30, 60), C(56, 80, 3.5, 'accent', false, 3),
    ...fig({ head: [42, 26], shoulder: [42, 34], hip: [40, 58], knee: [54, 62], ankle: [56, 78], toe: [54, 82], elbow: [46, 46], hand: [42, 56] })],
  // 58 T-Bar Kelso Shrug — chest on incline pad, bar hanging from shrug
  58: [ground(), P('M 62 82 L 44 54', 'frame', 6), L(58, 84, 58, 90, 'frame', 3), ...plate(40, 66, 6.5),
    ...fig({ head: [40, 28], shoulder: [43, 37], hip: [54, 60], knee: [64, 68], ankle: [66, 88], elbow: [42, 48], hand: [40, 59] })],
  // 59 Single Leg Leg Press
  59: [ground(), P('M 62 24 L 80 54', 'accent', 4), ...seat(20, 60),
    ...fig({ head: [30, 34], shoulder: [32, 42], hip: [34, 60], knee: [52, 48], ankle: [64, 34], knee2: [46, 66], ankle2: [42, 80], elbow: [38, 52], hand: [36, 62] })],
  // 60 Cable Lateral Raise — arm sweeping cable up and out
  60: [ground(), ...tower(16, 78, false), L(16, 78, 68, 40, 'accent', 2), L(66, 35, 70, 45, 'accent', 3),
    ...fig({ head: [46, 20], shoulder: [46, 32], hip: [46, 58], knee: [46, 72], ankle: [46, 88], toe: [54, 88], elbow: [58, 36], hand: [67, 40] })],
  // 61 Cable Bicep Curl (Straight Bar)
  61: [ground(), ...tower(76, 70, false), L(76, 70, 56, 46, 'accent', 2), L(50, 46, 62, 46, 'accent', 3.5),
    ...fig({ head: [42, 20], shoulder: [44, 32], hip: [44, 58], knee: [44, 72], ankle: [44, 88], toe: [52, 88], elbow: [50, 44], hand: [56, 46] })],
  // 62 Pec Deck — seated, arms sweeping pads together
  62: [ground(), ...seat(38, 62), R(24, 30, 4, 20, 'accent'), R(72, 30, 4, 20, 'accent'),
    ...fig({ head: [50, 24], shoulder: [50, 34], hip: [48, 60], knee: [60, 66], ankle: [60, 84], elbow: [36, 34], hand: [28, 38], elbow2: [64, 34], hand2: [72, 38] })],
}

export function hasExerciseArt(exerciseId) {
  return exerciseId in EXERCISE_ART
}
