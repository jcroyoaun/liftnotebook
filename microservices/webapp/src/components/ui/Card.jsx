export default function Card({ className = '', children, ...props }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-4 ${className}`} {...props}>
      {children}
    </div>
  )
}
