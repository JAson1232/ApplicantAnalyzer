import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import { mapDegreeForView } from '../lib/mappers';

export default function ApplicantDegreeDetailPage() {
  const { degreeId } = useParams();
  const { token } = useAuth();
  const [degree, setDegree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/api/applicant/degrees/${degreeId}`, { token })
      .then((data) => setDegree(mapDegreeForView(data.degree)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [degreeId, token]);

  if (loading) return <LoadingSpinner className="mt-8" />;
  if (!degree) return <p className="text-rose-400">{error || 'Degree not found.'}</p>;

  return (
    <Card>
      <h1 className="text-3xl text-gold-400">{degree.title}</h1>
      <p className="mt-4 text-slate-200">{degree.description}</p>
      <h2 className="mt-6 text-xl">Requirements</h2>
      <p className="mt-2 whitespace-pre-wrap text-slate-300">{degree.requirements || 'No requirements listed.'}</p>
      <Link
        className="mt-6 inline-block rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-950"
        to={`/applicant/degrees/${degree.id}/apply`}
      >
        Apply now
      </Link>
    </Card>
  );
}
