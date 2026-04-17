import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import FileUploadZone from '../components/FileUploadZone';
import LoadingSpinner from '../components/LoadingSpinner';

const DOC_FIELDS = [
  { key: 'personal_statement', label: 'Personal Statement' },
  { key: 'transcript',         label: 'Academic Transcript' },
  { key: 'cv',                 label: 'CV / Resume' },
];

function DocumentCard({ label, savedPath, updatedAt, file, onFileChange }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-medium text-slate-100">{label}</p>
        {savedPath ? (
          <span className="rounded-full bg-emerald-900/50 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
            Saved
          </span>
        ) : (
          <span className="rounded-full bg-slate-700 px-2.5 py-0.5 text-xs text-slate-400">
            Not uploaded
          </span>
        )}
      </div>
      {savedPath && updatedAt && (
        <p className="text-xs text-slate-500">
          Last updated {new Date(updatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
        </p>
      )}
      <FileUploadZone
        label={savedPath ? 'Replace document (PDF)' : 'Upload document (PDF)'}
        file={file}
        onChange={onFileChange}
      />
    </div>
  );
}

export default function ApplicantProfilePage() {
  const { token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState({ personal_statement: null, transcript: null, cv: null });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/applicant/profile', { token })
      .then((data) => setProfile(data.profile))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const hasAnyFile = Object.values(files).some(Boolean);

  async function handleSave(e) {
    e.preventDefault();
    if (!hasAnyFile) return;

    const formData = new FormData();
    if (files.personal_statement) formData.append('personal_statement', files.personal_statement);
    if (files.transcript)         formData.append('transcript', files.transcript);
    if (files.cv)                 formData.append('cv', files.cv);

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const data = await apiFetch('/api/applicant/profile/documents', {
        method: 'POST',
        token,
        body: formData,
        isFormData: true
      });
      setProfile((prev) => ({ ...prev, ...data.profile }));
      setFiles({ personal_statement: null, transcript: null, cv: null });
      setSuccess('Documents saved successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner className="mt-8" />;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl text-gold-400">Your Profile</h1>

      <Card>
        <h2 className="text-xl font-semibold text-slate-100">Account details</h2>
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Name</p>
            <p className="mt-0.5 text-slate-100">{profile?.full_name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Email</p>
            <p className="mt-0.5 text-slate-100">{profile?.email}</p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold text-slate-100">Your documents</h2>
        <p className="mt-1 text-sm text-slate-400">
          Saved documents can be reused across applications — no need to re-upload each time.
        </p>

        <form onSubmit={handleSave} className="mt-6 space-y-4">
          {DOC_FIELDS.map(({ key, label }) => (
            <DocumentCard
              key={key}
              label={label}
              savedPath={profile?.[key + '_path']}
              updatedAt={profile?.documents_updated_at}
              file={files[key]}
              onFileChange={(f) => {
                setSuccess('');
                setFiles((prev) => ({ ...prev, [key]: f }));
              }}
            />
          ))}

          {error   && <p className="text-sm text-rose-400">{error}</p>}
          {success && <p className="text-sm text-emerald-400">{success}</p>}

          <Button type="submit" disabled={saving || !hasAnyFile}>
            {saving ? 'Saving…' : 'Save documents'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
