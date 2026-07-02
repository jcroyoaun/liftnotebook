export default function Card({ className = '', children, ...props }) {
  return (
    <div className={`bg-card rounded-card shadow-card border border-line p-4 ${className}`} {...props}>
      {children}
    </div>
  )
}
