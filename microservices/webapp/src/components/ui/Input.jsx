export default function Input({ label, className = '', ...props }) {
  const input = (
    <input
      className={`w-full min-h-11 rounded-field border border-line-2 bg-raised px-3 text-[15px] text-ink placeholder:text-ink-4 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 ${className}`}
      {...props}
    />
  )

  if (!label) return input

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink-2">{label}</label>
      {input}
    </div>
  )
}
