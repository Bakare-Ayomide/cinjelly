with open('src/components/UserPortal.tsx', 'r') as f:
    text = f.read()

# Let's find each section's exact start and end
return_start = text.find('  return (\n    <div className="min-h-screen')

pre_return = text[:return_start]

# Finding sections
def find_section(start_marker, end_marker):
    s = text.find(start_marker)
    if s == -1:
        raise Exception(f"Start marker {start_marker} not found")
    if end_marker:
        e = text.find(end_marker, s)
        if e == -1:
            raise Exception(f"End marker {end_marker} not found")
        return text[s:e], s, e
    else:
        return text[s:], s, len(text)

email_banner, _, _ = find_section('{/* Email Verification Banner */}', '{/* Welcome Header */}')
welcome_header, _, _ = find_section('{/* Welcome Header */}', '{/* Dynamic Card Area */}')
dynamic_cards, _, _ = find_section('{/* Dynamic Card Area */}', '{/* Player Launch Card */}')
player_card, _, _ = find_section('{/* Player Launch Card */}', '{/* Side Membership Details Card */}')
membership_card, _, _ = find_section('{/* Side Membership Details Card */}', '{/* Direct Debit Status Widget */}')
direct_debit_widget, _, _ = find_section('{/* Direct Debit Status Widget */}', '{/* Mobile App Download Advertisement Banner */}')
mobile_app_banner, _, _ = find_section('{/* Mobile App Download Advertisement Banner */}', '{/* Community Announcements Feed & Media Requests Section */}')

# Broadcast feed vs Media requests
broadcast_feed, _, _ = find_section('{/* Targeted Broadcast Notifications Feed */}', '{/* User Movie/Show Request Console */}')
media_requests_sec, _, _ = find_section('{/* User Movie/Show Request Console */}', '{/* Affiliate Referral Program Section */}')

affiliate_sec, _, _ = find_section('{/* Affiliate Referral Program Section */}', '{/* Support & Contact Details Section */}')
support_sec, _, _ = find_section('{/* Support & Contact Details Section */}', '{/* RE-SYNC SESSION CREDENTIALS MODAL */}')

modals_sec = text[text.find('{/* RE-SYNC SESSION CREDENTIALS MODAL */}'):]
# trim trailing closing tags for root div and component
modals_sec_clean = modals_sec[:modals_sec.rfind('</div>')] # trim root div closing

print("All sections sliced cleanly!")
