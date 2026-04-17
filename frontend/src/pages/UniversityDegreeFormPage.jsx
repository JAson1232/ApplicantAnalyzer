import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import LoadingSpinner from '../components/LoadingSpinner';
import { mapDegreeFormToPayload, mapDegreeForView } from '../lib/mappers';

export default function UniversityDegreeFormPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { degreeId } = useParams();
  const editing = Boolean(degreeId);

  const [form, setForm] = useState({
    title: '',
    description: '',
    requirements: '',
    hidden_criteria: '',
    required_files: ['personal_statement', 'transcript', 'cv']
  });
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Autofill state
  const [degreeUrl, setDegreeUrl] = useState('');
  const [autofilling, setAutofilling] = useState(false);
  const [autofillError, setAutofillError] = useState('');
  const [autofillSuccess, setAutofillSuccess] = useState(false);

  useEffect(() => {
    if (!editing) return;
    apiFetch(`/api/university/degrees/${degreeId}`, { token })
      .then((data) => {
        const degree = mapDegreeForView(data.degree);
        setForm({
          title: degree.title,
          description: degree.description,
          requirements: degree.requirements,
          hidden_criteria: degree.hidden_criteria,
          required_files: degree.required_files
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [degreeId, editing, token]);

  const autofill = async () => {
    if (!degreeUrl.trim()) return;
    setAutofilling(true);
    setAutofillError('');
    setAutofillSuccess(false);
    try {
      const data = await apiFetch('/api/university/degrees/autofill', {
        method: 'POST',
        token,
        body: { url: degreeUrl.trim() }
      });
      setForm((prev) => ({
        title: data.title || '',
        description: data.description || '',
        requirements: data.requirements || '',
        hidden_criteria: data.hidden_criteria || '',
        required_files: prev.required_files
      }));
      setAutofillSuccess(true);
    } catch (err) {
      setAutofillError(err.message);
    } finally {
      setAutofilling(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiFetch(editing ? `/api/university/degrees/${degreeId}` : '/api/university/degrees', {
        method: editing ? 'PUT' : 'POST',
        token,
        body: mapDegreeFormToPayload(form)
      });
      navigate('/university/degrees');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner className="mt-8" />;

  return (
    <Card className="mx-auto max-w-3xl">
      <h1 className="text-3xl text-gold-400">{editing ? 'Edit degree' : 'Create degree'}</h1>

      {/* ── AI Autofill ─────────────────────────────────────────────── */}
      <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
        <p className="mb-3 text-sm font-medium text-slate-300">
          <span className="mr-2 text-gold-400">✦</span>
          Auto-fill with AI — paste the university degree page URL and we'll populate the fields for you
        </p>
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="https://www.university.edu/courses/bsc-computer-science"
            value={degreeUrl}
            onChange={(e) => {
              setDegreeUrl(e.target.value);
              setAutofillSuccess(false);
              setAutofillError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && !autofilling && autofill()}
            disabled={autofilling}
          />
          <Button
            type="button"
            onClick={autofill}
            disabled={autofilling || !degreeUrl.trim()}
            className="shrink-0 whitespace-nowrap"
          >
            {autofilling ? 'Analysing…' : 'Auto-fill'}
          </Button>
        </div>
        {autofilling && (
          <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-600 border-t-gold-400" />
            Fetching page and extracting degree information…
          </p>
        )}
        {autofillSuccess && (
          <p className="mt-2 text-xs text-emerald-400">
            Fields populated — review and edit before saving.
          </p>
        )}
        {autofillError && (
          <p className="mt-2 text-xs text-rose-400">{autofillError}</p>
        )}
      </div>

      {/* ── Form Fields ─────────────────────────────────────────────── */}
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <Input
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          required
        />
        <Textarea
          placeholder="Description"
          rows={4}
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          required
        />
        <Textarea
          placeholder="Requirements"
          rows={4}
          value={form.requirements}
          onChange={(e) => setForm((prev) => ({ ...prev, requirements: e.target.value }))}
        />
        <Textarea
          placeholder="Hidden scoring criteria"
          rows={4}
          value={form.hidden_criteria}
          onChange={(e) => setForm((prev) => ({ ...prev, hidden_criteria: e.target.value }))}
          required
        />

        {/* ── Required Documents ────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
          <p className="mb-3 text-sm font-medium text-slate-300">Required documents</p>
          <p className="mb-3 text-xs text-slate-500">
            Choose which files applicants must upload. Unchecked documents will not be collected and will be excluded from AI scoring.
          </p>
          <div className="space-y-2">
            {[
              { key: 'personal_statement', label: 'Personal Statement' },
              { key: 'transcript', label: 'Academic Transcript' },
              { key: 'cv', label: 'CV / Resume' }
            ].map(({ key, label }) => {
              const checked = form.required_files.includes(key);
              return (
                <label key={key} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setForm((prev) => ({
                        ...prev,
                        required_files: checked
                          ? prev.required_files.filter((f) => f !== key)
                          : [...prev.required_files, key]
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-yellow-400"
                  />
                  <span className="text-sm text-slate-200">{label}</span>
                </label>
              );
            })}
          </div>
          {form.required_files.length === 0 && (
            <p className="mt-2 text-xs text-rose-400">At least one document must be required.</p>
          )}
        </div>

        {error && <p className="text-rose-400">{error}</p>}
        <Button disabled={saving || form.required_files.length === 0} type="submit">
          {saving ? 'Saving...' : 'Save degree'}
        </Button>
      </form>
    </Card>
  );
}
