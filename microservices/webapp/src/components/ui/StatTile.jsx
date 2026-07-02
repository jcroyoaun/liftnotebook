import useAnimatedNumber from '../../lib/useAnimatedNumber'

export default function StatTile({ label, value, sub, className = '' }) {
  const display = useAnimatedNumber(value)
  return (
    <div className={`bg-card rounded-card border border-line shadow-card p-3 ${className}`}>
      <div className="font-display text-[26px] font-semibold leading-none text-ink tabular-nums">
        {display}
      </div>
      <div className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.07em] text-ink-3">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-3">{sub}</div>}
    </div>
  )
}
