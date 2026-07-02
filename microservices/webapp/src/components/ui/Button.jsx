const variants = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
}

export default function Button({ variant = 'primary', className = '', children, ...props }) {
  return (
    <button
      className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
