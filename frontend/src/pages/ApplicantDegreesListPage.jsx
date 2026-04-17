import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import { mapDegreeForView } from '../lib/mappers';

export default function ApplicantDegreesListPage() {
  const { token } = useAuth();
  const [degrees, setDegrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/applicant/degrees', { token })
      .then((data) => setDegrees((data.degrees || []).map(mapDegreeForView)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingSpinner className="mt-8" />;

  return (
    <div className="space-y-4">
      <h1 className="text-3xl text-gold-400">Available Degrees</h1>
      {error && <p className="text-rose-400">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {degrees.map((degree) => (
          <Card key={degree.id}>
            <h2 className="text-xl">{degree.title}</h2>
            <p className="mt-2 text-sm text-slate-300">{degree.description}</p>
            <Link className="mt-4 inline-block text-gold-400" to={`/applicant/degrees/${degree.id}`}>
              View details →
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
