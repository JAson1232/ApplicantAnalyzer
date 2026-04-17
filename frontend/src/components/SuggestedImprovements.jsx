import { useState } from 'react';
import { apiFetch } from '../lib/api';

const CATEGORY_STYLES = {
  'Academic Profile':    'bg-blue-900/60 text-blue-200',
  'Work Experience':     'bg-emerald-900/60 text-emerald-200',
  'Personal Statement':  'bg-violet-900/60 text-violet-200',
  'Skills & Projects':   'bg-cyan-900/60 text-cyan-200',
  'Extracurriculars':    'bg-orange-900/60 text-orange-200',
  'Document Quality':    'bg-slate-700 text-slate-300',
};

const PRIORITY_STYLES = {
  high:   { badge: 'bg-rose-900/60 text-rose-200',   label: 'High priority' },
  medium: { badge: 'bg-amber-900/60 text-amber-200', label: 'Medium priority' },
  low:    { badge: 'bg-slate-700 text-slate-300',    label: 'Low priority' },
};

function categoryStyle(cat) {
  return CATEGORY_STYLES[cat] || 'bg-slate-700 text-slate-300';
}

function priorityStyle(pri) {
  return PRIORITY_STYLES[pri] || PRIORITY_STYLES.low;
}

function SuggestionCard({ item }) {
  const { badge, label } = priorityStyle(item.priority);
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${categoryStyle(item.category)}`}>
          {item.category}
        </span>
        <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${badge}`}>
          {label}
        </span>
      </div>
      <p className="font-semibold text-slate-100">{item.title}</p>
      <p className="text-sm leading-relaxed text-slate-200">{item.suggestion}</p>
      {item.rationale && (
        <p className="text-xs text-slate-400 italic leading-relaxed">{item.rationale}</p>
      )}
    </div>
  );
}

export default function SuggestedImprovements({ applicationId, token, initialSuggestions }) {
  const [suggestions, setSuggestions] = useState(initialSuggestions || null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const data = await apiFetch(`/api/applicant/applications/${applicationId}/suggestions`, {
        method: 'POST',
        token
      });
      setSuggestions(data.suggestions);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  if (!suggestions) {
    return (
      <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800/40 p-6 text-center space-y-4">
        <p className="text-sm text-slate-400">
          Get personalised, AI-generated suggestions on how to strengthen your profile for this
          programme and similar applications in the future.
        </p>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-lg bg-gold-500 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-gold-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? 'Generating suggestions…' : 'Generate AI Suggestions'}
        </button>
        {generating && (
          <p className="text-xs text-slate-500">This may take up to 30 seconds.</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Overall message */}
      {suggestions.overall_message && (
        <div className="rounded-xl border border-gold-700/40 bg-gold-950/20 px-5 py-4">
          <p className="text-sm leading-relaxed text-gold-100">{suggestions.overall_message}</p>
        </div>
      )}

      {/* Suggestion cards */}
      {suggestions.suggestions?.length > 0 && (
        <div className="space-y-3">
          {suggestions.suggestions.map((item, i) => (
            <SuggestionCard key={i} item={item} />
          ))}
        </div>
      )}

      {/* Quick wins */}
      {suggestions.quick_wins?.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Quick wins
          </p>
          <ul className="space-y-2">
            {suggestions.quick_wins.map((win, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-2.5 text-sm text-slate-200"
              >
                <span className="mt-0.5 text-gold-400 font-bold shrink-0">{i + 1}.</span>
                <span>{win}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
