import React, { useState, useEffect } from 'react';
import { Loader2, Tv, Database, RefreshCw, ArrowLeft } from 'lucide-react';
import { User, SystemStatus } from './types';
import SetupWizard from './components/SetupWizard';
import LandingPage from './components/LandingPage';
import UserPortal from './components/UserPortal';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [jellyfinToken, setJellyfinToken] = useState<string>('');
  const [appLoading, setAppLoading] = useState(true);
  const [currentHash, setCurrentHash] = useState(window.location.hash);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Check setup and user session on boot
  const initApp = async () => {
    try {
      setDbError(null);
      // 1. Check system setup status
      const statusRes = await fetch('/api/status');
      if (!statusRes.ok) {
        const errorData = await statusRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'MySQL database is currently offline or access is denied.');
      }
      const statusData = await statusRes.json();
      setSystemStatus(statusData);

      // 2. If configured, attempt to load active user session
      if (statusData.configured && statusData.hasAdmin) {
        const userRes = await fetch('/api/auth/me');
        if (userRes.ok) {
          const userData = await userRes.json();
          setCurrentUser(userData.user);
          setJellyfinToken(userData.jellyfinToken || '');
        } else {
          setCurrentUser(null);
          setJellyfinToken('');
        }
      }
    } catch (err: any) {
      console.error('Initialization error:', err);
      setDbError(err.message || 'MySQL connection error or access denied.');
    } finally {
      setAppLoading(false);
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    initApp();

    // Set up lightweight hash-routing listener
    const handleHashChange = () => {
      setCurrentHash(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Handle successful login
  const handleLoginSuccess = (user: User, token: string) => {
    setCurrentUser(user);
    setJellyfinToken(token);
    // Redirect to home portal
    window.location.hash = '#portal';
  };

  // Handle successful registration
  const handleRegisterSuccess = (user: User) => {
    setCurrentUser(user);
    setJellyfinToken(''); // Initial signup has no token in session until they verify password or renew
    window.location.hash = '#portal';
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    setCurrentUser(null);
    setJellyfinToken('');
    window.location.hash = '';
  };

  // Reload user profile (e.g. after payment renewal)
  const reloadUserProfile = async () => {
    try {
      const userRes = await fetch('/api/auth/me');
      if (userRes.ok) {
        const userData = await userRes.json();
        setCurrentUser(userData.user);
        setJellyfinToken(userData.jellyfinToken || '');
      }
    } catch (err) {
      console.error('Failed to reload profile:', err);
    }
  };

  const handleRetryDb = () => {
    setIsRetrying(true);
    initApp();
  };

  if (appLoading) {
    return (
      <div className="min-h-screen bg-[#07080b] flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-red-600 mb-4" />
        <p className="text-sm font-semibold text-gray-400">Loading Portal Services...</p>
      </div>
    );
  }

  // Strict Database Connection Screen
  if (dbError) {
    return (
      <div className="min-h-screen bg-[#090a0f] text-white selection:bg-rose-600 selection:text-white flex items-center justify-center p-6 relative overflow-hidden">
        {/* Cinematic Ambient Radial Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-950/15 via-transparent to-transparent pointer-events-none"></div>

        <div className="w-full max-w-xl bg-[#111320] border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10">
          <div className="flex items-center gap-3 border-b border-slate-800/80 pb-5 mb-6">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-lg">
              <Database className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="font-display font-black text-xl text-white tracking-tight">Database Connection Failed</h3>
              <p className="text-xs text-slate-400">Strict MySQL Mode Active • No Fallback</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="p-4.5 bg-red-500/5 border border-red-500/10 rounded-xl space-y-2">
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest block">Active MySQL Server Error</span>
              <code className="text-xs text-rose-200 font-mono block break-all leading-relaxed bg-black/40 p-3.5 rounded-lg border border-slate-900/60 select-all">
                {dbError}
              </code>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed space-y-3">
              <p>
                The streaming portal has disabled local file fallback storage. All user registrations, subscription tracking, and server settings must be stored in your high-performance <strong className="text-white">MySQL Database</strong>.
              </p>
              <p>
                To allow the portal to start, please check and apply the following steps in your hosting environment:
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex gap-3 text-xs leading-relaxed">
                <div className="w-5 h-5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center font-black shrink-0 text-[10px]">1</div>
                <div>
                  <strong className="text-slate-200 block">Whitelist the Portal's Server IP Address</strong>
                  <p className="text-slate-400 mt-0.5">
                    Your database host (<span className="font-mono text-slate-300">131.153.147.178</span>) is rejecting our server's request. Add <span className="font-mono text-rose-300 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">34.96.41.176</span> to your Whitelist in your cPanel / Remote MySQL dashboard, or use a wildcard (<span className="font-mono text-rose-300">%</span>) for unrestricted external connection.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 text-xs leading-relaxed">
                <div className="w-5 h-5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center font-black shrink-0 text-[10px]">2</div>
                <div>
                  <strong className="text-slate-200 block">Verify User Privileges via phpMyAdmin</strong>
                  <p className="text-slate-400 mt-0.5">
                    Verify that the MySQL database user <span className="font-mono text-rose-300">zerolord_cinjelly</span> exists and has full read/write privileges granted on database <span className="font-mono text-rose-300">zerolord_cinjelly</span>. Run this SQL query in your PHPMyAdmin console to authorize remote access:
                  </p>
                  <pre className="mt-2.5 bg-black/50 p-3 rounded-lg border border-slate-900/80 text-[10px] font-mono text-slate-400 select-all break-all leading-normal whitespace-pre-wrap">
                    {`GRANT ALL PRIVILEGES ON zerolord_cinjelly.* TO 'zerolord_cinjelly'@'%' IDENTIFIED BY '@f33rinimi';\nFLUSH PRIVILEGES;`}
                  </pre>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/60 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleRetryDb}
                disabled={isRetrying}
                className="flex-1 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-rose-950/20"
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying Connection...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" /> Retry Connection
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 1. Explicit Portal Setup routing
  const isConfigured = systemStatus && systemStatus.configured && systemStatus.hasAdmin;
  if (!isConfigured && currentHash === '#setup') {
    return (
      <SetupWizard 
        onSetupSuccess={() => {
          window.location.hash = '';
          setAppLoading(true);
          initApp();
        }} 
      />
    );
  }

  // 2. Landing page for unauthenticated users (always public) OR if hash is empty or explicitly requesting #landing
  if (!currentUser || currentHash === '' || currentHash === '#landing') {
    return (
      <LandingPage 
        currentUser={currentUser}
        systemStatus={systemStatus}
        onLoginSuccess={handleLoginSuccess}
        onRegisterSuccess={handleRegisterSuccess}
      />
    );
  }

  // 3. Admin Dashboard View (hash matches and role is admin)
  if (currentHash === '#admin' && currentUser.role === 'admin') {
    return (
      <AdminDashboard 
        currentUser={currentUser}
        onBackToPortal={() => { window.location.hash = '#portal'; }}
      />
    );
  }

  // 4. Standard User / Admin home Portal view
  return (
    <UserPortal 
      user={currentUser}
      jellyfinToken={jellyfinToken}
      setJellyfinToken={setJellyfinToken}
      onLogout={handleLogout}
      onReloadUser={reloadUserProfile}
    />
  );
}
