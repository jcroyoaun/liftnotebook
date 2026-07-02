import { Link } from 'react-router-dom'

export default function PageHeader({ title, subtitle, backTo, action }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {backTo && (
          <Link
            to={backTo}
            className="-my-1.5 mb-0.5 inline-flex items-center gap-1 py-1.5 text-[13px] font-medium text-accent"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        )}
        <h1 className="font-display truncate text-[26px] font-semibold leading-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 pt-0.5">{action}</div>}
    </div>
  )
}
