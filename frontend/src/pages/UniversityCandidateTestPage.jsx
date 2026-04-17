import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { apiFetch } from '../lib/api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import ScoreBadge from '../components/ScoreBadge';
import ApplicationInsights from '../components/ApplicationInsights';

export default function UniversityCandidateTestPage() {
  const { candidateId, testId } = useParams();
  const { token } = useAuth();
  const { startScoringPoll, isPolling, stopPoll, addNotification } = useNotifications();

  const [test, setTest] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState('anthropic');
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  const statusUrl = `/api/university/candidates/${candidateId}/tests/${testId}/status`;

  const fetchDetails = () => {
    setLoading(true);
    apiFetch(`/api/university/candidates/${candidateId}/tests/${testId}`, { token })
      .then((data) => setTest(data.test))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId, testId, token]);

  useEffect(() => {
    if (test?.ai_provider) setSelectedProvider(test.ai_provider);
  }, [test?.ai_provider]);

  useEffect(() => {
    if (test?.status === 'pending' && !isPolling(testId)) {
      startScoringPoll(testId, test?.degree_title || 'test', token, statusUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test?.status, testId]);

  // Refresh when polling completes for this test
  useEffect(() => {
    if (!isPolling(testId) && test?.status === 'pending') {
      fetchDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPolling(testId)]);

  const triggerRescore = async () => {
    setError('');
    try {
      await apiFetch(`/api/university/candidates/${candidateId}/tests/${testId}/trigger`, {
        method: 'POST',
        token,
        body: { provider: selectedProvider }
      });
      fetchDetails();
      startScoringPoll(testId, test?.degree_title || 'test', token, statusUrl);
    } catch (err) {
      setError(err.message);
    }
  };

  const cancelScoring = async () => {
    setError('');
    setCancelling(true);
    try {
      await apiFetch(`/api/university/candidates/${candidateId}/tests/${testId}/cancel`, {
        method: 'POST',
        token
      });
      stopPoll(testId);
      addNotification(`Scoring cancelled for "${test?.degree_title || 'test'}"`, 'info');
      fetchDetails();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <LoadingSpinner className="mt-8" />;
  if (!test) return <p className="text-rose-400">{error || 'Test not found.'}</p>;

  const isProcessing = test.status === 'pending' || isPolling(testId);
  const controlsDisabled = isProcessing || cancelling;
  const actionLabel = test.ai_score === null || test.ai_score === undefined
    ? 'Run scoring'
    : 'Re-score with selected model';

  return (
    <div className="space-y-4">
      <div>
        <Link
          className="text-sm text-slate-400 hover:text-gold-400"
          to={`/university/candidates/${candidateId}`}
        >
          ← {test.candidate_name || 'Candidate'}
        </Link>
        <h1 className="mt-1 text-3xl text-gold-400">Test result</h1>
      </div>

      {error && <p className="text-rose-400">{error}</p>}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">Candidate</p>
            <p className="text-xl">{test.candidate_name}</p>
            <p className="mt-1 text-sm text-slate-400">Degree</p>
            <p className="text-lg">{test.degree_title}</p>
          </div>
          <ScoreBadge score={test.ai_score} large />
        </div>

        {!test.ai_full_result && (
          <p className="mt-4 italic text-slate-400">
            {test.status === 'pending'
              ? 'Scoring in progress…'
              : test.status === 'scoring_failed'
                ? `Scoring failed: ${test.ai_reasoning || 'unknown error'}`
                : 'No analysis available yet.'}
          </p>
        )}

        <ApplicationInsights application={test} />

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400" htmlFor="provider">
              AI model provider
            </label>
            <select
              id="provider"
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              disabled={controlsDisabled}
            >
              <option value="anthropic">Anthropic (Claude Sonnet 4)</option>
              <option value="google">Google (Gemini 3.1 Flash Lite Preview)</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={triggerRescore} disabled={controlsDisabled}>
              {isProcessing ? 'Scoring in progress…' : actionLabel}
            </Button>
            <Button onClick={cancelScoring} disabled={!isProcessing || cancelling} variant="secondary">
              {cancelling ? 'Cancelling…' : 'Cancel scoring'}
            </Button>
          </div>
        </div>

        {test.ai_provider && (
          <p className="mt-3 text-xs text-slate-400">
            Last run: {test.ai_provider}{test.ai_model ? ` (${test.ai_model})` : ''}
            {test.scored_at ? ` · ${new Date(test.scored_at).toLocaleString()}` : ''}
          </p>
        )}
      </Card>
    </div>
  );
}
