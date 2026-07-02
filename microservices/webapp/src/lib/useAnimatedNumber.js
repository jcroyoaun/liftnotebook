import { useEffect, useRef, useState } from 'react'

// Animates the numeric portion of a stat value (count-up on mount and on
// change). Handles composite strings like "2/4", "+11.6", "193": the first
// number animates, prefix/suffix stay static. Non-numeric values render
// unchanged. Honors prefers-reduced-motion.
const NUM_RE = /^([^0-9-]*)(-?\d+(?:\.\d+)?)(.*)$/

function countDecimals(s) {
  const i = s.indexOf('.')
  return i === -1 ? 0 : s.length - i - 1
}

function parse(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { prefix: '', num: value, suffix: '', decimals: countDecimals(String(value)) }
  }
  if (typeof value === 'string') {
    const m = value.match(NUM_RE)
    if (m) return { prefix: m[1], num: Number(m[2]), suffix: m[3], decimals: countDecimals(m[2]) }
  }
  return null
}

export default function useAnimatedNumber(value, duration = 600) {
  const parsed = parse(value)
  const target = parsed ? parsed.num : null
  const prev = useRef(0)
  const [num, setNum] = useState(0)

  useEffect(() => {
    if (target == null) return
    const from = prev.current
    prev.current = target
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf
    if (reduce || from === target) {
      raf = requestAnimationFrame(() => setNum(target))
      return () => cancelAnimationFrame(raf)
    }
    let start = null
    const tick = (now) => {
      if (start === null) start = now
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setNum(from + (target - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  if (parsed == null) return value
  return `${parsed.prefix}${num.toFixed(parsed.decimals)}${parsed.suffix}`
}
