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
    document.title = "Cinode-Unlimited stream";
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-950/15 via-transparent to-transparent pointer-events-none"></div>

        <div className="w-full max-w-md bg-[#111320] border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-lg mx-auto mb-4">
            <Database className="w-6 h-6" />
          </div>
          
          <h3 className="font-display font-black text-lg text-white tracking-tight mb-2">Database Connection Failed</h3>
          <p className="text-xs text-slate-400 mb-6">Database connection failed.</p>

          <button
            onClick={handleRetryDb}
            disabled={isRetrying}
            className="w-full bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-rose-950/20"
          >
            {isRetrying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" /> Retry Connection
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // 1. Explicit Portal Setup routing
  if (currentHash === '#setup') {
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
      systemStatus={systemStatus}
    />
  );
}
