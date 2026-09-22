import re

with open('src/components/UserPortal.tsx', 'r') as f:
    text = f.read()

# Replace imports to include Menu, Film, Compass, ChevronRight, Settings, Sparkles
old_import = "import {\n  Tv, LogOut, CheckCircle, AlertTriangle, Play, ShieldAlert, CreditCard,\n  Loader2, RefreshCw, Key, HelpCircle, ArrowLeft, ExternalLink, X, Info, UserCheck, Calendar,\n  Users, DollarSign, Gift, Clock, Share2, Copy, Check, Percent, MessageSquare, PlusCircle, Bell,\n  Smartphone, Download, Building2, Landmark, ShieldCheck\n} from 'lucide-react';"
new_import = """import { 
  Tv, LogOut, CheckCircle, AlertTriangle, Play, ShieldAlert, CreditCard, 
  Loader2, RefreshCw, Key, HelpCircle, ArrowLeft, ExternalLink, X, Info, UserCheck, Calendar,
  Users, DollarSign, Gift, Clock, Share2, Copy, Check, Percent, MessageSquare, PlusCircle, Bell,
  Smartphone, Download, Building2, Landmark, ShieldCheck, Menu, Film, Compass, ChevronRight, Settings, Sparkles
} from 'lucide-react';"""

if old_import in text:
    text = text.replace(old_import, new_import)
else:
    # generic regex replace
    text = re.sub(r"import\s*\{[^}]*\}\s*from\s*'lucide-react';", new_import, text, count=1)

# Add activeTab and mobileSidebarOpen state
state_insertion_point = "const [affiliateStats, setAffiliateStats] = useState<any | null>(null);"
new_states = """  // Native Mobile App Screen Tab Navigation State
  const [activeTab, setActiveTab] = useState<'overview' | 'subscription' | 'direct_debit' | 'requests' | 'affiliate' | 'apps' | 'support' | 'account'>('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [affiliateStats, setAffiliateStats] = useState<any | null>(null);"""

text = text.replace(state_insertion_point, new_states, 1)

print("Import and states updated.")
with open('src/components/UserPortal.tsx', 'w') as f:
    f.write(text)
