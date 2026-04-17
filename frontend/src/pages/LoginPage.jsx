import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';

function homeForRole(role) {
  return role === 'university' ? '/university/dashboard' : '/applicant/dashboard';
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(location.state?.from || homeForRole(user.role), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mx-auto mt-10 max-w-md">
      <h1 className="text-3xl text-gold-400">Login</h1>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <Button disabled={loading} type="submit" className="w-full">
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-4 text-sm text-slate-400">
        Need an account?{' '}
        <Link className="text-gold-400" to="/register">
          Register
        </Link>
      </p>
    </Card>
  );
}
