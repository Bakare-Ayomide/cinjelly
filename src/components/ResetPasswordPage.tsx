import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ArrowLeft, ShieldCheck, KeyRound } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface ResetPasswordPageProps {
  onBackToLogin: () => void;
}

export default function ResetPasswordPage({ onBackToLogin }: ResetPasswordPageProps) {
  const [token, setToken] = useState<string>('');
  const [verifyingToken, setVerifyingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<{ username?: string; email?: string }>({});

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Extract token from URL search query, hash, or pathname
  useEffect(() => {
    let extractedToken = '';

    // Check standard search params: ?token=...
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('token')) {
      extractedToken = urlParams.get('token')!;
    } else if (window.location.hash.includes('token=')) {
      // Check hash params: #reset-password?token=...
      const hashQuery = window.location.hash.split('?')[1];
      if (hashQuery) {
        const hashParams = new URLSearchParams(hashQuery);
        if (hashParams.get('token')) {
          extractedToken = hashParams.get('token')!;
        }
      }
    }

    setToken(extractedToken);

    if (!extractedToken) {
      setVerifyingToken(false);
      setTokenValid(false);
      setTokenError('No password reset token was provided in the link. Please request a new password reset link.');
      return;
    }

    // Verify token with backend
    const verifyToken = async () => {
      try {
        setVerifyingToken(true);
        setTokenError(null);
        const res = await apiFetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(extractedToken)}`);
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.valid) {
          setTokenValid(true);
          setUserInfo({
            username: data.username,
            email: data.email
          });
        } else {
          setTokenValid(false);
          setTokenError(data.error || 'This password reset link is invalid, expired, or has already been used.');
        }
      } catch (err: any) {
        setTokenValid(false);
        setTokenError(err.message || 'Unable to verify reset token. Please check your internet connection.');
      } finally {
        setVerifyingToken(false);
      }
    };

    verifyToken();
  }, []);

  const handleReturnToLogin = () => {
    try {
      if (window.history.pushState) {
        window.history.pushState({}, '', '/#login');
      }
    } catch (e) {}
    if (onBackToLogin) {
      onBackToLogin();
    } else {
      window.location.hash = '#login';
      window.location.href = '/#login';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!newPassword) {
      setErrorMsg('Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please ensure both fields match.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password. Please try again.');
      }

      setResetSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while resetting your password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0304] text-white flex flex-col justify-center items-center p-4 sm:p-6 selection:bg-[#d31d38] selection:text-white relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#d31d38]/20 via-[#d31d38]/5 to-transparent pointer-events-none blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#d31d38]/10 pointer-events-none blur-3xl rounded-full"></div>

      <div className="w-full max-w-md bg-[#120507]/95 backdrop-blur-xl border border-[#2e1015] rounded-2xl shadow-2xl p-6 sm:p-8 relative z-10">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d31d38]/10 border border-[#d31d38]/25 text-[#ff4d64] text-xs font-black uppercase tracking-widest mb-3 shadow-inner">
            <KeyRound className="w-3.5 h-3.5 text-[#ff4d64]" /> Cinode Security
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Reset Password
          </h1>
          <p className="text-xs text-zinc-400 mt-1.5">
            Choose a strong new password for your streaming account
          </p>
        </div>

        {/* Loading state while verifying token */}
        {verifyingToken && (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#d31d38] mb-3" />
            <p className="text-sm font-semibold text-zinc-300">Verifying reset authorization...</p>
            <p className="text-xs text-zinc-500 mt-1">Please hold on while we secure your link</p>
          </div>
        )}

        {/* Invalid or Expired Token View */}
        {!verifyingToken && !tokenValid && (
          <div className="py-4">
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-xs flex items-start gap-3 mb-6">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-red-200">Link Invalid or Expired</p>
                <p className="text-red-300/90 leading-relaxed">{tokenError}</p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                id="btn-return-login-invalid"
                onClick={handleReturnToLogin}
                className="w-full bg-[#d31d38] hover:bg-[#b0162c] text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#d31d38]/25"
              >
                <ArrowLeft className="w-4 h-4" /> Return to Login & Request Link
              </button>
            </div>
          </div>
        )}

        {/* Success Screen After Reset */}
        {!verifyingToken && tokenValid && resetSuccess && (
          <div className="py-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-white mb-2">Password Reset Complete!</h2>
            <p className="text-xs text-zinc-300 leading-relaxed mb-6">
              Your account password has been updated securely. All previous active sessions have been signed out. You can now sign in with your new password.
            </p>

            <button
              type="button"
              id="btn-sign-in-after-reset"
              onClick={handleReturnToLogin}
              className="w-full bg-[#d31d38] hover:bg-[#b0162c] text-white font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#d31d38]/25"
            >
              Sign In to Your Account
            </button>
          </div>
        )}

        {/* Reset Form Screen */}
        {!verifyingToken && tokenValid && !resetSuccess && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {userInfo.username && (
              <div className="p-3 rounded-xl bg-[#1a080c] border border-[#38141b] text-xs flex items-center justify-between text-zinc-300 mb-2">
                <span className="text-zinc-500">Account:</span>
                <span className="font-semibold text-white">
                  {userInfo.username} {userInfo.email ? `(${userInfo.email})` : ''}
                </span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/50 text-red-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* New Password Input with Eye Icon */}
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 uppercase tracking-wider">
                New Password
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-zinc-500 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="reset-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min. 6 characters)"
                  autoComplete="new-password"
                  required
                  className="w-full bg-[#170609] border border-[#38141b] focus:border-[#d31d38] rounded-xl pl-10 pr-11 py-3 text-xs text-white placeholder-zinc-500 outline-none transition"
                />
                <button
                  type="button"
                  id="toggle-reset-new-password"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 p-1.5 text-zinc-400 hover:text-zinc-200 active:text-white transition cursor-pointer rounded-lg hover:bg-white/5"
                  title={showNewPassword ? 'Hide password' : 'Show password'}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4 text-[#ff4d64]" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm New Password Input with Eye Icon */}
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 uppercase tracking-wider">
                Confirm New Password
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-zinc-500 pointer-events-none">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <input
                  id="reset-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  required
                  className="w-full bg-[#170609] border border-[#38141b] focus:border-[#d31d38] rounded-xl pl-10 pr-11 py-3 text-xs text-white placeholder-zinc-500 outline-none transition"
                />
                <button
                  type="button"
                  id="toggle-reset-confirm-password"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 p-1.5 text-zinc-400 hover:text-zinc-200 active:text-white transition cursor-pointer rounded-lg hover:bg-white/5"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4 text-[#ff4d64]" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              id="btn-submit-reset-password"
              disabled={submitting}
              className="w-full mt-2 bg-[#d31d38] hover:bg-[#b0162c] disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#d31d38]/25"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Updating Password...
                </>
              ) : (
                'Set New Password'
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                id="btn-back-to-login-bottom"
                onClick={handleReturnToLogin}
                className="text-xs text-zinc-400 hover:text-white transition inline-flex items-center gap-1.5 cursor-pointer font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
