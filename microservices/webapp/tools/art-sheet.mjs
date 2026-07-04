// Contact sheet for the exercise line-art: renders every scene in
// src/lib/exerciseArt.js to a static HTML grid (light + dark) so the set can
// be screenshotted and eyeballed before shipping.
//   node tools/art-sheet.mjs > /tmp/art-sheet.html
import { EXERCISE_ART } from '../src/lib/exerciseArt.js'

const NAMES = {
  1: 'Barbell Back Squat', 2: 'Barbell Front Squat', 3: 'Sumo Deadlift', 4: 'Conventional Deadlift',
  5: 'Deficit SLDL', 6: 'Overhand Pull-up', 7: 'Chin-up', 8: 'Machine Row (Chest Supp.)',
  9: 'Overhead Press', 10: 'Lateral raises', 11: 'Flat Barbell Bench', 12: 'Incline Barbell Bench',
  13: 'Machine Chest Press', 14: 'Hip Thrust', 15: 'Dumbbell Pullover', 16: 'Dumbbell Fly',
  17: 'Preacher Curl', 18: 'Incline Bicep Curl', 19: 'Lying Horiz. Curl', 20: 'Cable Pushdown',
  21: 'Overhead Tricep Ext.', 22: 'FFE Split Squat', 23: 'Hip Abductor', 24: 'Leg Extensions',
  25: 'Lying Leg Curl', 26: '45° Back Extension', 27: 'Hack Squat', 28: 'Leg Press',
  29: 'Hip Adduction', 30: 'Glute Ham Raise', 31: 'Machine Incline Press', 32: 'Cable Row',
  33: 'Incl. Tricep Pushdown', 34: 'Machine Dips', 35: 'Rear Delt Fly', 36: 'Standing Calf',
  37: 'Seated Calf', 38: 'Single Leg Calf', 39: 'Wide Grip Pull-up', 40: 'T-Bar Row',
  41: 'Hammer Curls', 42: 'Weighted Chin-up', 43: 'SSB Bulgarian', 44: 'Pendulum Squat',
  45: 'Machine Hip Press', 46: 'Machine Deadlift', 47: 'Machine Back Ext.', 48: 'Standing Cable Pullover',
  49: 'Incl. Cable Pullover', 50: 'Machine Pullover', 51: 'SL Leg Curl', 52: 'SL Leg Extension',
  53: 'Seated Bayesian Curl', 54: 'Bayesian Curl', 55: 'Incl. OH Tricep Ext.', 56: 'Incl. Tricep Ext.',
  57: 'Seated Leg Curl', 58: 'Kelso Shrug', 59: 'SL Leg Press', 60: 'Cable Lateral Raise',
  61: 'Cable Curl (Bar)', 62: 'Pec Deck',
}

const THEMES = {
  light: { bg: '#ffffff', ink: '#454e5c', frame: '#c2cad6', accent: '#2563eb' },
  dark: { bg: '#141a24', ink: '#a9b2c2', frame: '#39465a', accent: '#4a80f2' },
}

function shapeToSVG(s, t) {
  const col = t[s.c] || t.ink
  if (s.t === 'l') return `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${col}" stroke-width="${s.w}" stroke-linecap="round"/>`
  if (s.t === 'c') return s.fill
    ? `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="${col}"/>`
    : `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="none" stroke="${col}" stroke-width="${s.w}"/>`
  if (s.t === 'r') return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.rx}" fill="${col}"/>`
  if (s.t === 'p') return `<path d="${s.d}" fill="${s.fill ? col : 'none'}" stroke="${s.fill ? 'none' : col}" stroke-width="${s.w}" stroke-linecap="round"/>`
  return ''
}

function cell(id, theme) {
  const svg = `<svg viewBox="0 0 100 100" width="120" height="120">${EXERCISE_ART[id].map((s) => shapeToSVG(s, theme)).join('')}</svg>`
  return `<div class="cell"><div class="num">${id}</div>${svg}<div class="name">${NAMES[id] || id}</div></div>`
}

const ids = Object.keys(EXERCISE_ART).map(Number).sort((a, b) => a - b)
const grid = (theme) => `<div class="grid" style="background:${theme.bg}">${ids.map((id) => cell(id, theme)).join('')}</div>`

console.log(`<!doctype html><meta charset="utf-8"><style>
.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding:12px}
.cell{position:relative;text-align:center;border:1px solid #8883;border-radius:8px;padding:2px}
.name{font:10px sans-serif;color:#888;padding-bottom:3px}
.num{position:absolute;top:2px;left:5px;font:bold 10px sans-serif;color:#888}
</style><body style="margin:0">${grid(THEMES.light)}${grid(THEMES.dark)}</body>`)
