import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import FileUploadZone from '../components/FileUploadZone';
import LoadingSpinner from '../components/LoadingSpinner';
import { mapDegreeForView } from '../lib/mappers';

const DOC_META = {
  personal_statement: 'Personal Statement',
  transcript:         'Academic Transcript',
  cv:                 'CV / Resume',
};

function DocumentSlot({ fieldKey, savedPath, mode, onModeChange, file, onFileChange }) {
  const label = DOC_META[fieldKey];
  const hasSaved = Boolean(savedPath);

  if (!hasSaved) {
    return (
      <FileUploadZone
        label={`${label} (PDF)`}
        file={file}
        onChange={onFileChange}
      />
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm text-slate-300">{label} (PDF)</p>
      <div className="space-y-2">
        <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
          mode === 'saved'
            ? 'border-gold-500 bg-gold-500/10'
            : 'border-slate-700 hover:border-slate-600'
        }`}>
          <input
            type="radio"
            name={fieldKey}
            checked={mode === 'saved'}
            onChange={() => onModeChange('saved')}
            className="accent-gold-400"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-100">Use saved document</p>
            <p className="truncate text-xs text-slate-400">{savedPath.split('/').pop()}</p>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-900/50 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
            Saved
          </span>
        </label>

        <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
          mode === 'upload'
            ? 'border-gold-500 bg-gold-500/10'
            : 'border-slate-700 hover:border-slate-600'
        }`}>
          <input
            type="radio"
            name={fieldKey}
            checked={mode === 'upload'}
            onChange={() => onModeChange('upload')}
            className="accent-gold-400"
          />
          <div>
            <p className="text-sm font-medium text-slate-100">Upload new document</p>
            <p className="text-xs text-slate-400">Replaces your saved copy</p>
          </div>
        </label>

        {mode === 'upload' && (
          <div className="pl-4">
            <FileUploadZone label="" file={file} onChange={onFileChange} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApplyPage() {
  const { degreeId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [degree, setDegree]         = useState(null);
  const [savedDocs, setSavedDocs]   = useState({});
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  const [docMode, setDocMode] = useState({
    personal_statement: 'saved',
    transcript: 'saved',
    cv: 'saved',
  });
  const [files, setFiles] = useState({
    personal_statement: null,
    transcript: null,
    cv: null,
  });

  useEffect(() => {
    Promise.all([
      apiFetch(`/api/applicant/degrees/${degreeId}`, { token }),
      apiFetch('/api/applicant/profile', { token }),
    ])
      .then(([degreeData, profileData]) => {
        const deg = mapDegreeForView(degreeData.degree);
        setDegree(deg);
        const prof = profileData.profile || {};
        setSavedDocs({
          personal_statement: prof.personal_statement_path || null,
          transcript:         prof.transcript_path         || null,
          cv:                 prof.cv_path                 || null,
        });
        // Default to 'upload' for any doc that has no saved copy
        setDocMode({
          personal_statement: prof.personal_statement_path ? 'saved' : 'upload',
          transcript:         prof.transcript_path         ? 'saved' : 'upload',
          cv:                 prof.cv_path                 ? 'saved' : 'upload',
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [degreeId, token]);

  const requiredFiles = useMemo(
    () => degree?.required_files ?? ['personal_statement', 'transcript', 'cv'],
    [degree]
  );

  const allReady = useMemo(() => {
    return requiredFiles.every((key) => {
      if (docMode[key] === 'saved' && savedDocs[key]) return true;
      if (docMode[key] === 'upload' && files[key])    return true;
      return false;
    });
  }, [requiredFiles, docMode, savedDocs, files]);

  const submitApplication = async (event) => {
    event.preventDefault();
    setError('');
    if (!allReady) {
      setError('Please provide all required documents.');
      return;
    }

    const formData = new FormData();
    for (const key of requiredFiles) {
      if (docMode[key] === 'upload' && files[key]) {
        formData.append(key, files[key]);
      } else if (docMode[key] === 'saved') {
        formData.append(`use_saved_${key}`, 'true');
      }
    }

    setSubmitting(true);
    try {
      const data = await apiFetch(`/api/applicant/apply/${degreeId}`, {
        method: 'POST',
        token,
        body: formData,
        isFormData: true,
      });
      navigate(`/applicant/applications/${data.application.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner className="mt-8" />;
  if (!degree)  return <p className="text-rose-400">{error || 'Degree not found.'}</p>;

  return (
    <Card className="mx-auto max-w-3xl">
      <h1 className="text-3xl text-gold-400">Apply to {degree.title}</h1>
      <p className="mt-3 text-slate-300">
        Upload the required documents in PDF format. Previously saved documents can be reused.
      </p>
      <form className="mt-6 space-y-4" onSubmit={submitApplication}>
        {requiredFiles.map((key) => (
          <DocumentSlot
            key={key}
            fieldKey={key}
            savedPath={savedDocs[key]}
            mode={docMode[key]}
            onModeChange={(m) => setDocMode((prev) => ({ ...prev, [key]: m }))}
            file={files[key]}
            onFileChange={(f) => setFiles((prev) => ({ ...prev, [key]: f }))}
          />
        ))}
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <Button type="submit" disabled={submitting || !allReady}>
          {submitting ? 'Submitting application…' : 'Submit application'}
        </Button>
        {submitting && <LoadingSpinner label="Please wait while your application is being submitted…" />}
      </form>
    </Card>
  );
}
