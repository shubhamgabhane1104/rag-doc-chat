import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleSignInButton from '../components/GoogleSignInButton';
import AuthLayout from '../components/AuthLayout';
import { inputClass } from '../styles';

export default function Signup() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signup(firstName, lastName, email, password);
      navigate('/login', { state: { justSignedUp: true } });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reach the server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-1">Create an account</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Upload a PDF, slides or notes and start asking.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="first" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">First name</label>
            <input id="first" type="text" autoComplete="given-name" required value={firstName}
              onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="last" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Last name</label>
            <input id="last" type="text" autoComplete="family-name" required value={lastName}
              onChange={(e) => setLastName(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
          <input id="email" type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@college.edu" />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
          <input id="password" type="password" autoComplete="new-password" required minLength={6} value={password}
            onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="At least 6 characters" />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>

        <GoogleSignInButton onError={setError} />
      </form>

      <p className="text-sm text-slate-500 dark:text-slate-400 mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-indigo-700 dark:text-indigo-300 font-semibold hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
