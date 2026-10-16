import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, X, User, Check, Sparkles, AlertCircle } from 'lucide-react';

export default function GoogleSignInButton({
  text = 'Continue with Google',
  className = '',
  onError,
}) {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalEmail, setModalEmail] = useState('');
  const [modalName, setModalName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const googleBtnContainerRef = useRef(null);

  // Check for official Google Identity Services
  useEffect(() => {
    if (!clientId || typeof window === 'undefined') return;

    const scriptId = 'google-gsi-client';
    let script = document.getElementById(scriptId);

    const initGoogleGsi = () => {
      if (window.google?.accounts?.id && googleBtnContainerRef.current) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            if (response.credential) {
              setLoading(true);
              try {
                await loginWithGoogle({ credential: response.credential });
                navigate('/dashboard');
              } catch (err) {
                console.error('Google Sign-in Error:', err);
                const msg = err.response?.data?.error || 'Failed to authenticate with Google';
                setErrorMsg(msg);
                if (onError) onError(msg);
              } finally {
                setLoading(false);
              }
            }
          },
        });

        // Render official Google button into container
        window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'continue_with',
          shape: 'rectangular',
        });
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGoogleGsi;
      document.body.appendChild(script);
    } else {
      initGoogleGsi();
    }
  }, [clientId]);

  const handleButtonClick = () => {
    setErrorMsg('');
    // If official Google Client ID is configured and script initialized, let user click the official GSI button
    if (clientId && window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
      return;
    }

    // Otherwise, open the interactive Google Account Chooser
    setShowModal(true);
  };

  const handleSimulatedGoogleLogin = async (selectedEmail, selectedName) => {
    const emailToUse = selectedEmail || modalEmail;
    const nameToUse = selectedName || modalName;

    if (!emailToUse || !emailToUse.includes('@')) {
      setErrorMsg('Please provide a valid Google email address.');
      return;
    }

    const parts = (nameToUse || 'Google User').trim().split(' ');
    const firstName = parts[0] || 'Google';
    const lastName = parts.slice(1).join(' ') || 'User';

    setLoading(true);
    setErrorMsg('');

    try {
      await loginWithGoogle({
        email: emailToUse.trim(),
        firstName,
        lastName,
        googleId: `gid_${Date.now()}`,
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(firstName + ' ' + lastName)}`,
      });
      setShowModal(false);
      navigate('/dashboard');
    } catch (err) {
      console.error('Google authentication error:', err);
      const msg = err.response?.data?.error || 'Failed to sign in with Google.';
      setErrorMsg(msg);
      if (onError) onError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* If official Google Client ID is configured, render official container */}
      {clientId ? (
        <div ref={googleBtnContainerRef} className="w-full flex justify-center my-1" />
      ) : (
        /* Native styled Google Button with fallback chooser */
        <button
          type="button"
          onClick={handleButtonClick}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 py-2.5 px-4 rounded-xl font-medium text-sm transition shadow-xs hover:shadow-sm disabled:opacity-60 cursor-pointer ${className}`}
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin text-indigo-600" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          <span>{loading ? 'Authenticating with Google...' : text}</span>
        </button>
      )}

      {/* Interactive Google Account Chooser Modal (when no cloud client id is configured) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-5">
            {/* Close Button */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
            >
              <X size={18} />
            </button>

            {/* Header with Google Logo */}
            <div className="text-center space-y-1">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-xs mb-2">
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Choose an account
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                to continue to <strong className="text-indigo-600 dark:text-indigo-400">DocChat</strong>
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Quick One-Click Google Account Presets */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block px-1">
                Select Active Account:
              </span>

              {/* Account Preset 1: Student / Project Owner */}
              <button
                type="button"
                onClick={() => handleSimulatedGoogleLogin('shubhamgabhane1104@gmail.com', 'Shubham Gabhane')}
                disabled={loading}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-fuchsia-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    SG
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      Shubham Gabhane
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      shubhamgabhane1104@gmail.com
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition">
                  Select →
                </span>
              </button>

              {/* Account Preset 2: Student / Research Scholar */}
              <button
                type="button"
                onClick={() => handleSimulatedGoogleLogin('student.mca@college.edu', 'MCA Research Student')}
                disabled={loading}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    MS
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      MCA Research Student
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      student.mca@college.edu
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition">
                  Select →
                </span>
              </button>
            </div>

            {/* Custom Google Account Entry Option */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-2 px-1">
                Or Use Another Google Account:
              </span>

              <div className="space-y-2.5">
                <input
                  type="text"
                  placeholder="Full Name (e.g. Rahul Sharma)"
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="email"
                  placeholder="Gmail address (e.g. rahul@gmail.com)"
                  value={modalEmail}
                  onChange={(e) => setModalEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                <button
                  type="button"
                  onClick={() => handleSimulatedGoogleLogin()}
                  disabled={loading || !modalEmail}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  <span>Continue with Custom Account</span>
                </button>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 text-center pt-1">
              To verify and connect with official Google Cloud Client ID, configure <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">VITE_GOOGLE_CLIENT_ID</code> in frontend.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
