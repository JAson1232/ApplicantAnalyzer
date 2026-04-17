import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/LoadingSpinner';

function FileIndicator({ path, label }) {
  if (!path) return <span className="text-slate-600">—</span>;
  return (
    <a
      href={path}
      target="_blank"
      rel="noreferrer"
      className="text-xs text-gold-400 hover:underline"
      title={`View ${label}`}
    >
      {label}
    </a>
  );
}

export default function UniversityCandidatesListPage() {
  const { token } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/university/candidates', { token })
      .then((data) => setCandidates(data.candidates || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingSpinner className="mt-8" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl text-gold-400">Manual Candidates</h1>
        <Link
          className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-950"
          to="/university/candidates/new"
        >
          New candidate
        </Link>
      </div>
      <p className="text-sm text-slate-400">
        Create your own candidate profiles to test how they would score against any of your degree listings.
      </p>
      {error && <p className="text-rose-400">{error}</p>}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Documents</th>
                <th className="py-2 pr-4">Created</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-t border-slate-800">
                  <td className="py-3 pr-4 font-medium text-slate-100">{c.name}</td>
                  <td className="py-3 pr-4">
                    <div className="flex gap-2">
                      <FileIndicator path={c.personal_statement_path} label="PS" />
                      <FileIndicator path={c.transcript_path} label="Transcript" />
                      <FileIndicator path={c.cv_path} label="CV" />
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-slate-400">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3">
                    <Link className="text-gold-400 hover:underline" to={`/university/candidates/${c.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!candidates.length && (
            <p className="py-4 text-slate-400">No candidates yet. Create one to get started.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
