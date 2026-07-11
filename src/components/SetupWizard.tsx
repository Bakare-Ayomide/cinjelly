import React, { useState, useEffect } from 'react';
import { User, Key, Eye, EyeOff, Loader2, ShieldCheck, Tv, AlertCircle, Sparkles, ArrowLeft } from 'lucide-react';

interface SetupWizardProps {
  onSetupSuccess: () => void;
}

export default function SetupWizard({ onSetupSuccess }: SetupWizardProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingEnv, setCheckingEnv] = useState(true);
  const [isEnvConfigured, setIsEnvConfigured] = useState(false);
  const [showAdminPass, setShowAdminPass] = useState(false);

  // Portal Admin User State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Check backend environment status on load
  const verifyEnvStatus = async () => {
    try {
      setCheckingEnv(true);
      const response = await fetch('/api/status');
      const data = await response.json();
      setIsEnvConfigured(!!data.configured);
      if (!data.configured) {
        setError('Jellyfin Server is not configured. Please define JELLYFIN_SERVER_URL, JELLYFIN_ADMIN_USERNAME, JELLYFIN_ADMIN_PASSWORD, and JELLYFIN_API_KEY in your hosting environment variables first.');
      }
    } catch (err) {
      setError('Could not connect to the backend server. Please verify the dev server is running.');
    } finally {
      setCheckingEnv(false);
    }
  };

  useEffect(() => {
    verifyEnvStatus();
  }, []);

  // Submit entire setup to backend
  const handleSubmitSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName || !username || !email || !password) {
      setError('Please complete all fields to create your Portal Administrator account.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          username,
          email,
          password
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Administrator account creation failed');
      }

      onSetupSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize portal system. Please check your environment variables.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingEnv) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090a0f] text-white">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-rose-500 mx-auto" />
          <p className="text-sm font-medium text-slate-300">Securing environment & validating keys...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090a0f] px-4 py-12 selection:bg-rose-600 selection:text-white" id="setup-wizard-container">
      <div className="w-full max-w-lg bg-[#11131e] border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl p-8 sm:p-10 relative">
        
        {/* Soft elegant red/rose glow line */}
        <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-rose-500 to-amber-500"></div>

        {/* Back to Landing Button */}
        <div className="mb-6 flex justify-start">
          <button 
            type="button"
            onClick={() => { window.location.hash = ''; }}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-bold transition bg-slate-900 border border-slate-800/80 px-3.5 py-2 rounded-xl cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-rose-500" />
            <span>Back to Landing</span>
          </button>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-full mb-4 text-rose-500">
            <Tv className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight text-white sm:text-4xl">
            Stream Portal Setup
          </h1>
          <p className="mt-2 text-slate-400 text-sm">
            Create your master administrator account to manage streaming access.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs rounded-xl flex gap-3 items-start leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {!isEnvConfigured ? (
          <div className="space-y-6 text-center">
            <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-xs space-y-3 leading-relaxed">
              <p className="font-semibold text-sm">Awaiting Backend Environment variables</p>
              <p>
                To keep all your Jellyfin secrets fully secure, credentials are loaded directly from the system environment instead of the web browser.
              </p>
              <p className="font-mono text-[10px] bg-[#07080c] p-2.5 rounded-lg text-slate-400 text-left">
                Please configure these in your settings or .env file:<br />
                • JELLYFIN_SERVER_URL<br />
                • JELLYFIN_ADMIN_USERNAME<br />
                • JELLYFIN_ADMIN_PASSWORD<br />
                • JELLYFIN_API_KEY
              </p>
            </div>
            <button
              onClick={verifyEnvStatus}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-sm transition cursor-pointer flex items-center justify-center gap-2 mx-auto"
            >
              Check Environment Connection Again
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitSetup} className="space-y-5" id="portal-admin-form">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-200 text-xs flex gap-2.5 items-start leading-relaxed">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>
                <strong>Jellyfin server connection verified successfully in the background!</strong> Ready to register your streaming portal administrator login.
              </span>
            </div>

            <div className="space-y-1">
              <label htmlFor="fullName" className="block text-xs font-semibold text-slate-300">
                Full Name
              </label>
              <input
                type="text"
                id="fullName"
                required
                placeholder="e.g. John Doe"
                className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-3 px-4 text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-sm transition"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="username" className="block text-xs font-semibold text-slate-300">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  required
                  placeholder="e.g. admin"
                  className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-3 px-4 text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-sm transition"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="email" className="block text-xs font-semibold text-slate-300">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  placeholder="admin@yourportal.com"
                  className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-3 px-4 text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-sm transition"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="block text-xs font-semibold text-slate-300">
                Password
              </label>
              <div className="relative">
                <input
                  type={showAdminPass ? 'text' : 'password'}
                  id="password"
                  required
                  placeholder="Create a strong security password"
                  className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-3 px-4 text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-sm transition"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white"
                  onClick={() => setShowAdminPass(!showAdminPass)}
                >
                  {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50 text-sm shadow-lg shadow-rose-950/20"
              id="portal-admin-submit"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving System Settings...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Finalize & Launch Portal
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
