import { Link } from 'react-router-dom'

export default function PageHeader({ title, subtitle, backTo, action }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {backTo && (
          <Link to={backTo} className="inline-flex items-center gap-1 text-xs text-slate-500 mb-1">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        )}
        <h1 className="text-xl font-bold text-slate-900 truncate">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 pt-0.5">{action}</div>}
    </div>
  )
}
