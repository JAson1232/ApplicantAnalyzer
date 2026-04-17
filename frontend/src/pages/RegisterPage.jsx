import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';

function homeForRole(role) {
  return role === 'university' ? '/university/dashboard' : '/applicant/dashboard';
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', role: 'applicant', university_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await register(form);
      navigate(homeForRole(user.role), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mx-auto mt-10 max-w-md">
      <h1 className="text-3xl text-gold-400">Register</h1>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <Input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          required
        />
        <Input
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          required
        />
        <select
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          value={form.role}
          onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
        >
          <option value="applicant">Applicant</option>
          <option value="university">University</option>
        </select>
        {form.role === 'university' && (
          <Input
            placeholder="University Name"
            value={form.university_name}
            onChange={(e) => setForm((prev) => ({ ...prev, university_name: e.target.value }))}
            required
          />
        )}
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <Button disabled={loading} type="submit" className="w-full">
          {loading ? 'Creating account...' : 'Create account'}
        </Button>
      </form>
    </Card>
  );
}
