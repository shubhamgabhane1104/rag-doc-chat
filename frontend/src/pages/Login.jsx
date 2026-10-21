import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GoogleSignInButton from '../components/GoogleSignInButton';
import AuthLayout from '../components/AuthLayout';
import { inputClass } from '../styles';


export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const justSignedUp = location.state?.justSignedUp;

  // If login takes long, the free server is probably starting up: say so
  useEffect(() => {
    if (!loading) return undefined;
    const t = setTimeout(() => setSlow(true), 4000);
    return () => { clearTimeout(t); setSlow(false); };
  }, [loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reach the server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-1">Log in</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Pick up where you left off.</p>

      {justSignedUp && (
        <div className="flex items-center gap-2 text-sm text-emerald-800 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-200 px-3 py-2.5 rounded-lg mb-4">
          <CheckCircle2 size={16} />
          Account created. Log in to continue.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@college.edu"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {loading ? 'Logging in…' : 'Log in'}
        </button>

        {slow && (
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
            Waking up the server. On the free plan the first login after a break can take up to a minute.
          </p>
        )}

        <GoogleSignInButton onError={setError} />
      </form>

      <p className="text-sm text-slate-500 dark:text-slate-400 mt-6">
        New here?{' '}
        <Link to="/signup" className="text-indigo-700 dark:text-indigo-300 font-semibold hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
