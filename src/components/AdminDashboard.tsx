import React, { useState, useEffect } from 'react';
import { 
  Users, CheckCircle, AlertTriangle, ShieldCheck, Search, RefreshCw, 
  ArrowLeft, Eye, EyeOff, Loader2, Play, Ban, PlusCircle, Activity, Sparkles, Mail, UserCheck, Tv
} from 'lucide-react';
import { User } from '../types';

interface AdminDashboardProps {
  currentUser: User;
  onBackToPortal: () => void;
}

export default function AdminDashboard({ currentUser, onBackToPortal }: AdminDashboardProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Manual audit trigger state
  const [auditLoading, setAuditLoading] = useState(false);

  // Config state
  const [serverUrl, setServerUrl] = useState('');
  const [jellyfinAdminUser, setJellyfinAdminUser] = useState('');
  const [jellyfinAdminPass, setJellyfinAdminPass] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);

  // Fetch all users
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users?search=${encodeURIComponent(searchQuery)}`);
      
      const contentType = response.headers.get('content-type');
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Your admin session has expired or you do not have permission to view this console. Please sign out and log back in.');
        }
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          throw new Error(data.error || 'Access denied or database error.');
        } else {
          throw new Error(`Server returned error status ${response.status}. Please make sure your MySQL database is active and remote access is permitted.`);
        }
      }

      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server did not return JSON. Please check if your MySQL database connection is fully active and tables are created.');
      }

      const data = await response.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    setConfigLoading(true);
    setConfigError(null);
    try {
      const response = await fetch('/api/admin/config');
      if (response.ok) {
        const data = await response.json();
        setServerUrl(data.serverUrl || '');
        setJellyfinAdminUser(data.adminUsername || '');
        setJellyfinAdminPass(data.adminPasswordFull || '');
        setApiKey(data.apiKey || '');
      }
    } catch (err: any) {
      setConfigError('Could not load active Jellyfin server settings.');
    } finally {
      setConfigLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchConfig();
  }, [searchQuery]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigError(null);
    setConfigSuccess(null);
    setConfigSaving(true);
    try {
      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl,
          adminUsername: jellyfinAdminUser,
          adminPasswordFull: jellyfinAdminPass,
          apiKey
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save configuration');
      }
      setConfigSuccess('Jellyfin server configuration successfully updated and verified in database!');
      fetchUsers();
    } catch (err: any) {
      setConfigError(err.message || 'Verification failed. Please check the Server URL and API Key.');
    } finally {
      setConfigSaving(false);
    }
  };

  // Handle subscriber action (activate, extend, disable, reactivate)
  const handleUserAction = async (userId: string, action: 'activate' | 'extend' | 'disable' | 'reactivate') => {
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Operation failed');
      }

      setSuccess(`User status successfully updated to "${action.toUpperCase()}".`);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Run manual subscription expiry audit checks
  const runManualExpiryCheck = async () => {
    setAuditLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/admin/run-expiry-check', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Audit check failed');

      setSuccess(`Subscription expiry audit complete. Locked and deactivated ${data.expiredCount} expired user accounts.`);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAuditLoading(false);
    }
  };

  // Count metrics
  const totalUsers = users.length;
  const activeSubs = users.filter(u => u.subscriptionStatus === 'Active' && u.role !== 'admin').length;
  const expiredSubs = users.filter(u => u.subscriptionStatus === 'Expired' && u.role !== 'admin').length;

  return (
    <div className="min-h-screen bg-[#090a0f] py-4 sm:py-8 px-3 sm:px-6 lg:px-8 selection:bg-rose-600 selection:text-white" id="admin-dashboard-root">
      
      {/* Top Navigation */}
      <nav className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 border-b border-slate-800/60 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
          <div className="flex flex-row gap-2 w-full sm:w-auto">
            <button 
              onClick={onBackToPortal}
              className="flex-1 sm:flex-none text-slate-300 hover:text-white transition flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider cursor-pointer bg-slate-900 border border-slate-800 px-3.5 py-2.5 rounded-xl shadow-md"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-rose-500" /> Portal
            </button>
            <button 
              onClick={() => { window.location.hash = '#landing'; }}
              className="flex-1 sm:flex-none text-slate-300 hover:text-white transition flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider cursor-pointer bg-slate-900 border border-slate-800 px-3.5 py-2.5 rounded-xl shadow-md"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-amber-500" /> Landing
            </button>
          </div>
          <div className="h-6 w-[1px] bg-slate-800/80 hidden sm:block"></div>
          <h1 className="font-display font-extrabold text-sm sm:text-lg tracking-tight text-white text-center sm:text-left">
            Portal Administrator Console
          </h1>
        </div>
        
        <div className="flex items-center justify-center md:justify-end w-full md:w-auto">
          <span className="text-[10px] sm:text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 py-2 px-4 rounded-xl font-semibold tracking-wider uppercase">
            System Overseer Access
          </span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto space-y-8">
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="admin-stats-container">
          <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 flex items-center gap-4 shadow-xl">
            <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-xs text-slate-400 font-medium">Total Registered Members</span>
              <span className="text-3xl font-extrabold text-white">{totalUsers}</span>
            </div>
          </div>

          <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 flex items-center gap-4 shadow-xl">
            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-xs text-slate-400 font-medium">Active Subscriptions</span>
              <span className="text-3xl font-extrabold text-white">{activeSubs}</span>
            </div>
          </div>

          <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 flex items-center gap-4 shadow-xl">
            <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-xs text-slate-400 font-medium">Expired/Locked Plans</span>
              <span className="text-3xl font-extrabold text-white">{expiredSubs}</span>
            </div>
          </div>

          <button 
            type="button"
            onClick={runManualExpiryCheck}
            disabled={auditLoading}
            className="bg-[#11131e] hover:bg-[#151726] border border-slate-800 hover:border-rose-500/50 rounded-2xl p-6 flex items-center gap-4 shadow-xl text-left cursor-pointer transition w-full disabled:opacity-60"
          >
            <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20">
              <Activity className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <span className="block text-xs text-slate-400 font-medium">Subscription Auditor</span>
              <span className="text-sm font-bold text-rose-400 hover:underline flex items-center gap-1.5 mt-1">
                {auditLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Auditing...
                  </>
                ) : (
                  <>
                    Trigger Audit Sync →
                  </>
                )}
              </span>
            </div>
          </button>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs rounded-xl">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs rounded-xl">
            {success}
          </div>
        )}

        {/* Full Width User List Section */}
        <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-4 sm:p-8 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-xl font-display font-extrabold text-white">Registered Users & Streaming Accounts</h3>
              <p className="text-slate-400 text-sm mt-1">Directly manage membership billing, extend plans, and lock or activate streaming credentials.</p>
            </div>
            
            {/* Search Bar */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute inset-y-0 left-3.5 h-full w-4 text-slate-500 flex items-center" />
              <input 
                type="text" 
                placeholder="Search by name, email..." 
                className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-white text-xs focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Users List Table (Desktop & Tablet) */}
          <div className="hidden md:block overflow-x-auto border border-slate-800/80 rounded-xl bg-[#07080c]">
            <table className="min-w-full divide-y divide-slate-800/60">
              <thead className="bg-[#0e1018]">
                <tr className="text-left text-xs font-semibold text-slate-400 tracking-wider">
                  <th className="px-6 py-4">User Details</th>
                  <th className="px-6 py-4">Subscription Plan</th>
                  <th className="px-6 py-4">Linked Server ID</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-rose-500" /> 
                      <span className="text-sm">Fetching registered users...</span>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No matching user records found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-[#11131e]/50 transition">
                      <td className="px-6 py-4">
                        <span className="block font-bold text-white">{user.fullName}</span>
                        <span className="block text-xs text-slate-400 font-medium">@{user.username}</span>
                        <span className="block text-xs text-slate-500 truncate max-w-[200px]" title={user.email}>{user.email}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          {user.role === 'admin' ? (
                            <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold px-2 py-0.5 rounded-lg">ADMIN</span>
                          ) : user.subscriptionStatus === 'Active' ? (
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-lg">ACTIVE</span>
                          ) : user.subscriptionStatus === 'Disabled' ? (
                            <span className="bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-lg">LOCKED</span>
                          ) : (
                            <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold px-2 py-0.5 rounded-lg">EXPIRED</span>
                          )}
                        </div>
                        {user.subscriptionExpiryDate && user.role !== 'admin' && (
                          <span className="block text-xs text-slate-400">
                            Expires: {new Date(user.subscriptionExpiryDate).toLocaleDateString()}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {user.role === 'admin' ? (
                          <span className="text-slate-600 font-medium">Bypassed (Admin)</span>
                        ) : (
                          <span className="truncate block max-w-[150px] text-slate-400 font-mono" title={user.jellyfinUserId}>
                            {user.jellyfinUserId || 'Sync Pending'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {user.role !== 'admin' && (
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {user.subscriptionStatus !== 'Active' ? (
                              <button
                                onClick={() => handleUserAction(user.id, 'activate')}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition cursor-pointer flex items-center gap-1 shadow-md shadow-emerald-950/20"
                                title="Activate Subscription"
                              >
                                <PlusCircle className="w-3.5 h-3.5" /> Activate
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleUserAction(user.id, 'extend')}
                                  className="bg-[#11131e] hover:bg-[#151726] border border-slate-800 hover:border-slate-700 text-slate-200 font-semibold py-1.5 px-3 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5"
                                  title="Extend 30 Days"
                                >
                                  <RefreshCw className="w-3.5 h-3.5 text-rose-500" /> Extend Plan
                                </button>
                                <button
                                  onClick={() => handleUserAction(user.id, 'disable')}
                                  className="bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/30 text-rose-400 font-semibold py-1.5 px-3 rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                                  title="Lock Access"
                                >
                                  <Ban className="w-3.5 h-3.5" /> Lock Account
                                </button>
                              </>
                            )}
                            {user.subscriptionStatus === 'Disabled' && (
                              <button
                                onClick={() => handleUserAction(user.id, 'reactivate')}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition cursor-pointer"
                                title="Reactivate subscription"
                              >
                                Unlock Access
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Users List Cards (Mobile Only) */}
          <div className="md:hidden space-y-4">
            {loading ? (
              <div className="p-8 text-center text-slate-500 bg-[#07080c] rounded-xl border border-slate-800/80">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-rose-500" />
                <span className="text-xs">Fetching registered users...</span>
              </div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-medium bg-[#07080c] rounded-xl border border-slate-800/80 text-xs">
                No matching user records found.
              </div>
            ) : (
              users.map((user) => (
                <div key={user.id} className="bg-[#07080c] border border-slate-800/80 rounded-xl p-5 space-y-4 shadow-lg">
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <span className="block font-bold text-white text-sm truncate">{user.fullName}</span>
                      <span className="block text-xs text-rose-400 font-medium">@{user.username}</span>
                      <span className="block text-[11px] text-slate-500 truncate" title={user.email}>{user.email}</span>
                    </div>
                    <div className="shrink-0">
                      {user.role === 'admin' ? (
                        <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold px-2 py-0.5 rounded-lg">ADMIN</span>
                      ) : user.subscriptionStatus === 'Active' ? (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-lg">ACTIVE</span>
                      ) : user.subscriptionStatus === 'Disabled' ? (
                        <span className="bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-lg">LOCKED</span>
                      ) : (
                        <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold px-2 py-0.5 rounded-lg">EXPIRED</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/40 text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Linked Server ID</span>
                      {user.role === 'admin' ? (
                        <span className="text-slate-600 font-medium font-mono">Bypassed</span>
                      ) : (
                        <span className="font-mono text-slate-300 break-all block">
                          {user.jellyfinUserId || 'Sync Pending'}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase font-bold tracking-wider mb-0.5">Plan Expiration</span>
                      {user.role === 'admin' ? (
                        <span className="text-slate-600 font-medium">Unlimited</span>
                      ) : user.subscriptionExpiryDate ? (
                        <span className="text-slate-300 block font-semibold">
                          {new Date(user.subscriptionExpiryDate).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-slate-600">N/A</span>
                      )}
                    </div>
                  </div>

                  {user.role !== 'admin' && (
                    <div className="pt-3 border-t border-slate-800/40 flex flex-col sm:flex-row gap-2">
                      {user.subscriptionStatus !== 'Active' ? (
                        <button
                          onClick={() => handleUserAction(user.id, 'activate')}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/20"
                        >
                          <PlusCircle className="w-3.5 h-3.5" /> Activate Plan
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleUserAction(user.id, 'extend')}
                            className="flex-1 bg-[#11131e] hover:bg-[#151726] border border-slate-800 hover:border-slate-700 text-slate-200 font-semibold py-2 rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-rose-500" /> Extend 30 Days
                          </button>
                          <button
                            onClick={() => handleUserAction(user.id, 'disable')}
                            className="flex-1 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/30 text-rose-400 font-semibold py-2 rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Ban className="w-3.5 h-3.5" /> Lock Account
                          </button>
                        </>
                      )}
                      {user.subscriptionStatus === 'Disabled' && (
                        <button
                          onClick={() => handleUserAction(user.id, 'reactivate')}
                          className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2 rounded-lg text-xs transition cursor-pointer"
                        >
                          Unlock Access
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Jellyfin Server Configuration Card */}
        <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl" id="jellyfin-config-card">
          <div>
            <h3 className="text-xl font-display font-extrabold text-white flex items-center gap-2">
              <Tv className="w-5 h-5 text-rose-500" />
              <span>Jellyfin Connection Settings</span>
            </h3>
            <p className="text-slate-400 text-sm mt-1">
              Directly adjust the connection parameters to your streaming server. Settings are stored securely in your active database.
            </p>
          </div>

          {configError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs rounded-xl">
              {configError}
            </div>
          )}

          {configSuccess && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs rounded-xl">
              {configSuccess}
            </div>
          )}

          {configLoading ? (
            <div className="py-8 text-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-rose-500" />
              <span className="text-xs">Loading active configuration...</span>
            </div>
          ) : (
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="serverUrl" className="block text-xs font-semibold text-slate-300">
                    Jellyfin Server URL
                  </label>
                  <input
                    type="url"
                    id="serverUrl"
                    required
                    placeholder="e.g. http://131.153.147.178:8096"
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="jellyfinAdminUser" className="block text-xs font-semibold text-slate-300">
                    Jellyfin Admin Username
                  </label>
                  <input
                    type="text"
                    id="jellyfinAdminUser"
                    required
                    placeholder="e.g. admin"
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
                    value={jellyfinAdminUser}
                    onChange={(e) => setJellyfinAdminUser(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="jellyfinAdminPass" className="block text-xs font-semibold text-slate-300">
                    Jellyfin Admin Password (Optional)
                  </label>
                  <input
                    type="password"
                    id="jellyfinAdminPass"
                    placeholder="Enter password (if required for auth)"
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
                    value={jellyfinAdminPass}
                    onChange={(e) => setJellyfinAdminPass(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="apiKey" className="block text-xs font-semibold text-slate-300">
                    Jellyfin API Key
                  </label>
                  <input
                    type="password"
                    id="apiKey"
                    required
                    placeholder="Paste your Jellyfin API Key"
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2.5 px-4 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={configSaving}
                  className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-rose-950/20"
                >
                  {configSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Verifying & Saving Connection...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" /> Save Connection Settings
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

      </main>
    </div>
  );
}
