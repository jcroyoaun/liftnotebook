// Public-domain demonstration photos (Free Exercise DB, The Unlicense),
// self-hosted under /exercise-photos/{id}-{0,1}.jpg as two-frame start/end
// shots. Only high-confidence name matches ship — every mapping was
// reviewed against the actual images; exotic machines (pendulum squat,
// Bayesian curls, Kelso shrugs, ...) intentionally stay line-art-only.
const PHOTO_IDS = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  23, 24, 25, 26, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 39, 40, 41, 42, 43,
  46, 48, 52, 55, 56, 57, 59, 60, 61, 62,
])

export function exercisePhotoUrls(exerciseId) {
  if (!PHOTO_IDS.has(Number(exerciseId))) return null
  return [`/exercise-photos/${exerciseId}-0.jpg`, `/exercise-photos/${exerciseId}-1.jpg`]
}
