import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { apiFetch } from '../lib/api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import ScoreBadge from '../components/ScoreBadge';
import ApplicationInsights from '../components/ApplicationInsights';
import ApplicationChat from '../components/ApplicationChat';

function fileHref(path) {
  if (!path) return '#';
  return path.startsWith('/uploads') ? path : `/uploads/${path.split('/uploads/')[1] || ''}`;
}

export default function UniversityApplicationDetailPage() {
  const { applicationId } = useParams();
  const { token } = useAuth();
  const { startScoringPoll, isPolling, stopPoll, addNotification } = useNotifications();
  const [application, setApplication] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState('anthropic');
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  const fetchDetails = () => {
    setLoading(true);
    apiFetch(`/api/university/applications/${applicationId}`, { token })
      .then((data) => setApplication(data.application))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, token]);

  useEffect(() => {
    if (application?.ai_provider) {
      setSelectedProvider(application.ai_provider);
    }
  }, [application?.ai_provider]);

  useEffect(() => {
    if (application?.status === 'pending' && !isPolling(applicationId)) {
      startScoringPoll(applicationId, application?.degree_title || 'application', token);
    }
  }, [application?.status, application?.degree_title, applicationId, isPolling, startScoringPoll, token]);

  const triggerRescore = async () => {
    setError('');
    try {
      await apiFetch(`/api/score/applications/${applicationId}/trigger`, {
        method: 'POST',
        token,
        body: { provider: selectedProvider }
      });
      // Refresh so the UI shows "pending" status, then poll in background
      fetchDetails();
      startScoringPoll(applicationId, application?.degree_title || 'application', token);
    } catch (err) {
      setError(err.message);
    }
  };

  const cancelScoring = async () => {
    setError('');
    setCancelling(true);
    try {
      await apiFetch(`/api/score/applications/${applicationId}/cancel`, {
        method: 'POST',
        token
      });
      stopPoll(applicationId);
      addNotification(`Scoring cancelled for "${application?.degree_title || 'application'}"`, 'info');
      fetchDetails();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <LoadingSpinner className="mt-8" />;
  if (!application) return <p className="text-rose-400">{error || 'Application not found.'}</p>;
  const isProcessing = application.status === 'pending' || isPolling(applicationId);
  const controlsDisabled = isProcessing || cancelling;
  const actionLabel = application.ai_score === null || application.ai_score === undefined ? 'Queue processing' : 'Re-score with selected model';

  return (
    <div className="space-y-4">
      <ApplicationChat applicationId={applicationId} token={token} />
      <h1 className="text-3xl text-gold-400">Application #{application.id}</h1>
      {error && <p className="text-rose-400">{error}</p>}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">Degree</p>
            <p className="text-xl">{application.degree_title}</p>
          </div>
          <ScoreBadge score={application.ai_score} large />
        </div>
        {!application.ai_full_result && (
          <p className="mt-4 text-slate-400 italic">
            {application.status === 'pending'
              ? 'Scoring in progress…'
              : application.status === 'awaiting_model_selection'
                ? 'Waiting for model selection and queueing by admissions.'
                : 'No analysis available yet.'}
          </p>
        )}
        <ApplicationInsights application={application} />
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400" htmlFor="provider">
              AI model provider
            </label>
            <select
              id="provider"
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={selectedProvider}
              onChange={(event) => setSelectedProvider(event.target.value)}
              disabled={controlsDisabled}
            >
              <option value="anthropic">Anthropic (Claude Sonnet 4)</option>
              <option value="google">Google (Gemini 3.1 Flash Lite Preview)</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={triggerRescore} disabled={controlsDisabled}>
              {isProcessing ? 'Scoring in progress...' : actionLabel}
            </Button>
            <Button onClick={cancelScoring} disabled={!isProcessing || cancelling} variant="secondary">
              {cancelling ? 'Cancelling...' : 'Cancel scoring'}
            </Button>
          </div>
        </div>
        {application.ai_provider && (
          <p className="mt-3 text-xs text-slate-400">
            Last queued model: {application.ai_provider} {application.ai_model ? `(${application.ai_model})` : ''}
          </p>
        )}
      </Card>
      <Card>
        <h2 className="text-xl">Documents</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <a className="text-gold-400" href={fileHref(application.personal_statement_path)} target="_blank" rel="noreferrer">
              Personal statement
            </a>
          </li>
          <li>
            <a className="text-gold-400" href={fileHref(application.transcript_path)} target="_blank" rel="noreferrer">
              Transcript
            </a>
          </li>
          <li>
            <a className="text-gold-400" href={fileHref(application.cv_path)} target="_blank" rel="noreferrer">
              CV
            </a>
          </li>
        </ul>
      </Card>
    </div>
  );
}
