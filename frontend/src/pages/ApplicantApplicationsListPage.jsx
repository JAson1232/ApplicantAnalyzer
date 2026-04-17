import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import ScoreBadge from '../components/ScoreBadge';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ApplicantApplicationsListPage() {
  const { token } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/applicant/applications', { token })
      .then((data) => setApplications(data.applications || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingSpinner className="mt-8" />;

  return (
    <div className="space-y-4">
      <h1 className="text-3xl text-gold-400">My Applications</h1>
      {error && <p className="text-rose-400">{error}</p>}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="py-2">Degree</th>
                <th className="py-2">Submitted</th>
                <th className="py-2">Score</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id} className="border-t border-slate-800">
                  <td className="py-3">
                    <Link className="text-gold-400" to={`/applicant/applications/${application.id}`}>
                      {application.degree_title}
                    </Link>
                  </td>
                  <td>{application.submitted_at ? new Date(application.submitted_at).toLocaleDateString() : 'Pending'}</td>
                  <td>
                    <ScoreBadge score={application.ai_score} />
                  </td>
                  <td className="capitalize">{application.status?.replaceAll('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!applications.length && <p className="py-4 text-slate-400">No applications submitted yet.</p>}
        </div>
      </Card>
    </div>
  );
}
