import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import ScoreBadge from '../components/ScoreBadge';

const STATUS_COLOUR = {
  scored: 'text-emerald-400',
  pending: 'text-gold-400',
  scoring_failed: 'text-rose-400',
  awaiting_model_selection: 'text-slate-400'
};

const STATUS_LABEL = {
  scored: 'Scored',
  pending: 'Scoring…',
  scoring_failed: 'Failed',
  awaiting_model_selection: 'Queued'
};

export default function UniversityDashboardPage() {
  const { token } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/university/candidates/overview', { token })
      .then(setOverview)
      .catch(() => setOverview({ candidates: [], tests: [] }))
      .finally(() => setLoading(false));
  }, [token]);

  // Group tests by candidate_id for easy lookup
  const testsByCandidate = overview
    ? overview.tests.reduce((acc, t) => {
        if (!acc[t.candidate_id]) acc[t.candidate_id] = [];
        acc[t.candidate_id].push(t);
        return acc;
      }, {})
    : {};

  return (
    <div className="space-y-6">
      <h1 className="text-3xl text-gold-400">Dashboard</h1>

      {/* ── Quick links ─────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="text-xl">Degrees</h2>
          <p className="mt-2 text-sm text-slate-300">Create and maintain degree programmes.</p>
          <Link className="mt-4 inline-block text-gold-400 hover:underline" to="/university/degrees">
            Manage degrees →
          </Link>
        </Card>
        <Card>
          <h2 className="text-xl">Applications</h2>
          <p className="mt-2 text-sm text-slate-300">Review real applicant submissions and AI scores.</p>
          <Link className="mt-4 inline-block text-gold-400 hover:underline" to="/university/applications">
            View applications →
          </Link>
        </Card>
        <Card>
          <h2 className="text-xl">Candidates</h2>
          <p className="mt-2 text-sm text-slate-300">Test your own candidate profiles against any degree.</p>
          <Link className="mt-4 inline-block text-gold-400 hover:underline" to="/university/candidates">
            Manage candidates →
          </Link>
        </Card>
      </div>

      {/* ── Manual candidates overview ───────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl text-slate-100">Manual candidates</h2>
          <Link
            className="rounded-lg bg-gold-500 px-3 py-1.5 text-xs font-semibold text-navy-950"
            to="/university/candidates/new"
          >
            + New candidate
          </Link>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : !overview?.candidates?.length ? (
          <Card>
            <p className="text-slate-400">
              No candidates yet.{' '}
              <Link className="text-gold-400 hover:underline" to="/university/candidates/new">
                Create one
              </Link>{' '}
              to start testing profiles against your degrees.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {overview.candidates.map((candidate) => {
              const tests = testsByCandidate[candidate.id] || [];
              return (
                <Card key={candidate.id}>
                  <div className="flex items-center justify-between">
                    <Link
                      className="font-medium text-gold-400 hover:underline"
                      to={`/university/candidates/${candidate.id}`}
                    >
                      {candidate.name}
                    </Link>
                    <span className="text-xs text-slate-500">
                      {tests.length} {tests.length === 1 ? 'test' : 'tests'}
                    </span>
                  </div>

                  {tests.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500 italic">No tests run yet.</p>
                  ) : (
                    <table className="mt-3 min-w-full text-left text-sm">
                      <thead>
                        <tr className="text-xs text-slate-400">
                          <th className="pb-1 pr-4 font-normal">Degree</th>
                          <th className="pb-1 pr-4 font-normal">Score</th>
                          <th className="pb-1 pr-4 font-normal">Status</th>
                          <th className="pb-1 pr-4 font-normal">Model</th>
                          <th className="pb-1 font-normal">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tests.map((t) => (
                          <tr key={t.id} className="border-t border-slate-800">
                            <td className="py-2 pr-4">
                              <Link
                                className="hover:text-gold-400"
                                to={`/university/candidates/${candidate.id}/tests/${t.id}`}
                              >
                                {t.degree_title}
                              </Link>
                            </td>
                            <td className="py-2 pr-4">
                              <ScoreBadge score={t.ai_score} />
                            </td>
                            <td className={`py-2 pr-4 ${STATUS_COLOUR[t.status] || 'text-slate-400'}`}>
                              {STATUS_LABEL[t.status] || t.status}
                            </td>
                            <td className="py-2 pr-4 text-xs text-slate-500">{t.ai_provider || '—'}</td>
                            <td className="py-2 text-slate-400">
                              {new Date(t.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
