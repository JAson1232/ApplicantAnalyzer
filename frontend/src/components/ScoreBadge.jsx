function badgeStyle(score) {
  if (score === null || score === undefined) {
    return 'bg-slate-700/70 text-slate-200';
  }
  if (score >= 8) {
    return 'bg-gradient-to-r from-emerald-600 to-green-500 text-white';
  }
  if (score >= 6) {
    return 'bg-gradient-to-r from-gold-500 to-amber-400 text-navy-950';
  }
  return 'bg-gradient-to-r from-rose-600 to-red-500 text-white';
}

export default function ScoreBadge({ score, large = false }) {
  const value = score === null || score === undefined ? 'Pending' : `${score}/10`;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-4 py-1 font-semibold ${badgeStyle(
        score
      )} ${large ? 'px-6 py-2 text-2xl' : 'text-sm'}`}
    >
      {value}
    </span>
  );
}
