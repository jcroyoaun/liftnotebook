// Rest-timer duration preference. Stored per device; the logger reads it on
// every set commit, Settings writes it. 'off' disables the timer entirely.
const KEY = 'restTimerSeconds';
export const REST_OPTIONS = [
  { label: 'Off', value: 'off' },
  { label: '1:30', value: 90 },
  { label: '2:00', value: 120 },
  { label: '3:00', value: 180 },
];
export const DEFAULT_REST_SECONDS = 180;

// Returns a number of seconds, or null when the timer is off.
export function getRestSeconds() {
  const raw = localStorage.getItem(KEY);
  if (raw === 'off') return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_REST_SECONDS;
}

export function setRestSeconds(value) {
  localStorage.setItem(KEY, String(value));
}
