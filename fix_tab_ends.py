with open('src/components/UserPortal.tsx', 'r') as f:
    text = f.read()

# 1. Fix subscription tab end
old_sub_end = """        ) : (
          /* Active Streaming Player Controls */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          </div>
        )}
        {/* ================= TAB 3: DIRECT DEBIT ================= */}"""

new_sub_end = """        ) : (
          /* Active Streaming Player Controls */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          </div>
        )}
          </div>
        )}

        {/* ================= TAB 3: DIRECT DEBIT ================= */}"""

text = text.replace(old_sub_end, new_sub_end)

# 2. Fix requests tab end
old_req_end = """            </div>
          </div>

        </div>
          </div>
        )}

        {/* ================= TAB 5: AFFILIATE & EARNINGS ================= */}"""

new_req_end = """            </div>
          </div>
          </div>
        )}

        {/* ================= TAB 5: AFFILIATE & EARNINGS ================= */}"""

text = text.replace(old_req_end, new_req_end)

# 3. Fix support tab end
old_sup_end = """            {bankInfo.contactOther && (
              <div className="mt-4 text-[10px] text-zinc-400 font-medium bg-[#080203] py-2 px-3 rounded-lg border border-[#2e1015]">
                <strong>Notice:</strong> {bankInfo.contactOther}
              </div>
            )}
          </div>
        )}
        {/* ================= TAB 8: ACCOUNT & SECURITY ================= */}"""

new_sup_end = """            {bankInfo.contactOther && (
              <div className="mt-4 text-[10px] text-zinc-400 font-medium bg-[#080203] py-2 px-3 rounded-lg border border-[#2e1015]">
                <strong>Notice:</strong> {bankInfo.contactOther}
              </div>
            )}
          </div>
        )}
          </div>
        )}

        {/* ================= TAB 8: ACCOUNT & SECURITY ================= */}"""

text = text.replace(old_sup_end, new_sup_end)

with open('src/components/UserPortal.tsx', 'w') as f:
    f.write(text)

print("Fixed tab endings!")
