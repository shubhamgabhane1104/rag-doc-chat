import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Official Google Identity Services button.
 * Renders nothing unless VITE_GOOGLE_CLIENT_ID is set — the backend only
 * accepts verified Google ID tokens, so there is no "offline" fallback.
 */
export default function GoogleSignInButton({ onError }) {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Keep the latest callbacks without re-initialising Google on every render.
  const handlersRef = useRef({ loginWithGoogle, navigate, onError });
  useEffect(() => {
    handlersRef.current = { loginWithGoogle, navigate, onError };
  });

  useEffect(() => {
    if (!clientId) return;

    const init = () => {
      if (!window.google?.accounts?.id || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          if (!credential) return;
          const { loginWithGoogle: doLogin, navigate: go, onError: fail } = handlersRef.current;
          setBusy(true);
          try {
            await doLogin({ credential });
            go('/dashboard');
          } catch (err) {
            fail?.(err.response?.data?.error || 'Google sign-in failed. Please try again.');
          } finally {
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: containerRef.current.offsetWidth || 320,
      });
    };

    const existing = document.getElementById('google-gsi-client');
    if (existing) {
      if (window.google?.accounts?.id) init();
      else existing.addEventListener('load', init, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = init;
    document.body.appendChild(script);
  }, [clientId]);

  if (!clientId) return null;

  return (
    <>
      <div className="flex items-center gap-3 py-1 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        or
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      </div>
      <div ref={containerRef} className={`w-full min-h-[44px] ${busy ? 'pointer-events-none opacity-60' : ''}`} />
    </>
  );
}
