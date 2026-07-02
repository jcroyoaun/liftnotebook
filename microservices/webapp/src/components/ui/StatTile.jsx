export default function StatTile({ label, value, sub, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-3 text-center ${className}`}>
      <div className="text-xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}
