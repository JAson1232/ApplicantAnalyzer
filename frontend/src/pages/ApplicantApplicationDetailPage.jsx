import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import ScoreBadge from '../components/ScoreBadge';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import ApplicationInsights from '../components/ApplicationInsights';
import SuggestedImprovements from '../components/SuggestedImprovements';

const SCORED_STATUSES = new Set(['scored', 'reviewed']);

export default function ApplicantApplicationDetailPage() {
  const { applicationId } = useParams();
  const { token } = useAuth();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/api/applicant/applications/${applicationId}`, { token })
      .then((data) => setApplication(data.application))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [applicationId, token]);

  if (loading) return <LoadingSpinner className="mt-8" />;
  if (!application) return <p className="text-rose-400">{error || 'Application not found.'}</p>;

  const isScored = SCORED_STATUSES.has(application.status);
  const pendingMessage =
    application.status === 'awaiting_model_selection'
      ? 'Your application is submitted and waiting for admissions to choose an AI model.'
      : 'Scoring is still in progress. Please check back shortly.';

  return (
    <div className="space-y-4">
      <h1 className="text-3xl text-gold-400">Application Outcome</h1>
      <Card>
        <p className="text-sm text-slate-400">Degree</p>
        <p className="text-xl">{application.degree_title}</p>
        <div className="mt-6 flex items-center gap-4">
          <span className="text-slate-300">AI Score</span>
          <ScoreBadge score={application.ai_score} large />
        </div>
        <p className="mt-6 whitespace-pre-wrap text-slate-200">
          {application.ai_reasoning || pendingMessage}
        </p>
        <ApplicationInsights application={application} />
      </Card>

      {isScored && (
        <Card>
          <h2 className="text-xl font-semibold text-gold-400">Suggested Improvements</h2>
          <p className="mt-1 text-sm text-slate-400">
            AI-powered suggestions tailored to help you increase your acceptance probability for
            this programme.
          </p>
          <SuggestedImprovements
            applicationId={applicationId}
            token={token}
            initialSuggestions={application.ai_suggestions}
          />
        </Card>
      )}
    </div>
  );
}
