import re

with open('src/components/AdminDashboard.tsx', 'r') as f:
    text = f.read()

# 1. Update imports to include Menu, Bell, Film
if 'Film' not in text:
    text = text.replace("Tv,\n", "Tv, Film, Bell, Menu,\n")

# 2. Add mobileSidebarOpen state
state_search = "const [activeTab, setActiveTab] = useState<'subscriptions'"
state_replace = "const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);\n  const [activeTab, setActiveTab] = useState<'subscriptions'"
text = text.replace(state_search, state_replace)

# 3. Locate the start of return (
return_start = text.find('  return (\n    <div className="min-h-screen bg-[#0a0304]')
if return_start == -1:
    return_start = text.find('  return (\n    <div className=')

print("Return starts at:", return_start)

# 4. Locate the tab content start
# Tab content starts at: {activeTab === 'subscriptions' && (
tab_content_start = text.find("{activeTab === 'subscriptions' && (", return_start)
print("Tab content starts at:", tab_content_start)

# 5. Extract pre_return code
pre_return = text[:return_start]

# 6. Extract the whole tab screens content + modals
rest_of_file = text[tab_content_start:]

# Inside rest_of_file, let's locate </main> and see what's between tab_content_start and </main>
main_end = rest_of_file.find('      </main>')
tab_screens = rest_of_file[:main_end].strip()
modals_and_end = rest_of_file[main_end:].strip()
# Remove </main> from modals_and_end since we'll put our own </main>
modals_and_end = modals_and_end.replace('      </main>', '').strip()
if modals_and_end.endswith('    </div>\n  );\n}'):
    modals_only = modals_and_end[:-len('    </div>\n  );\n}')].strip()
elif modals_and_end.endswith('</div>\n  );\n}'):
    modals_only = modals_and_end[:-len('</div>\n  );\n}')].strip()
else:
    # find the last </div>\n  );\n}
    idx = modals_and_end.rfind('</div>\n  );\n}')
    if idx != -1:
        modals_only = modals_and_end[:idx].strip()
    else:
        modals_only = modals_and_end

admin_layout = """  return (
    <div className="min-h-screen bg-[#0a0304] text-white flex flex-col md:flex-row selection:bg-[#d31d38] selection:text-white relative" id="admin-dashboard-root">
      
      {/* Floating Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] max-w-sm w-full bg-[#120507]/95 backdrop-blur-md border-l-4 ${toast.type === 'success' ? 'border-emerald-500' : 'border-[#d31d38]'} rounded-xl shadow-2xl p-4 flex items-start gap-3 border border-[#2e1015] animate-in fade-in slide-in-from-top-4 duration-300`}>
          <div className="mt-0.5 shrink-0">
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-[#d31d38]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-display">
              {toast.type === 'success' ? 'Action Successful' : 'Action Failed'}
            </h4>
            <p className="text-[11px] text-zinc-300 mt-1 leading-normal">{toast.message}</p>
          </div>
          <button 
            onClick={() => setToast(null)}
            className="text-zinc-500 hover:text-white transition font-bold text-xs p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MOBILE TOPBAR */}
      <header className="md:hidden sticky top-0 z-30 bg-[#120507]/95 backdrop-blur-md border-b border-[#2e1015] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-xl bg-[#180608] border border-[#2e1015] text-zinc-300 hover:text-white cursor-pointer"
            title="Open Admin Navigation"
          >
            <Menu className="w-5 h-5 text-[#d31d38]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-tr from-[#d31d38] to-[#ff2b47] rounded-full flex items-center justify-center text-white shadow-[0_0_12px_rgba(211,29,56,0.5)]">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <span className="font-display font-black text-lg tracking-wider text-white">
              CIN<span className="text-[#d31d38]">ODE</span>
            </span>
            <span className="text-[9px] bg-[#d31d38]/20 text-[#ff4d64] font-extrabold px-1.5 py-0.5 rounded border border-[#d31d38]/30 uppercase">ADMIN</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onBackToPortal}
            className="text-xs bg-[#180608] hover:bg-[#220a0e] text-zinc-300 border border-[#2e1015] font-bold py-1.5 px-3 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#d31d38]" /> Portal
          </button>
        </div>
      </header>

      {/* MOBILE SLIDE-OVER DRAWER */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 max-w-xs w-full bg-[#120507] border-r border-[#2e1015] p-5 flex flex-col justify-between shadow-2xl z-50 animate-in slide-in-from-left duration-200 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#2e1015] mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-gradient-to-tr from-[#d31d38] to-[#ff2b47] rounded-xl flex items-center justify-center text-white shadow-[0_0_15px_rgba(211,29,56,0.5)]">
                    <ShieldAlert className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <span className="font-display font-black text-lg tracking-wider text-white block leading-none">
                      CIN<span className="text-[#d31d38]">ODE</span>
                    </span>
                    <span className="text-[9px] text-[#ff4d64] font-bold uppercase tracking-widest block mt-0.5">Admin Suite</span>
                  </div>
                </div>
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-1.5 rounded-lg bg-[#180608] text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Admin quick status card */}
              <div className="bg-[#180608] border border-[#2e1015] rounded-xl p-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Administrator</span>
                  <span className="text-[9px] bg-emerald-500/15 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">Active</span>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono mt-1">@{currentUser.username}</div>
              </div>

              {/* Grouped Navigation Links */}
              <nav className="space-y-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2 mb-1.5">Core Operations</div>
                  <div className="space-y-1">
                    {[
                      { id: 'subscriptions', label: 'Subscriptions & Members', icon: Tv, badge: totalUsersCount },
                      { id: 'payments', label: 'Payment Verification', icon: CreditCard, badge: users.filter(u => u.paymentStatus === 'Pending Verification').length, alert: true },
                      { id: 'media_requests', label: 'Movie & Show Requests', icon: Film, badge: requests.filter(r => r.status === 'Pending').length, alert: true },
                    ].map((item) => {
                      const Icon = item.icon;
                      const isSelected = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id as any);
                            setMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                            isSelected 
                              ? 'bg-gradient-to-r from-[#d31d38] to-[#b0162c] text-white shadow-[0_4px_15px_rgba(211,29,56,0.35)]' 
                              : 'text-zinc-400 hover:text-white hover:bg-[#180608]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-[#d31d38]'}`} />
                            <span className="truncate">{item.label}</span>
                          </div>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${item.alert ? 'bg-amber-500 text-black animate-pulse' : isSelected ? 'bg-white/20 text-white' : 'bg-[#180608] text-zinc-400 border border-[#2e1015]'}`}>
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2 mb-1.5">Finance & Gateway</div>
                  <div className="space-y-1">
                    {[
                      { id: 'payment_settings', label: 'Gateway & Direct Debit', icon: Landmark },
                      { id: 'commissions', label: 'Commission Payouts', icon: DollarSign, badge: commissions.filter(c => c.status === 'pending').length, alert: true },
                      { id: 'reports', label: 'Financial Reports', icon: TrendingUp },
                    ].map((item) => {
                      const Icon = item.icon;
                      const isSelected = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id as any);
                            setMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                            isSelected 
                              ? 'bg-gradient-to-r from-[#d31d38] to-[#b0162c] text-white shadow-[0_4px_15px_rgba(211,29,56,0.35)]' 
                              : 'text-zinc-400 hover:text-white hover:bg-[#180608]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-purple-400]'}`} />
                            <span className="truncate">{item.label}</span>
                          </div>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-500 text-black animate-pulse">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2 mb-1.5">Growth & Marketing</div>
                  <div className="space-y-1">
                    {[
                      { id: 'affiliates', label: 'Affiliate Partners', icon: Users, badge: affiliatePartnersCount },
                      { id: 'affiliates_dashboard', label: 'Affiliate Analytics', icon: Award },
                      { id: 'notifications', label: 'Broadcast Notifications', icon: Bell },
                    ].map((item) => {
                      const Icon = item.icon;
                      const isSelected = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id as any);
                            setMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                            isSelected 
                              ? 'bg-gradient-to-r from-[#d31d38] to-[#b0162c] text-white shadow-[0_4px_15px_rgba(211,29,56,0.35)]' 
                              : 'text-zinc-400 hover:text-white hover:bg-[#180608]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-emerald-400'}`} />
                            <span className="truncate">{item.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2 mb-1.5">System & Server</div>
                  <div className="space-y-1">
                    {[
                      { id: 'mobile_app', label: 'Mobile App Downloads', icon: Smartphone },
                      { id: 'support_config', label: 'Support & Bank Config', icon: HelpCircle },
                      { id: 'smtp_email', label: 'SMTP & Email Templates', icon: Mail },
                      { id: 'cpanel_deploy', label: 'cPanel / FTP Deploy', icon: Server },
                    ].map((item) => {
                      const Icon = item.icon;
                      const isSelected = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id as any);
                            setMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                            isSelected 
                              ? 'bg-gradient-to-r from-[#d31d38] to-[#b0162c] text-white shadow-[0_4px_15px_rgba(211,29,56,0.35)]' 
                              : 'text-zinc-400 hover:text-white hover:bg-[#180608]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-sky-400'}`} />
                            <span className="truncate">{item.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </nav>
            </div>

            <div className="pt-4 border-t border-[#2e1015] space-y-2">
              <button
                onClick={onBackToPortal}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#180608] hover:bg-[#220a0e] text-zinc-300 text-xs font-bold border border-[#2e1015] transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#d31d38]" /> Back to Portal
              </button>
              <button
                onClick={() => { window.location.hash = '#landing'; }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#180608] hover:bg-[#220a0e] text-zinc-300 text-xs font-bold border border-[#2e1015] transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-amber-500" /> Landing Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DESKTOP APP SIDEBAR */}
      <aside className="hidden md:flex md:w-64 lg:w-72 md:sticky md:top-0 md:h-screen flex-col justify-between bg-[#120507] border-r border-[#2e1015] p-5 shrink-0 z-20 overflow-y-auto">
        <div>
          {/* Brand header */}
          <div className="flex items-center gap-3 pb-4 border-b border-[#2e1015] mb-4">
            <div className="w-9 h-9 bg-gradient-to-tr from-[#d31d38] to-[#ff2b47] rounded-xl flex items-center justify-center text-white shadow-[0_0_18px_rgba(211,29,56,0.6)] shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="font-display font-black text-xl tracking-wider text-white block leading-none">
                CIN<span className="text-[#d31d38]">ODE</span>
              </span>
              <span className="text-[9px] text-[#ff4d64] font-bold uppercase tracking-widest block mt-1">Admin Central</span>
            </div>
          </div>

          {/* Admin mini profile badge */}
          <div className="bg-[#180608] border border-[#2e1015] rounded-2xl p-3 mb-4 shadow-inner">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-extrabold text-white truncate">Administrator</div>
                <div className="text-[10px] text-zinc-400 font-mono truncate">@{currentUser.username}</div>
              </div>
              <button
                onClick={fetchUsers}
                disabled={loading}
                className="p-1.5 rounded-lg bg-[#120507] text-zinc-400 hover:text-white border border-[#2e1015] transition cursor-pointer"
                title="Reload Data"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#d31d38] ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Grouped Sidebar Navigation */}
          <nav className="space-y-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2 mb-1.5">Core Operations</div>
              <div className="space-y-1">
                {[
                  { id: 'subscriptions', label: 'Subscriptions & Members', icon: Tv, badge: totalUsersCount },
                  { id: 'payments', label: 'Payment Verification', icon: CreditCard, badge: users.filter(u => u.paymentStatus === 'Pending Verification').length, alert: true },
                  { id: 'media_requests', label: 'Movie & Show Requests', icon: Film, badge: requests.filter(r => r.status === 'Pending').length, alert: true },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as any)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        isSelected 
                          ? 'bg-gradient-to-r from-[#d31d38] to-[#b0162c] text-white shadow-[0_4px_18px_rgba(211,29,56,0.35)]' 
                          : 'text-zinc-400 hover:text-white hover:bg-[#180608]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-[#d31d38]'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${item.alert ? 'bg-amber-500 text-black animate-pulse' : isSelected ? 'bg-white/20 text-white' : 'bg-[#180608] text-zinc-400 border border-[#2e1015]'}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2 mb-1.5">Finance & Gateway</div>
              <div className="space-y-1">
                {[
                  { id: 'payment_settings', label: 'Gateway & Direct Debit', icon: Landmark },
                  { id: 'commissions', label: 'Commission Payouts', icon: DollarSign, badge: commissions.filter(c => c.status === 'pending').length, alert: true },
                  { id: 'reports', label: 'Financial Reports', icon: TrendingUp },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as any)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        isSelected 
                          ? 'bg-gradient-to-r from-[#d31d38] to-[#b0162c] text-white shadow-[0_4px_18px_rgba(211,29,56,0.35)]' 
                          : 'text-zinc-400 hover:text-white hover:bg-[#180608]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-purple-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-500 text-black animate-pulse">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2 mb-1.5">Growth & Marketing</div>
              <div className="space-y-1">
                {[
                  { id: 'affiliates', label: 'Affiliate Partners', icon: Users, badge: affiliatePartnersCount },
                  { id: 'affiliates_dashboard', label: 'Affiliate Analytics', icon: Award },
                  { id: 'notifications', label: 'Broadcast Notifications', icon: Bell },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as any)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        isSelected 
                          ? 'bg-gradient-to-r from-[#d31d38] to-[#b0162c] text-white shadow-[0_4px_18px_rgba(211,29,56,0.35)]' 
                          : 'text-zinc-400 hover:text-white hover:bg-[#180608]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-emerald-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2 mb-1.5">System & Server</div>
              <div className="space-y-1">
                {[
                  { id: 'mobile_app', label: 'Mobile App Downloads', icon: Smartphone },
                  { id: 'support_config', label: 'Support & Bank Config', icon: HelpCircle },
                  { id: 'smtp_email', label: 'SMTP & Email Templates', icon: Mail },
                  { id: 'cpanel_deploy', label: 'cPanel / FTP Deploy', icon: Server },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as any)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        isSelected 
                          ? 'bg-gradient-to-r from-[#d31d38] to-[#b0162c] text-white shadow-[0_4px_18px_rgba(211,29,56,0.35)]' 
                          : 'text-zinc-400 hover:text-white hover:bg-[#180608]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-sky-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="pt-4 border-t border-[#2e1015] space-y-2">
          <button
            onClick={onBackToPortal}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#180608] hover:bg-[#220a0e] text-zinc-300 text-xs font-bold border border-[#2e1015] transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#d31d38]" /> Back to Portal
          </button>
          <button
            onClick={() => { window.location.hash = '#landing'; }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#180608] hover:bg-[#220a0e] text-zinc-300 text-xs font-bold border border-[#2e1015] transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-500" /> Landing Page
          </button>
        </div>
      </aside>

      {/* MAIN SCREEN CANVAS */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full pb-24 md:pb-8 space-y-6">
        
        {/* Desktop Screen Header Bar */}
        <div className="hidden md:flex items-center justify-between pb-6 border-b border-[#2e1015]">
          <div>
            <div className="text-[10px] text-[#ff4d64] font-extrabold uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d31d38]"></span>
              CINODE ADMIN CONSOLE / {activeTab.replace('_', ' ').toUpperCase()}
            </div>
            <h2 className="text-2xl font-display font-extrabold text-white mt-1 capitalize">
              {activeTab === 'subscriptions' && 'Subscription & Jellyfin Accounts'}
              {activeTab === 'payments' && 'Pending & Verified Transactions'}
              {activeTab === 'payment_settings' && 'Squad & Direct Debit Gateways'}
              {activeTab === 'support_config' && 'Customer Support & Bank Details'}
              {activeTab === 'mobile_app' && 'Mobile App Download & APK Links'}
              {activeTab === 'affiliates' && 'Affiliate Partner Accounts'}
              {activeTab === 'affiliates_dashboard' && 'Affiliate Performance & Metrics'}
              {activeTab === 'commissions' && 'Commission Payout Approvals'}
              {activeTab === 'reports' && 'Revenue & Growth Analytics'}
              {activeTab === 'media_requests' && 'Movie & TV Show Requests'}
              {activeTab === 'notifications' && 'Broadcast Announcement Center'}
              {activeTab === 'smtp_email' && 'SMTP Settings & Email Templates'}
              {activeTab === 'cpanel_deploy' && 'Production cPanel / FTP Deployment'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="bg-[#120507] hover:bg-[#1c080b] border border-[#2e1015] hover:border-[#d31d38]/50 text-zinc-300 text-xs font-bold py-2.5 px-4 rounded-xl transition flex items-center gap-2 cursor-pointer shadow"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#d31d38] ${loading ? 'animate-spin' : ''}`} /> Refresh Data
            </button>
            <button
              onClick={onBackToPortal}
              className="bg-[#120507] hover:bg-[#1c080b] border border-[#2e1015] hover:border-[#d31d38]/50 text-zinc-300 text-xs font-bold py-2.5 px-4 rounded-xl transition flex items-center gap-2 cursor-pointer shadow"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#d31d38]" /> User Portal
            </button>
          </div>
        </div>

        {/* Core Administrative Summary Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="admin-stats-container">
          <div 
            onClick={() => setActiveTab('subscriptions')}
            className={`bg-[#120507] border ${activeTab === 'subscriptions' ? 'border-[#d31d38]/50' : 'border-[#2e1015]'} rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 shadow-xl cursor-pointer hover:border-[#d31d38]/40 transition`}
          >
            <div className="p-2.5 bg-[#d31d38]/10 text-[#d31d38] rounded-xl border border-[#d31d38]/20 hidden sm:block">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Total Members</span>
              <span className="text-2xl font-extrabold text-white">{totalUsersCount}</span>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab('subscriptions')}
            className="bg-[#120507] border border-[#2e1015] rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 shadow-xl cursor-pointer hover:border-emerald-500/40 transition"
          >
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 hidden sm:block">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Active Streamers</span>
              <span className="text-2xl font-extrabold text-white">{activeSubsCount}</span>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab('subscriptions')}
            className="bg-[#120507] border border-[#2e1015] rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 shadow-xl cursor-pointer hover:border-[#d31d38]/40 transition"
          >
            <div className="p-2.5 bg-[#d31d38]/10 text-[#ff4d64] rounded-xl border border-[#d31d38]/20 hidden sm:block">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Expired Accounts</span>
              <span className="text-2xl font-extrabold text-white">{expiredSubsCount}</span>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab('affiliates')}
            className={`bg-[#120507] border ${activeTab === 'affiliates' ? 'border-emerald-500/50' : 'border-[#2e1015]'} rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 shadow-xl cursor-pointer hover:border-emerald-500/40 transition`}
          >
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 hidden sm:block">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Affiliate Partners</span>
              <span className="text-2xl font-extrabold text-white">{affiliatePartnersCount}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-[#d31d38]/10 border border-[#d31d38]/20 text-rose-200 text-xs rounded-xl flex justify-between items-center shadow-lg">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-[#ff4d64] hover:text-white font-bold cursor-pointer">×</button>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs rounded-xl flex justify-between items-center shadow-lg">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-white font-bold cursor-pointer">×</button>
          </div>
        )}

        {/* Tab Screens */}
        """ + tab_screens + """

      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#120507]/95 backdrop-blur-lg border-t border-[#2e1015] p-2 flex justify-around items-center z-40">
        {[
          { id: 'subscriptions', label: 'Users', icon: Tv },
          { id: 'payments', label: 'Verify', icon: CreditCard, badge: users.filter(u => u.paymentStatus === 'Pending Verification').length },
          { id: 'media_requests', label: 'Requests', icon: Film, badge: requests.filter(r => r.status === 'Pending').length },
          { id: 'affiliates', label: 'Affiliates', icon: Users },
          { id: 'cpanel_deploy', label: 'Deploy', icon: Server },
        ].map((item) => {
          const Icon = item.icon;
          const isSelected = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition cursor-pointer min-w-12 relative ${
                isSelected ? 'text-[#ff4d64]' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <div className={`p-1 rounded-lg relative ${isSelected ? 'bg-[#d31d38]/20 border border-[#d31d38]/30 shadow-[0_0_10px_rgba(211,29,56,0.3)]' : ''}`}>
                <Icon className="w-4.5 h-4.5" />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#d31d38] text-[8px] font-extrabold text-white rounded-full flex items-center justify-center animate-pulse">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-bold mt-0.5 tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ALL MODALS PRESERVED INTACT */}
      """ + modals_only + """

    </div>
  );
}
"""

final_code = pre_return + admin_layout

with open('src/components/AdminDashboard.tsx', 'w') as f:
    f.write(final_code)

print("AdminDashboard refactored successfully!")
