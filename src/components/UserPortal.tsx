import React, { useState } from 'react';
import { 
  Tv, LogOut, CheckCircle, AlertTriangle, Play, ShieldAlert, CreditCard, 
  Loader2, RefreshCw, Key, HelpCircle, ArrowLeft, ExternalLink, X, Info, UserCheck, Calendar
} from 'lucide-react';
import { User } from '../types';

interface UserPortalProps {
  user: User;
  jellyfinToken: string;
  onLogout: () => void;
  onReloadUser: () => void;
  setJellyfinToken: (token: string) => void;
}

export default function UserPortal({ user, jellyfinToken, onLogout, onReloadUser, setJellyfinToken }: UserPortalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Credentials sync state
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncPassword, setSyncPassword] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);

  const isActive = user.role === 'admin' || user.subscriptionStatus === 'Active';

  // Handle simulated payment
  const handlePayment = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await fetch('/api/payment/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Payment failed');
      }

      setSuccess('Subscription activated successfully! Your unlimited streaming server access is now unlocked.');
      setTimeout(() => {
        onReloadUser();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Synchronize Jellyfin session using password
  const handleSessionSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSyncLoading(true);

    try {
      const response = await fetch('/api/auth/jellyfin-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: syncPassword })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      setJellyfinToken(data.jellyfinToken);
      setShowSyncModal(false);
      setSyncPassword('');
      
      // Launch streaming
      launchStreaming(data.jellyfinToken);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncLoading(false);
    }
  };

  // Launch Jellyfin by writing to localStorage and redirecting
  const launchStreaming = (tokenToUse: string) => {
    const activeToken = tokenToUse || jellyfinToken;
    if (!activeToken) {
      // Prompt user to enter password to fetch token from backend
      setShowSyncModal(true);
      return;
    }

    try {
      const serverUrl = window.location.origin + '/jellyfin';
      const serverId = 'jellyfin_server';
      const serverName = 'Stream Portal Server';

      const servers = [
        {
          Id: serverId,
          Name: serverName,
          Url: serverUrl,
          ManualAddress: serverUrl,
          UserId: user.jellyfinUserId,
          AccessToken: activeToken
        }
      ];

      // Inject standard Jellyfin web client keys
      window.localStorage.setItem('servers', JSON.stringify(servers));
      window.localStorage.setItem('activeServerId', serverId);
      window.localStorage.setItem('api_key', activeToken);
      window.localStorage.setItem('userId', user.jellyfinUserId || '');
      window.localStorage.setItem('serverId', serverId);
      window.localStorage.setItem('serverAddress', serverUrl);
      window.localStorage.setItem('serverName', serverName);

      window.localStorage.setItem('jellyfin_credentials', JSON.stringify({
        servers,
        activeServerId: serverId
      }));

      // Redirect directly to Jellyfin interface served on the same origin (proxied)
      window.location.href = '/jellyfin/web/index.html';
    } catch (err: any) {
      console.error('Failed to set localStorage credentials:', err);
      setError('An error occurred setting up automatic login on this browser. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] py-8 px-4 sm:px-6 lg:px-8 selection:bg-rose-600 selection:text-white" id="user-portal-root">
      
      {/* Navigation Topbar */}
      <nav className="max-w-5xl mx-auto flex items-center justify-between mb-12 border-b border-slate-800/60 pb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => { window.location.hash = '#landing'; }}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition text-xs font-bold mr-2 cursor-pointer bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl shadow"
            title="Return to Landing Page"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
            <span className="hidden sm:inline">Landing Page</span>
          </button>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gradient-to-tr from-rose-600 to-amber-500 rounded-full mr-3 shrink-0 flex items-center justify-center text-white">
              <Tv className="w-4.5 h-4.5" />
            </div>
            <span className="font-display font-extrabold text-xl sm:text-2xl tracking-tight text-white">
              Flux<span className="text-rose-500">Portal</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          {user.role === 'admin' && (
            <button 
              onClick={() => { window.location.href = '#admin'; }}
              className="border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white font-bold py-1.5 px-4 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
            >
              Admin controls
            </button>
          )}
          <div className="text-right hidden sm:block">
            <span className="block text-xs font-bold text-slate-300">{user.fullName}</span>
            <span className="block text-[10px] text-slate-500 font-medium">@{user.username}</span>
          </div>
          <button 
            onClick={onLogout}
            className="text-slate-400 hover:text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-500" /> Sign Out
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto">
        {/* Welcome Header */}
        <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 sm:p-8 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-rose-500 to-amber-500"></div>
          
          <div>
            <span className="text-xs text-rose-400 font-semibold uppercase tracking-wider">Member Dashboard</span>
            <h1 className="text-3xl font-display font-extrabold text-white tracking-tight mt-1">Hello, {user.fullName}!</h1>
            <p className="text-slate-400 text-sm mt-1">Ready to explore? Instantly access your personal film stream.</p>
          </div>

          <div className="flex items-center gap-2.5">
            {isActive ? (
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 py-2 px-5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" /> Account Active
              </span>
            ) : (
              <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 py-2 px-5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 animate-pulse">
                <AlertTriangle className="w-4 h-4 text-rose-400" /> Plan Expired
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs rounded-xl">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs rounded-xl">
            {success}
          </div>
        )}

        {/* Dynamic Card Area */}
        {!isActive ? (
          /* Billing & Payment Panel */
          <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-8 text-center max-w-xl mx-auto shadow-2xl relative">
            <div className="absolute top-0 right-0 bg-rose-600 text-white font-extrabold text-[10px] uppercase tracking-wider py-1.5 px-4 rounded-bl-xl">
              Access Suspended
            </div>
            
            <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            
            <h3 className="text-xl font-display font-extrabold text-white">Streaming Access Paused</h3>
            <p className="text-slate-400 text-sm mt-2 leading-relaxed">
              Your ₦500 monthly plan is expired. Please renew your access to instantly resume watching your movies and series.
            </p>

            <div className="bg-[#07080c] border border-slate-800/60 rounded-xl p-5 my-6 text-left text-xs space-y-3 max-w-sm mx-auto text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Monthly Plan Subscription:</span>
                <span className="text-white font-bold">₦500.00 NGN</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Duration:</span>
                <span className="text-white font-bold">30 Days Unlimited Access</span>
              </div>
              <div className="flex justify-between border-t border-slate-800/80 pt-3">
                <span className="text-slate-400">Media Platform:</span>
                <span className="text-rose-400 font-bold">Private Secured Jellyfin</span>
              </div>
            </div>

            <button
              onClick={handlePayment}
              disabled={loading}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 text-sm shadow-lg shadow-rose-950/20"
              id="payment-simulate-button"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Completing Secure Payment...
                </>
              ) : (
                <>
                  <CreditCard className="w-4.5 h-4.5" /> Pay ₦500 & Start Streaming
                </>
              )}
            </button>
            
            <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
              Instant activation and automatic connection are provided securely. Cancel any time.
            </p>
          </div>
        ) : (
          /* Active Streaming Player Controls */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Player Launch Card */}
            <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-8 md:col-span-2 flex flex-col justify-between shadow-xl relative">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-rose-500/20 via-transparent to-transparent"></div>
              
              <div>
                <div className="w-11 h-11 flex items-center justify-center bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl mb-5">
                  <Play className="w-5 h-5 fill-current" />
                </div>
                <h3 className="text-2xl font-display font-extrabold text-white">Stream Player Terminal</h3>
                <p className="text-slate-400 text-sm mt-3 leading-relaxed">
                  Your private connection is healthy and ready. Launch the player to open our elegant film interface with automatic secure single sign-on!
                </p>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => launchStreaming('')}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 px-8 rounded-xl flex items-center justify-center gap-2 transition shadow-xl shadow-rose-950/40 cursor-pointer text-sm"
                  id="launch-jellyfin-button"
                >
                  Open Stream Player <ExternalLink className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => { setShowSyncModal(true); }}
                  className="bg-[#07080c] hover:bg-[#121422] border border-slate-800 text-slate-300 font-bold py-4 px-6 rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 text-rose-500" /> Re-Sync Session
                </button>
              </div>
            </div>

            {/* Side Membership Details Card */}
            <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-8 flex flex-col justify-between shadow-xl">
              <div>
                <div className="flex items-center gap-2 text-rose-400 border-b border-slate-800/60 pb-3 mb-5">
                  <UserCheck className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Account Details</h4>
                </div>
                
                <div className="space-y-4 text-xs">
                  <div>
                    <span className="block text-slate-500 font-medium mb-0.5">USERNAME</span>
                    <span className="text-white font-bold">@{user.username}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 font-medium mb-0.5">EMAIL</span>
                    <span className="text-white font-medium truncate block">{user.email}</span>
                  </div>
                  {user.subscriptionExpiryDate && (
                    <div>
                      <span className="block text-slate-500 font-medium mb-0.5">RENEWAL DATE</span>
                      <span className="text-rose-400 font-bold flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 inline" /> {new Date(user.subscriptionExpiryDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="block text-slate-500 font-medium mb-0.5">ACCOUNT ID</span>
                    <span className="text-slate-400 block truncate font-mono text-[11px] bg-[#07080c] p-2 rounded-lg mt-1 border border-slate-800/40">{user.jellyfinUserId || 'Direct Connection'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                <span>Secure Server Connection</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">Online</span>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* RE-SYNC SESSION CREDENTIALS MODAL */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#11131e] border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <button 
              onClick={() => { setShowSyncModal(false); setError(null); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center p-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-full mb-3">
                <Key className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-display font-extrabold text-white">Synchronize Session</h3>
              <p className="text-slate-400 text-xs mt-1">
                Enter your account password to refresh your server login token.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleSessionSync} className="space-y-4" id="session-sync-form">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">Account Password</label>
                <input 
                  type="password" 
                  required
                  placeholder="••••••••" 
                  className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:border-rose-500 transition"
                  value={syncPassword}
                  onChange={(e) => setSyncPassword(e.target.value)}
                />
              </div>

              <button 
                type="submit"
                disabled={syncLoading}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition text-sm disabled:opacity-50"
                id="session-sync-submit"
              >
                {syncLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm & Sync'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
