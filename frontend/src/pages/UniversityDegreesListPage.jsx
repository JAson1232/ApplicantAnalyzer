import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import { mapDegreeForView } from '../lib/mappers';

export default function UniversityDegreesListPage() {
  const { token } = useAuth();
  const [degrees, setDegrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/university/degrees', { token })
      .then((data) => setDegrees((data.degrees || []).map(mapDegreeForView)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingSpinner className="mt-8" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl text-gold-400">Degree Programmes</h1>
        <Link className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-950" to="/university/degrees/new">
          New degree
        </Link>
      </div>
      {error && <p className="text-rose-400">{error}</p>}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="py-2">Title</th>
                <th className="py-2">Created</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {degrees.map((degree) => (
                <tr key={degree.id} className="border-t border-slate-800">
                  <td className="py-3">{degree.title}</td>
                  <td>{new Date(degree.created_at).toLocaleDateString()}</td>
                  <td>
                    <Link className="text-gold-400" to={`/university/degrees/${degree.id}/edit`}>
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!degrees.length && <p className="py-4 text-slate-400">No degrees yet.</p>}
        </div>
      </Card>
    </div>
  );
}
