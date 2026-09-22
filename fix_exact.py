with open('src/components/UserPortal.tsx', 'r') as f:
    text = f.read()

sub_target = '        /* Active Streaming Player Controls */\n          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">\n          </div>\n        )}'
sub_replacement = '        /* Active Streaming Player Controls */\n          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">\n          </div>\n        )}\n          </div>\n        )}'

assert sub_target in text, "sub_target not in text"
text = text.replace(sub_target, sub_replacement, 1)

sup_target = '            {bankInfo.contactOther && (\n              <div className="mt-4 text-[10px] text-zinc-400 font-medium bg-[#080203] py-2 px-3 rounded-lg border border-[#2e1015]">\n                <strong>Notice:</strong> {bankInfo.contactOther}\n              </div>\n            )}\n          </div>\n        )}'
sup_replacement = '            {bankInfo.contactOther && (\n              <div className="mt-4 text-[10px] text-zinc-400 font-medium bg-[#080203] py-2 px-3 rounded-lg border border-[#2e1015]">\n                <strong>Notice:</strong> {bankInfo.contactOther}\n              </div>\n            )}\n          </div>\n        )}\n          </div>\n        )}'

assert sup_target in text, "sup_target not in text"
text = text.replace(sup_target, sup_replacement, 1)

with open('src/components/UserPortal.tsx', 'w') as f:
    f.write(text)

print("Exact replacements applied!")
