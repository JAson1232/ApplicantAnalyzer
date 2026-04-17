import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import FileUploadZone from '../components/FileUploadZone';

export default function UniversityCandidateFormPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [files, setFiles] = useState({ personal_statement: null, transcript: null, cv: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const hasAnyFile = Object.values(files).some(Boolean);

  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }

    setSaving(true);
    setError('');
    try {
      // Step 1: create candidate record (JSON)
      const created = await apiFetch('/api/university/candidates', {
        method: 'POST',
        token,
        body: { name: name.trim() }
      });
      const candidateId = created.candidate.id;

      // Step 2: upload files if any were selected
      if (hasAnyFile) {
        const formData = new FormData();
        if (files.personal_statement) formData.append('personal_statement', files.personal_statement);
        if (files.transcript) formData.append('transcript', files.transcript);
        if (files.cv) formData.append('cv', files.cv);

        await apiFetch(`/api/university/candidates/${candidateId}/files`, {
          method: 'PUT',
          token,
          body: formData,
          isFormData: true
        });
      }

      navigate(`/university/candidates/${candidateId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mx-auto max-w-2xl">
      <h1 className="text-3xl text-gold-400">New candidate</h1>
      <p className="mt-2 text-sm text-slate-400">
        Create a manual candidate profile. Documents are optional — you can upload them now or later. At least the
        files required by the target degree must be present before running a test.
      </p>

      <form className="mt-6 space-y-4" onSubmit={submit}>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">
            Candidate name
          </label>
          <Input
            placeholder="e.g. Jane Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
          <p className="mb-3 text-sm font-medium text-slate-300">Documents (optional)</p>
          <div className="space-y-3">
            <FileUploadZone
              label="Personal Statement (PDF)"
              file={files.personal_statement}
              onChange={(file) => setFiles((prev) => ({ ...prev, personal_statement: file }))}
            />
            <FileUploadZone
              label="Academic Transcript (PDF)"
              file={files.transcript}
              onChange={(file) => setFiles((prev) => ({ ...prev, transcript: file }))}
            />
            <FileUploadZone
              label="CV / Resume (PDF)"
              file={files.cv}
              onChange={(file) => setFiles((prev) => ({ ...prev, cv: file }))}
            />
          </div>
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? 'Creating…' : 'Create candidate'}
        </Button>
      </form>
    </Card>
  );
}
