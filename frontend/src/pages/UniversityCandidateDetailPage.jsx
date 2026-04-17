import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import FileUploadZone from '../components/FileUploadZone';
import LoadingSpinner from '../components/LoadingSpinner';
import ScoreBadge from '../components/ScoreBadge';

function fileHref(path) {
  if (!path) return null;
  return path.startsWith('/uploads') ? path : `/uploads/${path.split('/uploads/')[1] || ''}`;
}

const FILE_LABELS = {
  personal_statement: 'Personal Statement',
  transcript: 'Academic Transcript',
  cv: 'CV / Resume'
};

const STATUS_LABEL = {
  awaiting_model_selection: 'Not yet run',
  pending: 'Scoring…',
  scored: 'Scored',
  scoring_failed: 'Failed'
};

export default function UniversityCandidateDetailPage() {
  const { candidateId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [candidate, setCandidate] = useState(null);
  const [tests, setTests] = useState([]);
  const [degrees, setDegrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // File update state
  const [newFiles, setNewFiles] = useState({ personal_statement: null, transcript: null, cv: null });
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [fileError, setFileError] = useState('');

  // Run test state
  const [selectedDegree, setSelectedDegree] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('anthropic');
  const [runningTest, setRunningTest] = useState(false);
  const [testError, setTestError] = useState('');

  // Delete state
  const [deleting, setDeleting] = useState(false);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      apiFetch(`/api/university/candidates/${candidateId}`, { token }),
      apiFetch(`/api/university/candidates/${candidateId}/tests`, { token }),
      apiFetch('/api/university/degrees', { token })
    ])
      .then(([candidateData, testsData, degreesData]) => {
        setCandidate(candidateData.candidate);
        setTests(testsData.tests || []);
        setDegrees(degreesData.degrees || []);
        if (degreesData.degrees?.length > 0 && !selectedDegree) {
          setSelectedDegree(degreesData.degrees[0].id);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId, token]);

  const uploadFiles = async (event) => {
    event.preventDefault();
    const hasFile = Object.values(newFiles).some(Boolean);
    if (!hasFile) { setFileError('Select at least one file to upload.'); return; }

    setUploadingFiles(true);
    setFileError('');
    try {
      const formData = new FormData();
      if (newFiles.personal_statement) formData.append('personal_statement', newFiles.personal_statement);
      if (newFiles.transcript) formData.append('transcript', newFiles.transcript);
      if (newFiles.cv) formData.append('cv', newFiles.cv);

      const data = await apiFetch(`/api/university/candidates/${candidateId}/files`, {
        method: 'PUT',
        token,
        body: formData,
        isFormData: true
      });
      setCandidate(data.candidate);
      setNewFiles({ personal_statement: null, transcript: null, cv: null });
    } catch (err) {
      setFileError(err.message);
    } finally {
      setUploadingFiles(false);
    }
  };

  const runTest = async (event) => {
    event.preventDefault();
    if (!selectedDegree) { setTestError('Select a degree.'); return; }

    setRunningTest(true);
    setTestError('');
    try {
      const data = await apiFetch(`/api/university/candidates/${candidateId}/tests`, {
        method: 'POST',
        token,
        body: { degree_id: selectedDegree, provider: selectedProvider }
      });
      navigate(`/university/candidates/${candidateId}/tests/${data.test.id}`);
    } catch (err) {
      setTestError(err.message);
    } finally {
      setRunningTest(false);
    }
  };

  const deleteCandidate = async () => {
    if (!window.confirm(`Delete candidate "${candidate?.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/university/candidates/${candidateId}`, { method: 'DELETE', token });
      navigate('/university/candidates');
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  };

  if (loading) return <LoadingSpinner className="mt-8" />;
  if (!candidate) return <p className="text-rose-400">{error || 'Candidate not found.'}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link className="text-sm text-slate-400 hover:text-gold-400" to="/university/candidates">
            ← Candidates
          </Link>
          <h1 className="mt-1 text-3xl text-gold-400">{candidate.name}</h1>
        </div>
        <Button onClick={deleteCandidate} disabled={deleting} variant="secondary" className="text-rose-400 hover:text-rose-300">
          {deleting ? 'Deleting…' : 'Delete candidate'}
        </Button>
      </div>

      {error && <p className="text-rose-400">{error}</p>}

      {/* ── Documents ───────────────────────────────────────────────── */}
      <Card>
        <h2 className="text-xl text-slate-100">Documents</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {(['personal_statement', 'transcript', 'cv']).map((key) => {
            const href = fileHref(candidate[`${key}_path`]);
            return (
              <li key={key}>
                <span className="text-slate-400">{FILE_LABELS[key]}: </span>
                {href
                  ? <a className="text-gold-400 hover:underline" href={href} target="_blank" rel="noreferrer">View PDF</a>
                  : <span className="text-slate-600 italic">Not uploaded</span>}
              </li>
            );
          })}
        </ul>

        <form className="mt-5 space-y-3" onSubmit={uploadFiles}>
          <p className="text-sm font-medium text-slate-300">Upload / replace documents</p>
          <FileUploadZone
            label="Personal Statement (PDF)"
            file={newFiles.personal_statement}
            onChange={(file) => setNewFiles((prev) => ({ ...prev, personal_statement: file }))}
          />
          <FileUploadZone
            label="Academic Transcript (PDF)"
            file={newFiles.transcript}
            onChange={(file) => setNewFiles((prev) => ({ ...prev, transcript: file }))}
          />
          <FileUploadZone
            label="CV / Resume (PDF)"
            file={newFiles.cv}
            onChange={(file) => setNewFiles((prev) => ({ ...prev, cv: file }))}
          />
          {fileError && <p className="text-sm text-rose-400">{fileError}</p>}
          <Button
            type="submit"
            disabled={uploadingFiles || !Object.values(newFiles).some(Boolean)}
          >
            {uploadingFiles ? 'Uploading…' : 'Upload files'}
          </Button>
        </form>
      </Card>

      {/* ── Run new test ─────────────────────────────────────────────── */}
      <Card>
        <h2 className="text-xl text-slate-100">Run a test</h2>
        <p className="mt-1 text-sm text-slate-400">
          Select a degree and AI model to score this candidate against.
        </p>
        <form className="mt-4 space-y-3" onSubmit={runTest}>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-48">
              <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400" htmlFor="degree">
                Degree
              </label>
              <select
                id="degree"
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={selectedDegree}
                onChange={(e) => setSelectedDegree(e.target.value)}
                disabled={runningTest || degrees.length === 0}
              >
                {degrees.length === 0
                  ? <option value="">No degrees available</option>
                  : degrees.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.course_name || d.title}
                      </option>
                    ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400" htmlFor="provider">
                AI model
              </label>
              <select
                id="provider"
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                disabled={runningTest}
              >
                <option value="anthropic">Anthropic (Claude Sonnet 4)</option>
                <option value="google">Google (Gemini 3.1 Flash Lite Preview)</option>
              </select>
            </div>
          </div>
          {testError && <p className="text-sm text-rose-400">{testError}</p>}
          <Button type="submit" disabled={runningTest || degrees.length === 0}>
            {runningTest ? 'Starting test…' : 'Run test'}
          </Button>
        </form>
      </Card>

      {/* ── Past tests ───────────────────────────────────────────────── */}
      <Card>
        <h2 className="text-xl text-slate-100">Test history</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="py-2 pr-4">Degree</th>
                <th className="py-2 pr-4">Score</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Model</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id} className="border-t border-slate-800">
                  <td className="py-3 pr-4">{t.degree_title}</td>
                  <td className="py-3 pr-4">
                    <ScoreBadge score={t.ai_score} />
                  </td>
                  <td className="py-3 pr-4">
                    <span className={
                      t.status === 'scored' ? 'text-emerald-400'
                      : t.status === 'pending' ? 'text-gold-400'
                      : t.status === 'scoring_failed' ? 'text-rose-400'
                      : 'text-slate-400'
                    }>
                      {STATUS_LABEL[t.status] || t.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-400 text-xs">{t.ai_provider || '—'}</td>
                  <td className="py-3 pr-4 text-slate-400">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="py-3">
                    <Link
                      className="text-gold-400 hover:underline"
                      to={`/university/candidates/${candidateId}/tests/${t.id}`}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!tests.length && <p className="py-4 text-slate-400">No tests run yet.</p>}
        </div>
      </Card>
    </div>
  );
}
