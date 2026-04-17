export default function LoadingSpinner({ label = 'Loading...', className = '' }) {
  return (
    <div className={`flex items-center gap-3 text-slate-300 ${className}`}>
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
      <span>{label}</span>
    </div>
  );
}
