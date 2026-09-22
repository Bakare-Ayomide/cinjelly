import re

with open('src/components/UserPortal.tsx', 'r') as f:
    text = f.read()

# Split pre_return and return
return_pos = text.find('  return (\n    <div className="min-h-screen')
pre_return = text[:return_pos]

# Let's cleanly define the screens:
def extract(s_str, e_str):
    s = text.find(s_str)
    if s == -1: raise Exception(f"Missing {s_str}")
    e = text.find(e_str, s)
    if e == -1: raise Exception(f"Missing {e_str}")
    return text[s:e]

email_banner = extract('{/* Email Verification Banner */}', '{/* Welcome Header */}')
welcome_header = extract('{/* Welcome Header */}', '{/* Dynamic Card Area */}')
dynamic_cards = extract('{/* Dynamic Card Area */}', '{/* Player Launch Card */}')
player_card = extract('{/* Player Launch Card */}', '{/* Side Membership Details Card */}')

# Side card contains the full card from {/* Side Membership Details Card */} to {/* Targeted Broadcast Notifications Feed */} or similar
side_start = text.find('{/* Side Membership Details Card */}')
# Find the closing </div> of the Side Membership Details Card
# Let's inspect text between side_start and {/* Mobile App Download Advertisement Banner */}
side_to_mob = extract('{/* Side Membership Details Card */}', '{/* Mobile App Download Advertisement Banner */}')

mob_app_sec = extract('{/* Mobile App Download Advertisement Banner */}', '{/* Community Announcements Feed & Media Requests Section */}')

bc_feed = extract('{/* Targeted Broadcast Notifications Feed */}', '{/* User Movie/Show Request Console */}')
media_reqs = extract('{/* User Movie/Show Request Console */}', '{/* Affiliate Referral Program Section */}')

aff_sec = extract('{/* Affiliate Referral Program Section */}', '{/* Support & Contact Details Section */}')
sup_sec = extract('{/* Support & Contact Details Section */}', '{/* RE-SYNC SESSION CREDENTIALS MODAL */}')

# Modals
modals_part = text[text.find('{/* RE-SYNC SESSION CREDENTIALS MODAL */}'):]
# Clean up any trailing broken tags
modals_clean = modals_part[:modals_part.rfind('</div>')]

# Let's build the dedicated Direct Debit screen content:
direct_debit_screen = """
            <div className="bg-[#120507] border border-[#2e1015] rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500"></div>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#2e1015] pb-6 mb-6">
                <div>
                  <span className="text-[10px] text-purple-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5" /> Automated Recurring Renewal
                  </span>
                  <h3 className="text-xl font-display font-extrabold text-white mt-1">Squad Direct Debit Mandate</h3>
                  <p className="text-xs text-zinc-400 mt-1 max-w-xl">
                    Never lose access to your streams. Set up an automated monthly ₦600 bank debit with your Nigerian bank account.
                  </p>
                </div>
                <div>
                  {userMandate && userMandate.status === 'active' ? (
                    <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" /> Active Mandate
                    </span>
                  ) : (
                    <span className="bg-[#180608] text-zinc-400 border border-[#2e1015] text-xs font-bold px-3 py-1.5 rounded-xl">
                      No Active Mandate
                    </span>
                  )}
                </div>
              </div>

              {userMandate && userMandate.status === 'active' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-[#180608] border border-purple-500/20 p-4 rounded-xl">
                      <div className="text-[10px] text-zinc-500 font-bold uppercase">Authorized Bank</div>
                      <div className="text-sm font-bold text-white mt-1">{userMandate.bankName || 'Nigerian Bank'}</div>
                    </div>
                    <div className="bg-[#180608] border border-purple-500/20 p-4 rounded-xl">
                      <div className="text-[10px] text-zinc-500 font-bold uppercase">Debit Account</div>
                      <div className="text-sm font-mono text-purple-300 mt-1">
                        {userMandate.accountNumber ? `******${userMandate.accountNumber.slice(-4)}` : '••••••••••'}
                      </div>
                    </div>
                    <div className="bg-[#180608] border border-purple-500/20 p-4 rounded-xl">
                      <div className="text-[10px] text-zinc-500 font-bold uppercase">Next Renewal Date</div>
                      <div className="text-sm font-bold text-emerald-400 mt-1">
                        {userMandate.nextDebitDate ? new Date(userMandate.nextDebitDate).toLocaleDateString() : 'Active Renewal'}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#2e1015]">
                    <button
                      type="button"
                      onClick={handleTriggerManualRenewalDebit}
                      disabled={renewingMandate}
                      className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-2.5 px-5 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-600/30"
                    >
                      {renewingMandate ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      <span>Trigger Renewal Debit Now (₦{userMandate.amount || '600'})</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelUserMandate}
                      disabled={cancellingMandate}
                      className="bg-[#180608] hover:bg-rose-950/40 text-rose-300 border border-rose-500/30 font-bold text-xs py-2.5 px-4 rounded-xl transition flex items-center gap-2 cursor-pointer"
                    >
                      {cancellingMandate ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      <span>Cancel Mandate</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-[#180608] border border-[#2e1015] p-5 rounded-xl text-xs text-zinc-300 space-y-2">
                    <div className="font-bold text-white text-sm mb-1">Why enable Automated Direct Debit?</div>
                    <p>• Seamless unthrottled streaming without manual bank transfers or monthly logins.</p>
                    <p>• Instant renewal verification and immediate Jellyfin account validity extension.</p>
                    <p>• Fully secure and regulated by the Central Bank of Nigeria via Squad / HabariPay.</p>
                    <p>• Cancel anytime in 1-click directly from this portal.</p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleOpenDirectDebitModal}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs py-3 px-6 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-600/30"
                    >
                      <Landmark className="w-4 h-4" />
                      <span>Set Up Monthly Direct Debit (₦600/mo)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
"""

new_full_portal = pre_return + """  return (
    <div className="min-h-screen bg-[#0a0304] text-white flex flex-col md:flex-row selection:bg-[#d31d38] selection:text-white relative" id="user-portal-root">
      
      {/* MOBILE TOPBAR */}
      <header className="md:hidden sticky top-0 z-30 bg-[#120507]/95 backdrop-blur-md border-b border-[#2e1015] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-xl bg-[#180608] border border-[#2e1015] text-zinc-300 hover:text-white"
            title="Open Navigation Menu"
          >
            <Menu className="w-5 h-5 text-[#d31d38]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-tr from-[#d31d38] to-[#ff2b47] rounded-full flex items-center justify-center text-white shadow-[0_0_12px_rgba(211,29,56,0.5)]">
              <Tv className="w-4 h-4" />
            </div>
            <span className="font-display font-black text-lg tracking-wider text-white">
              CIN<span className="text-[#d31d38]">ODE</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowHeaderNotifs(!showHeaderNotifs)}
              className="p-2 rounded-xl bg-[#180608] border border-[#2e1015] text-zinc-300 hover:text-white relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4 text-[#d31d38]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#d31d38] text-[9px] font-extrabold text-white rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
            {showHeaderNotifs && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowHeaderNotifs(false)} />
                <div className="absolute right-0 mt-2 w-72 bg-[#120507] border border-[#2e1015] rounded-2xl shadow-2xl z-50 overflow-hidden text-left py-2">
                  <div className="px-4 py-2.5 border-b border-[#2e1015] flex items-center justify-between bg-[#0a0304]">
                    <span className="font-extrabold text-xs text-white uppercase tracking-wider font-display">Notifications</span>
                    <span className="text-[10px] bg-[#d31d38]/15 text-[#ff4d64] px-2 py-0.5 rounded-full font-bold">{unreadCount} unread</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-[#2e1015]/60">
                    {notifications.map((notif, idx) => (
                      <button
                        key={notif.id}
                        type="button"
                        onClick={() => {
                          handleOpenNotification(notif);
                          setShowHeaderNotifs(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-[#1c080b] transition block"
                      >
                        <div className="text-[9px] text-[#ff4d64] font-extrabold uppercase">Notification {idx + 1}</div>
                        <div className="font-bold text-xs text-white truncate">{notif.title}</div>
                        <div className="text-[10px] text-zinc-400 truncate mt-0.5">{notif.message}</div>
                      </button>
                    ))}
                    {notifications.length === 0 && (
                      <div className="py-6 text-center text-xs text-zinc-500">No notifications</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setActiveTab('account')}
            className="w-8 h-8 rounded-full bg-[#1c080b] border border-[#d31d38]/40 text-[#ff4d64] font-bold text-xs flex items-center justify-center uppercase"
            title="Account Settings"
          >
            {user.fullName ? user.fullName[0] : 'U'}
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
          <div className="fixed inset-y-0 left-0 max-w-xs w-full bg-[#120507] border-r border-[#2e1015] p-5 flex flex-col justify-between shadow-2xl z-50 animate-in slide-in-from-left duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#2e1015] mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-gradient-to-tr from-[#d31d38] to-[#ff2b47] rounded-full flex items-center justify-center text-white shadow-[0_0_15px_rgba(211,29,56,0.5)]">
                    <Tv className="w-4.5 h-4.5" />
                  </div>
                  <span className="font-display font-black text-xl tracking-wider text-white">
                    CIN<span className="text-[#d31d38]">ODE</span>
                  </span>
                </div>
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-1.5 rounded-lg bg-[#180608] text-zinc-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User badge */}
              <div className="bg-[#180608] border border-[#2e1015] rounded-xl p-3 mb-4">
                <div className="text-xs font-bold text-white truncate">{user.fullName}</div>
                <div className="text-[10px] text-zinc-500 font-mono truncate">@{user.username}</div>
                <div className="mt-2 flex items-center gap-1.5">
                  {isActive ? (
                    <span className="text-[9px] bg-emerald-500/15 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Active Subscriber
                    </span>
                  ) : (
                    <span className="text-[9px] bg-[#d31d38]/15 text-[#ff4d64] font-bold px-2 py-0.5 rounded-full border border-[#d31d38]/20 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#d31d38]"></span> Subscription Inactive
                    </span>
                  )}
                </div>
              </div>

              {/* Nav Items */}
              <nav className="space-y-1">
                {[
                  { id: 'overview', label: 'Overview & Stream', icon: Tv },
                  { id: 'subscription', label: 'Subscription & Pay', icon: CreditCard },
                  { id: 'direct_debit', label: 'Direct Debit Mandate', icon: Landmark },
                  { id: 'requests', label: 'Media Requests', icon: Film },
                  { id: 'affiliate', label: 'Affiliate & Earnings', icon: Gift },
                  { id: 'apps', label: 'Apps & Devices', icon: Smartphone },
                  { id: 'support', label: 'Help & Support', icon: HelpCircle },
                  { id: 'account', label: 'Account & Security', icon: Key },
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
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        isSelected 
                          ? 'bg-gradient-to-r from-[#d31d38] to-[#b0162c] text-white shadow-[0_4px_15px_rgba(211,29,56,0.35)]' 
                          : 'text-zinc-400 hover:text-white hover:bg-[#180608]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-[#d31d38]'}`} />
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 opacity-60 ${isSelected ? 'text-white' : 'text-zinc-600'}`} />
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-[#2e1015] space-y-2">
              <button
                onClick={() => { window.location.hash = '#landing'; }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#180608] hover:bg-[#220a0e] text-zinc-300 text-xs font-bold border border-[#2e1015] transition"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#d31d38]" /> Back to Landing Page
              </button>
              {user.role === 'admin' && (
                <button
                  onClick={() => { window.location.hash = '#admin'; }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#d31d38]/15 hover:bg-[#d31d38]/25 text-[#ff4d64] text-xs font-bold border border-[#d31d38]/30 transition"
                >
                  <ShieldAlert className="w-3.5 h-3.5" /> Admin Control Suite
                </button>
              )}
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#180608] hover:bg-rose-950/40 text-rose-300 text-xs font-bold border border-[#2e1015] transition"
              >
                <LogOut className="w-3.5 h-3.5 text-[#d31d38]" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DESKTOP APP SIDEBAR */}
      <aside className="hidden md:flex md:w-64 lg:w-72 md:sticky md:top-0 md:h-screen flex-col justify-between bg-[#120507] border-r border-[#2e1015] p-5 shrink-0 z-20">
        <div>
          {/* Brand header */}
          <div className="flex items-center gap-3 pb-5 border-b border-[#2e1015] mb-5">
            <div className="w-9 h-9 bg-gradient-to-tr from-[#d31d38] to-[#ff2b47] rounded-xl flex items-center justify-center text-white shadow-[0_0_18px_rgba(211,29,56,0.6)] shrink-0">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <span className="font-display font-black text-xl tracking-wider text-white block leading-none">
                CIN<span className="text-[#d31d38]">ODE</span>
              </span>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block mt-1">Streaming Portal</span>
            </div>
          </div>

          {/* User mini badge */}
          <div className="bg-[#180608] border border-[#2e1015] rounded-2xl p-3.5 mb-5 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#d31d38]/30 to-[#b0162c]/10 border border-[#d31d38]/40 flex items-center justify-center font-bold text-sm text-[#ff4d64] shrink-0">
                {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-extrabold text-white truncate">{user.fullName}</div>
                <div className="text-[10px] text-zinc-400 truncate">@{user.username}</div>
              </div>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-[#2e1015]/80 flex items-center justify-between">
              {isActive ? (
                <span className="text-[9px] bg-emerald-500/15 text-emerald-400 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Active
                </span>
              ) : (
                <span className="text-[9px] bg-[#d31d38]/15 text-[#ff4d64] font-extrabold px-2 py-0.5 rounded-full border border-[#d31d38]/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d31d38]"></span> Expired
                </span>
              )}
              <button
                onClick={onReloadUser}
                className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 font-bold cursor-pointer"
                title="Refresh Status"
              >
                <RefreshCw className="w-3 h-3 text-[#d31d38]" /> Refresh
              </button>
            </div>
          </div>

          {/* Sidebar Navigation */}
          <nav className="space-y-1.5">
            {[
              { id: 'overview', label: 'Overview & Stream', icon: Tv },
              { id: 'subscription', label: 'Subscription & Pay', icon: CreditCard },
              { id: 'direct_debit', label: 'Direct Debit Auto-Renew', icon: Landmark },
              { id: 'requests', label: 'Media Requests', icon: Film },
              { id: 'affiliate', label: 'Affiliate & Earnings', icon: Gift },
              { id: 'apps', label: 'Apps & Devices', icon: Smartphone },
              { id: 'support', label: 'Help & Support', icon: HelpCircle },
              { id: 'account', label: 'Account & Security', icon: Key },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isSelected 
                      ? 'bg-gradient-to-r from-[#d31d38] to-[#b0162c] text-white shadow-[0_4px_20px_rgba(211,29,56,0.35)]' 
                      : 'text-zinc-400 hover:text-white hover:bg-[#180608]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-[#d31d38]'}`} />
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 opacity-60 ${isSelected ? 'text-white' : 'text-zinc-600'}`} />
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="pt-4 border-t border-[#2e1015] space-y-2">
          <button
            onClick={() => { window.location.hash = '#landing'; }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#180608] hover:bg-[#220a0e] text-zinc-300 text-xs font-bold border border-[#2e1015] transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#d31d38]" /> Landing Page
          </button>
          {user.role === 'admin' && (
            <button
              onClick={() => { window.location.hash = '#admin'; }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#d31d38]/15 hover:bg-[#d31d38]/25 text-[#ff4d64] text-xs font-bold border border-[#d31d38]/30 transition cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" /> Admin Control Suite
            </button>
          )}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#180608] hover:bg-rose-950/40 text-rose-300 text-xs font-bold border border-[#2e1015] transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-[#d31d38]" /> Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN SCREEN CANVAS */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full pb-24 md:pb-8">
        
        {/* Desktop Screen Header Bar */}
        <div className="hidden md:flex items-center justify-between pb-6 mb-6 border-b border-[#2e1015]">
          <div>
            <div className="text-[10px] text-[#ff4d64] font-extrabold uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d31d38]"></span>
              CINODE MEMBER APP / {activeTab.replace('_', ' ').toUpperCase()}
            </div>
            <h2 className="text-2xl font-display font-extrabold text-white mt-1 capitalize">
              {activeTab === 'overview' && 'Streaming Hub & Overview'}
              {activeTab === 'subscription' && 'Subscription & Payments'}
              {activeTab === 'direct_debit' && 'Direct Debit Auto-Renewal'}
              {activeTab === 'requests' && 'Movie & Series Requests'}
              {activeTab === 'affiliate' && 'Affiliate Program & Commissions'}
              {activeTab === 'apps' && 'Download Mobile & TV Apps'}
              {activeTab === 'support' && 'Support & Community Assistance'}
              {activeTab === 'account' && 'Account Credentials & Sync'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowHeaderNotifs(!showHeaderNotifs)}
                className="p-2.5 rounded-xl bg-[#120507] border border-[#2e1015] hover:border-[#d31d38]/50 text-zinc-300 hover:text-white transition cursor-pointer flex items-center justify-center relative shadow"
                title="View Announcements"
              >
                <Bell className="w-4 h-4 text-[#d31d38]" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-[#d31d38] text-[9px] font-extrabold text-white rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
              {showHeaderNotifs && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowHeaderNotifs(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-[#120507] border border-[#2e1015] rounded-2xl shadow-2xl z-50 overflow-hidden text-left py-2">
                    <div className="px-4 py-2.5 border-b border-[#2e1015] flex items-center justify-between bg-[#0a0304]">
                      <span className="font-extrabold text-xs text-white uppercase tracking-wider font-display">Notifications</span>
                      <span className="text-[10px] bg-[#d31d38]/15 text-[#ff4d64] px-2 py-0.5 rounded-full font-bold">{unreadCount} unread</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-[#2e1015]/60">
                      {notifications.map((notif, idx) => (
                        <button
                          key={notif.id}
                          type="button"
                          onClick={() => {
                            handleOpenNotification(notif);
                            setShowHeaderNotifs(false);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-[#1c080b] transition block"
                        >
                          <div className="text-[9px] text-[#ff4d64] font-extrabold uppercase">Notification {idx + 1}</div>
                          <div className="font-bold text-xs text-white truncate">{notif.title}</div>
                          <div className="text-[10px] text-zinc-400 truncate mt-0.5">{notif.message}</div>
                        </button>
                      ))}
                      {notifications.length === 0 && (
                        <div className="py-6 text-center text-xs text-zinc-500">No notifications</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={onReloadUser}
              className="bg-[#120507] hover:bg-[#1c080b] border border-[#2e1015] hover:border-[#d31d38]/50 text-zinc-300 text-xs font-bold py-2.5 px-4 rounded-xl transition flex items-center gap-2 cursor-pointer shadow"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#d31d38]" /> Refresh
            </button>
          </div>
        </div>

        {/* Global Notifications / Alerts */}
        {error && (
          <div className="p-4 bg-[#d31d38]/10 border border-[#d31d38]/25 text-[#ff8093] text-xs font-bold rounded-2xl flex justify-between items-center mb-6 shadow-lg">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-[#ff4d64] hover:text-white font-bold text-sm">×</button>
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-bold rounded-2xl flex justify-between items-center mb-6 shadow-lg">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-white font-bold text-sm">×</button>
          </div>
        )}

        {/* ================= TAB 1: OVERVIEW & STREAM ================= */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in duration-200">
""" + email_banner + """
""" + welcome_header + """
            
            {/* Quick Action Bento Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={() => setActiveTab('subscription')}
                className="bg-[#120507] hover:bg-[#1c080b] border border-[#2e1015] hover:border-[#d31d38]/50 p-4 rounded-2xl text-left transition cursor-pointer group shadow-lg"
              >
                <div className="w-8 h-8 rounded-xl bg-[#d31d38]/15 border border-[#d31d38]/30 flex items-center justify-center text-[#ff4d64] mb-3 group-hover:scale-110 transition">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div className="text-xs font-extrabold text-white">Renew / Pay</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">₦600 Unlimited Pass</div>
              </button>

              <button
                onClick={() => setActiveTab('direct_debit')}
                className="bg-[#120507] hover:bg-[#1c080b] border border-[#2e1015] hover:border-[#d31d38]/50 p-4 rounded-2xl text-left transition cursor-pointer group shadow-lg"
              >
                <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-3 group-hover:scale-110 transition">
                  <Landmark className="w-4 h-4" />
                </div>
                <div className="text-xs font-extrabold text-white">Direct Debit</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Auto-Renew Monthly</div>
              </button>

              <button
                onClick={() => setActiveTab('requests')}
                className="bg-[#120507] hover:bg-[#1c080b] border border-[#2e1015] hover:border-[#d31d38]/50 p-4 rounded-2xl text-left transition cursor-pointer group shadow-lg"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3 group-hover:scale-110 transition">
                  <Film className="w-4 h-4" />
                </div>
                <div className="text-xs font-extrabold text-white">Request Movie</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Add to Cinode Server</div>
              </button>

              <button
                onClick={() => setActiveTab('apps')}
                className="bg-[#120507] hover:bg-[#1c080b] border border-[#2e1015] hover:border-[#d31d38]/50 p-4 rounded-2xl text-left transition cursor-pointer group shadow-lg"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-110 transition">
                  <Download className="w-4 h-4" />
                </div>
                <div className="text-xs font-extrabold text-white">Mobile APK</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Android & TV Guide</div>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
""" + player_card + """
""" + side_to_mob + """
            </div>

            {/* Broadcast feed widget */}
""" + bc_feed + """
          </div>
        )}

        {/* ================= TAB 2: SUBSCRIPTION & PAY ================= */}
        {activeTab === 'subscription' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <div className="bg-[#120507] border border-[#2e1015] rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#d31d38] via-[#ff3b53] to-[#d31d38]"></div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-[#ff4d64] font-extrabold uppercase tracking-wider">Unlimited Streaming Pass</span>
                  <h3 className="text-xl font-display font-extrabold text-white mt-0.5">Subscription Plan Details</h3>
                  <p className="text-xs text-zinc-400 mt-1">Get 30 days unthrottled access to 4K streams, movies, series, and anime with zero ads.</p>
                </div>
                <div className="text-right sm:text-right">
                  <div className="text-2xl font-black font-display text-white">₦600 <span className="text-xs text-zinc-400 font-normal">/ 30 days</span></div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold border border-emerald-500/20">All-Inclusive Pass</span>
                </div>
              </div>
            </div>

""" + dynamic_cards + """
          </div>
        )}

        {/* ================= TAB 3: DIRECT DEBIT ================= */}
        {activeTab === 'direct_debit' && (
          <div className="space-y-8 animate-in fade-in duration-200">
""" + direct_debit_screen + """
          </div>
        )}

        {/* ================= TAB 4: MEDIA REQUESTS ================= */}
        {activeTab === 'requests' && (
          <div className="space-y-8 animate-in fade-in duration-200">
""" + media_reqs + """
          </div>
        )}

        {/* ================= TAB 5: AFFILIATE & EARNINGS ================= */}
        {activeTab === 'affiliate' && (
          <div className="space-y-8 animate-in fade-in duration-200">
""" + aff_sec + """
          </div>
        )}

        {/* ================= TAB 6: MOBILE & TV APPS ================= */}
        {activeTab === 'apps' && (
          <div className="space-y-8 animate-in fade-in duration-200">
""" + mob_app_sec + """
          </div>
        )}

        {/* ================= TAB 7: SUPPORT & HELP ================= */}
        {activeTab === 'support' && (
          <div className="space-y-8 animate-in fade-in duration-200">
""" + sup_sec + """
          </div>
        )}

        {/* ================= TAB 8: ACCOUNT & SECURITY ================= */}
        {activeTab === 'account' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <div className="bg-[#120507] border border-[#2e1015] rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#d31d38] via-[#ff3b53] to-[#d31d38]"></div>
              <h3 className="text-xl font-display font-extrabold text-white mb-1">Subscriber Account Profile</h3>
              <p className="text-xs text-zinc-400 mb-6">Manage your streaming credentials, email verification, and session sync.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-[#180608] border border-[#2e1015] p-4 rounded-xl">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase">Full Name</div>
                  <div className="text-sm font-bold text-white mt-1">{user.fullName}</div>
                </div>
                <div className="bg-[#180608] border border-[#2e1015] p-4 rounded-xl">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase">Username</div>
                  <div className="text-sm font-bold text-white mt-1">@{user.username}</div>
                </div>
                <div className="bg-[#180608] border border-[#2e1015] p-4 rounded-xl">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase">Registered Email</div>
                  <div className="text-sm font-bold text-white mt-1">{user.email || 'None'}</div>
                </div>
                <div className="bg-[#180608] border border-[#2e1015] p-4 rounded-xl">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase">Account Status</div>
                  <div className="text-sm font-bold text-emerald-400 mt-1">{user.accountStatus || 'Active'}</div>
                </div>
              </div>

              <div className="pt-6 border-t border-[#2e1015] flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setShowSyncModal(true)}
                  className="bg-[#180608] hover:bg-[#220a0e] text-white border border-[#2e1015] hover:border-[#d31d38]/50 text-xs font-bold py-2.5 px-4 rounded-xl transition flex items-center gap-2 cursor-pointer shadow"
                >
                  <Key className="w-4 h-4 text-[#d31d38]" /> Re-Sync Session Password
                </button>
                <button
                  onClick={() => setShowDeviceModal(true)}
                  className="bg-[#180608] hover:bg-[#220a0e] text-white border border-[#2e1015] hover:border-[#d31d38]/50 text-xs font-bold py-2.5 px-4 rounded-xl transition flex items-center gap-2 cursor-pointer shadow"
                >
                  <Smartphone className="w-4 h-4 text-emerald-400" /> Device Setup Guide
                </button>
                <button
                  onClick={onLogout}
                  className="bg-rose-600/15 hover:bg-rose-600/25 text-rose-300 border border-rose-500/30 text-xs font-bold py-2.5 px-4 rounded-xl transition flex items-center gap-2 cursor-pointer ml-auto"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#120507]/95 backdrop-blur-lg border-t border-[#2e1015] p-2 flex justify-around items-center z-40">
        {[
          { id: 'overview', label: 'Home', icon: Tv },
          { id: 'subscription', label: 'Pay', icon: CreditCard },
          { id: 'direct_debit', label: 'Debit', icon: Landmark },
          { id: 'requests', label: 'Request', icon: Film },
          { id: 'affiliate', label: 'Earn', icon: Gift },
          { id: 'account', label: 'More', icon: Settings },
        ].map((item) => {
          const Icon = item.icon;
          const isSelected = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition cursor-pointer min-w-12 ${
                isSelected ? 'text-[#ff4d64]' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <div className={`p-1 rounded-lg ${isSelected ? 'bg-[#d31d38]/20 border border-[#d31d38]/30 shadow-[0_0_10px_rgba(211,29,56,0.3)]' : ''}`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <span className="text-[9px] font-bold mt-0.5 tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ALL MODALS PRESERVED INTACT */}
""" + modals_clean + """
    </div>
  );
}
"""

with open('src/components/UserPortal.tsx', 'w') as f:
    f.write(new_full_portal)

print("Assembly complete!")
