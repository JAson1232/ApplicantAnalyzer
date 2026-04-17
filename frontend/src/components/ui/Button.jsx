export default function Button({ children, className = '', variant = 'primary', ...props }) {
  const styles =
    variant === 'secondary'
      ? 'border border-slate-700 text-slate-100 hover:border-gold-500'
      : 'bg-gold-500 text-navy-950 hover:bg-gold-400';

  return (
    <button
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
