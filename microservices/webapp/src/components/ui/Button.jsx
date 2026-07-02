const variants = {
  primary: 'bg-accent-solid text-on-accent hover:bg-accent-press active:bg-accent-press',
  secondary: 'bg-card text-ink border border-line-2 hover:bg-sunken active:bg-sunken',
  danger: 'bg-danger-solid text-on-accent hover:bg-danger-press active:bg-danger-press',
  ghost: 'text-ink-2 hover:text-ink hover:bg-sunken active:bg-sunken',
}

export default function Button({ variant = 'primary', className = '', children, ...props }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-btn px-4 text-sm font-semibold transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
