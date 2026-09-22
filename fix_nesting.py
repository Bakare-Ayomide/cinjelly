with open('src/components/UserPortal.tsx', 'r') as f:
    text = f.read()

# Let's clean up duplicate affiliate tabs and stray closing tags
# 1. Look for duplicate affiliate tab
aff_dup = """        {/* ================= TAB 5: AFFILIATE & EARNINGS ================= */}
        {activeTab === 'affiliate' && (
          <div className="space-y-8 animate-in fade-in duration-200">
          </div>
        )}"""

text = text.replace(aff_dup, "")

# 2. Look for the broken support / tab 8 area
broken_support_area = text[text.find('{/* ================= TAB 7: SUPPORT & HELP ================= */}'):text.find('{/* ================= TAB 8: ACCOUNT & SECURITY ================= */}')]

print("BROKEN SUPPORT AREA:\n", broken_support_area[-300:])

# Let's cleanly replace the end of support tab
fixed_support_area = broken_support_area
# remove any </main> or extra closings in it
for bad in ['</main>', '          </div>\n        )}\n          </div>\n        )}', '          </div>\n        )}\n        </div>\n        )}']:
    fixed_support_area = fixed_support_area.replace(bad, '')

# Ensure it ends with single </div>\n        )}
fixed_support_area = fixed_support_area.strip()
if not fixed_support_area.endswith('</div>\n        )}'):
    if fixed_support_area.endswith('</div>'):
        fixed_support_area += '\n        )}'
    elif fixed_support_area.endswith(')}'):
        # ends with inner condition close
        fixed_support_area += '\n          </div>\n        )}'

text = text[:text.find('{/* ================= TAB 7: SUPPORT & HELP ================= */}')] + fixed_support_area + '\n\n' + text[text.find('{/* ================= TAB 8: ACCOUNT & SECURITY ================= */}'):]

# 3. Look for the end of TAB 8 and main
tab8_start = text.find('{/* ================= TAB 8: ACCOUNT & SECURITY ================= */}')
modal_start = text.find('{/* ALL MODALS PRESERVED INTACT */}')

tab8_part = text[tab8_start:modal_start]
print("TAB 8 PART:\n", tab8_part[-300:])

# Tab 8 should be:
tab8_clean = """        {/* ================= TAB 8: ACCOUNT & SECURITY ================= */}
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
"""

text = text[:tab8_start] + tab8_clean + '\n\n      ' + text[modal_start:]

with open('src/components/UserPortal.tsx', 'w') as f:
    f.write(text)

print("Updated nesting!")
