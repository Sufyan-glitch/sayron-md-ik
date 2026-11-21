import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart2,
  Moon,
  Sun,
  MoreVertical,
  Layers,
  ChevronDown,
  MessageSquare,
  Zap,
  ArrowRight,
  Lock,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Activity,
  Bot,
  Terminal,
  X,
  Search,
  Wifi,
  Sparkles,
  Smartphone,
  Globe,
  Radio,
  Clock,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Music,
  Disc3,
  Volume2,
  Info,
  UserPlus,
  ChevronsRight,
  Shield,
  MoreHorizontal,
} from 'lucide-react';
import {
  WhatsAppConnectionState,
  LogEntry,
  SessionSummary,
  ServerNodeSummary,
} from './types.ts';
import { AdminLogin } from './components/AdminLogin.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { SX3DLogo } from './components/SX3DLogo.tsx';
import { CyberMusicPlayer } from './components/CyberMusicPlayer.tsx';

interface SimpleBotState {
  aiMode: boolean;
  whatsapp: WhatsAppConnectionState;
  activeBotsCount?: number;
  totalUsersCount?: number;
  sessions?: SessionSummary[];
  servers?: ServerNodeSummary[];
  logs: LogEntry[];
  channelJid?: string;
  channelInviteCode?: string;
  menuImage?: string;
}

interface CountryOption {
  code: string;
  name: string;
  flag: string;
  format: string;
}

const COUNTRIES: CountryOption[] = [
  { code: '92', name: 'Pakistan', flag: '🇵🇰', format: '345 1234567' },
  { code: '91', name: 'India', flag: '🇮🇳', format: '98765 43210' },
  { code: '1', name: 'USA / Canada', flag: '🇺🇸', format: '202 555 0123' },
  { code: '44', name: 'United Kingdom', flag: '🇬🇧', format: '7911 123456' },
  { code: '971', name: 'United Arab Emirates', flag: '🇦🇪', format: '50 123 4567' },
  { code: '966', name: 'Saudi Arabia', flag: '🇸🇦', format: '50 123 4567' },
  { code: '880', name: 'Bangladesh', flag: '🇧🇩', format: '1712 345678' },
  { code: '62', name: 'Indonesia', flag: '🇮🇩', format: '812 3456 7890' },
  { code: '234', name: 'Nigeria', flag: '🇳🇬', format: '802 123 4567' },
  { code: '90', name: 'Turkey', flag: '🇹🇷', format: '532 123 4567' },
  { code: '20', name: 'Egypt', flag: '🇪🇬', format: '10 1234 5678' },
  { code: '968', name: 'Oman', flag: '🇴🇲', format: '9123 4567' },
  { code: '974', name: 'Qatar', flag: '🇶🇦', format: '3312 3456' },
  { code: '965', name: 'Kuwait', flag: '🇰🇼', format: '9123 4567' },
  { code: '60', name: 'Malaysia', flag: '🇲🇾', format: '12 345 6789' },
  { code: '49', name: 'Germany', flag: '🇩🇪', format: '151 1234567' },
  { code: '33', name: 'France', flag: '🇫🇷', format: '6 12 34 56 78' },
  { code: '55', name: 'Brazil', flag: '🇧🇷', format: '11 91234 5678' },
];

interface ServerOption {
  id: string;
  name: string;
  region: string;
  ping: string;
  load: string;
  status: 'online' | 'busy';
}

const SERVER_OPTIONS: ServerOption[] = [
  { id: 'srv-1', name: 'Server 01 • PK-Turbo (Islamabad)', region: 'Pakistan (Islamabad)', ping: '18ms', load: '14%', status: 'online' },
  { id: 'srv-2', name: 'Server 02 • PK-Karachi', region: 'Pakistan (Karachi)', ping: '21ms', load: '18%', status: 'online' },
  { id: 'srv-3', name: 'Server 03 • PK-Lahore', region: 'Pakistan (Lahore)', ping: '19ms', load: '16%', status: 'online' },
  { id: 'srv-4', name: 'Server 04 • SG-Ultra', region: 'Singapore Core-1', ping: '32ms', load: '24%', status: 'online' },
  { id: 'srv-5', name: 'Server 05 • SG-Marina', region: 'Singapore Core-2', ping: '34ms', load: '26%', status: 'online' },
  { id: 'srv-6', name: 'Server 06 • UAE-Gulf', region: 'UAE (Dubai Edge)', ping: '26ms', load: '20%', status: 'online' },
  { id: 'srv-7', name: 'Server 07 • EU-Central', region: 'Germany (Frankfurt)', ping: '42ms', load: '28%', status: 'online' },
  { id: 'srv-8', name: 'Server 08 • UK-London', region: 'United Kingdom', ping: '45ms', load: '22%', status: 'online' },
  { id: 'srv-9', name: 'Server 09 • US-East', region: 'US East (Virginia)', ping: '54ms', load: '30%', status: 'online' },
  { id: 'srv-10', name: 'Server 10 • Global-VIP', region: 'Global Anycast VIP', ping: '15ms', load: '12%', status: 'online' },
];

function getOrCreateOwnerToken(): string {
  try {
    const saved = localStorage.getItem('xik_owner_token');
    if (saved && saved.startsWith('owner_')) return saved;
    const fresh = `owner_${Math.random().toString(36).slice(2, 12)}_${Date.now().toString(36)}`;
    localStorage.setItem('xik_owner_token', fresh);
    return fresh;
  } catch {
    return `owner_${Math.random().toString(36).slice(2, 12)}_${Date.now().toString(36)}`;
  }
}

function getOrCreateClientId(): string {
  try {
    const saved = localStorage.getItem('xik_client_id');
    if (saved && saved.startsWith('client_')) return saved;
    const fresh = `client_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    localStorage.setItem('xik_client_id', fresh);
    return fresh;
  } catch {
    return `client_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  }
}

// Subtle Web Audio synthesizer for futuristic cyber clicks
function playCyberTone(type: 'click' | 'success' | 'beep' | 'toggle', soundEnabled: boolean) {
  if (!soundEnabled) return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'click') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(640, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.05);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.setValueAtTime(780, now + 0.08);
      osc.frequency.setValueAtTime(1040, now + 0.16);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.28);
    } else if (type === 'beep') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'toggle') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(560, now + 0.09);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.start(now);
      osc.stop(now + 0.09);
    }
  } catch {
    // ignore audio context restrictions
  }
}

export type CyberThemeKey = 'cyan' | 'amethyst' | 'crimson' | 'emerald' | 'sunset';

export interface ThemeConfig {
  key: CyberThemeKey;
  name: string;
  urduName: string;
  badge: string;
  accent: string;
  accentRgb: string;
  laserGradient: string;
  cardBorder: string;
  cardGlow: string;
  buttonGradient: string;
  buttonHover: string;
  stepperActive: string;
  pulseOrb: string;
  iconColor: string;
  bgGlow: string;
}

export const CYBER_THEMES: Record<CyberThemeKey, ThemeConfig> = {
  cyan: {
    key: 'cyan',
    name: 'Cyber Neon Cyan',
    urduName: 'سائبر نیون بلو',
    badge: 'CYBER CYAN',
    accent: '#00f0ff',
    accentRgb: '0, 240, 255',
    laserGradient: 'from-cyan-400 via-blue-500 to-purple-600',
    cardBorder: 'border-cyan-500/40',
    cardGlow: 'shadow-[0_0_35px_rgba(0,240,255,0.25)]',
    buttonGradient: 'from-cyan-500 via-blue-600 to-indigo-600',
    buttonHover: 'hover:shadow-[0_0_28px_rgba(0,240,255,0.6)]',
    stepperActive: 'border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.5)]',
    pulseOrb: 'bg-cyan-500/20',
    iconColor: 'text-cyan-400',
    bgGlow: 'from-blue-600/20 via-cyan-500/15 to-transparent',
  },
  amethyst: {
    key: 'amethyst',
    name: 'Royal Purple & Amethyst',
    urduName: 'رائل پرپل',
    badge: 'ROYAL PURPLE',
    accent: '#c084fc',
    accentRgb: '192, 132, 252',
    laserGradient: 'from-purple-400 via-fuchsia-500 to-indigo-600',
    cardBorder: 'border-purple-500/40',
    cardGlow: 'shadow-[0_0_35px_rgba(192,132,252,0.25)]',
    buttonGradient: 'from-purple-500 via-fuchsia-600 to-pink-600',
    buttonHover: 'hover:shadow-[0_0_28px_rgba(192,132,252,0.6)]',
    stepperActive: 'border-purple-400 text-purple-300 shadow-[0_0_12px_rgba(192,132,252,0.5)]',
    pulseOrb: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
    bgGlow: 'from-purple-600/20 via-fuchsia-500/15 to-transparent',
  },
  crimson: {
    key: 'crimson',
    name: 'Crimson Eclipse & Ruby',
    urduName: 'کرمسن ریڈ',
    badge: 'CRIMSON ECLIPSE',
    accent: '#ef1d34',
    accentRgb: '239, 29, 52',
    laserGradient: 'from-red-600 via-rose-500 to-red-700',
    cardBorder: 'border-red-500/50',
    cardGlow: 'shadow-[0_0_35px_rgba(239,29,52,0.35)]',
    buttonGradient: 'from-[#1a0408] via-[#5c0814] to-[#1a0408]',
    buttonHover: 'hover:shadow-[0_0_28px_rgba(239,29,52,0.85)]',
    stepperActive: 'border-red-500 text-red-400 shadow-[0_0_12px_rgba(239,29,52,0.65)]',
    pulseOrb: 'bg-red-500/20',
    iconColor: 'text-red-500',
    bgGlow: 'from-red-600/35 via-rose-500/20 to-transparent',
  },
  emerald: {
    key: 'emerald',
    name: 'Matrix Emerald & Jade',
    urduName: 'میٹرکس گرین',
    badge: 'MATRIX EMERALD',
    accent: '#10b981',
    accentRgb: '16, 185, 129',
    laserGradient: 'from-emerald-400 via-teal-500 to-green-600',
    cardBorder: 'border-emerald-500/40',
    cardGlow: 'shadow-[0_0_35px_rgba(16,185,129,0.25)]',
    buttonGradient: 'from-emerald-500 via-teal-600 to-cyan-600',
    buttonHover: 'hover:shadow-[0_0_28px_rgba(16,185,129,0.6)]',
    stepperActive: 'border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.5)]',
    pulseOrb: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    bgGlow: 'from-emerald-600/20 via-teal-500/15 to-transparent',
  },
  sunset: {
    key: 'sunset',
    name: 'Synthwave Sunset & Amber',
    urduName: 'سنتھ ویو سن سیٹ',
    badge: 'SYNTHWAVE SUNSET',
    accent: '#f59e0b',
    accentRgb: '245, 158, 11',
    laserGradient: 'from-amber-400 via-orange-500 to-pink-600',
    cardBorder: 'border-amber-500/40',
    cardGlow: 'shadow-[0_0_35px_rgba(245,158,11,0.25)]',
    buttonGradient: 'from-amber-500 via-orange-600 to-pink-600',
    buttonHover: 'hover:shadow-[0_0_28px_rgba(245,158,11,0.6)]',
    stepperActive: 'border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)]',
    pulseOrb: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
    bgGlow: 'from-amber-600/20 via-pink-500/15 to-transparent',
  },
};

const THEME_KEYS: CyberThemeKey[] = ['crimson', 'cyan', 'amethyst', 'emerald', 'sunset'];

function SilverRubyCrownSvg({ className = 'w-8 h-8', accent = '#ef1d34' }: { className?: string; accent?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="crownSilver" x1="0" y1="0" x2="64" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
      </defs>
      <path
        d="M8 36L4 14L19 25L32 7L45 25L60 14L56 36H8Z"
        fill="url(#crownSilver)"
        stroke="#e2e8f0"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect x="9" y="38" width="46" height="5" rx="2" fill="url(#crownSilver)" stroke="#94a3b8" strokeWidth="1" />
      <circle cx="4" cy="12" r="2.8" fill="#e2e8f0" />
      <circle cx="32" cy="5.5" r="3.2" fill="#ffffff" />
      <circle cx="60" cy="12" r="2.8" fill="#e2e8f0" />
      <polygon points="32,19 37,26 32,33 27,26" fill={accent} stroke="#fecaca" strokeWidth="0.8" />
      <circle cx="19" cy="29" r="2.6" fill={accent} />
      <circle cx="45" cy="29" r="2.6" fill={accent} />
    </svg>
  );
}

function ServerStackSvg({ className = 'w-11 h-11', accent = '#ef1d34' }: { className?: string; accent?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="6" width="40" height="10" rx="2" fill="#18080c" stroke={accent} strokeWidth="1.2" />
      <rect x="4" y="19" width="40" height="10" rx="2" fill="#18080c" stroke={accent} strokeWidth="1.2" />
      <rect x="4" y="32" width="40" height="10" rx="2" fill="#18080c" stroke={accent} strokeWidth="1.2" />
      <circle cx="10" cy="11" r="1.8" fill={accent} />
      <circle cx="16" cy="11" r="1.8" fill="#fb7185" />
      <rect x="24" y="10" width="14" height="2" rx="1" fill="#475569" />
      <circle cx="10" cy="24" r="1.8" fill={accent} />
      <circle cx="16" cy="24" r="1.8" fill="#fb7185" />
      <rect x="24" y="23" width="14" height="2" rx="1" fill="#475569" />
      <circle cx="10" cy="37" r="1.8" fill="#22c55e" />
      <circle cx="16" cy="37" r="1.8" fill={accent} />
      <rect x="24" y="36" width="14" height="2" rx="1" fill="#475569" />
    </svg>
  );
}

function WhatsAppLogoSvg({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="20" fill="#25D366" stroke="#ffffff" strokeWidth="2.5" />
      <path d="M10 38L12.8 30.2C11.1 27.6 10.2 24.5 10.2 21.3C10.2 13.7 16.4 7.5 24 7.5C31.6 7.5 37.8 13.7 37.8 21.3C37.8 28.9 31.6 35.1 24 35.1C21.3 35.1 18.7 34.3 16.5 32.9L10 38Z" fill="#25D366" stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />
      <path
        d="M19.2 16.5C18.9 15.8 18.5 15.8 18.2 15.8H17.3C17 15.8 16.5 15.9 16.1 16.4C15.7 16.8 14.5 17.9 14.5 20.1C14.5 22.3 16.1 24.4 16.3 24.7C16.5 25 19.4 29.6 23.9 31.4C27.6 32.9 28.4 32.6 29.2 32.5C30 32.4 31.7 31.5 32.1 30.5C32.4 29.5 32.4 28.7 32.3 28.5C32.2 28.3 31.9 28.2 31.4 28C30.9 27.7 28.7 26.7 28.3 26.5C27.9 26.4 27.6 26.3 27.3 26.8C27 27.2 26.2 28.2 25.9 28.5C25.7 28.8 25.4 28.8 24.9 28.6C24.4 28.3 22.9 27.9 21.1 26.3C19.7 25 18.8 23.5 18.5 23C18.2 22.5 18.5 22.3 18.7 22C18.9 21.8 19.2 21.4 19.4 21.1C19.6 20.8 19.7 20.6 19.8 20.3C19.9 20 19.9 19.8 19.7 19.5C19.6 19.3 18.7 17.1 19.2 16.5Z"
        fill="#ffffff"
      />
    </svg>
  );
}

export default function App() {
  const [ownerToken] = useState<string>(() => getOrCreateOwnerToken());
  const [clientId] = useState<string>(() => getOrCreateClientId());
  const [state, setState] = useState<SimpleBotState | null>(null);

  // Input & Selection State
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(COUNTRIES[0]);
  const [phoneDigits, setPhoneDigits] = useState<string>('');
  const [selectedServer, setSelectedServer] = useState<ServerOption>(SERVER_OPTIONS[0]);

  // UI Interactive Modals / Dropdowns
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [menuDropdownOpen, setMenuDropdownOpen] = useState(false);
  const [commandsModalOpen, setCommandsModalOpen] = useState(false);
  const [musicModalOpen, setMusicModalOpen] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  // Pairing Progress & Code State
  const [loading, setLoading] = useState(false);
  const [pairingCode, setPairingCode] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [codeCountdown, setCodeCountdown] = useState<number>(60);

  // Sound and Dynamic Cyber Theme Engine (5 Themes, defaulting to Crimson Ruby matching reference)
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeThemeKey, setActiveThemeKey] = useState<CyberThemeKey>(() => {
    try {
      const saved = localStorage.getItem('sayron_cyber_theme') as CyberThemeKey;
      if (saved && CYBER_THEMES[saved]) return saved;
      return 'crimson';
    } catch {
      return 'crimson';
    }
  });
  const [themeToast, setThemeToast] = useState<{ title: string; subtitle: string; accent: string } | null>(null);

  const currentTheme = CYBER_THEMES[activeThemeKey] || CYBER_THEMES.cyan;

  const cycleTheme = () => {
    playCyberTone('toggle', soundEnabled);
    const nextIdx = (THEME_KEYS.indexOf(activeThemeKey) + 1) % THEME_KEYS.length;
    const nextKey = THEME_KEYS[nextIdx];
    const newTheme = CYBER_THEMES[nextKey];
    setActiveThemeKey(nextKey);
    try {
      localStorage.setItem('sayron_cyber_theme', nextKey);
    } catch {}
    setThemeToast({
      title: newTheme.badge,
      subtitle: newTheme.name,
      accent: newTheme.accent,
    });
    setTimeout(() => setThemeToast(null), 2500);
  };

  // SUFYAN-X-IK 3D Admin Control Center Route State
  const [adminRouteActive, setAdminRouteActive] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.location.pathname.toLowerCase().startsWith('/sufyan-control') ||
      window.location.search.includes('admin=1')
    );
  });

  const [adminToken, setAdminToken] = useState<string>(() => {
    try {
      return localStorage.getItem('xik_admin_token') || '';
    } catch {
      return '';
    }
  });

  // URL listener for /sufyan-control routing
  useEffect(() => {
    const handleLocationChange = () => {
      const isControl =
        window.location.pathname.toLowerCase().startsWith('/sufyan-control') ||
        window.location.search.includes('admin=1');
      setAdminRouteActive(isControl);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Validate admin token on mount
  useEffect(() => {
    if (!adminToken) return;
    fetch('/api/admin/me', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
      .then((res) => {
        if (!res.ok) {
          setAdminToken('');
          try {
            localStorage.removeItem('xik_admin_token');
          } catch {}
        }
      })
      .catch(() => {});
  }, [adminToken]);

  const navigateToAdmin = () => {
    playCyberTone('click', soundEnabled);
    try {
      window.history.pushState({}, '', '/sufyan-control');
    } catch {}
    setAdminRouteActive(true);
    setMenuDropdownOpen(false);
  };

  const navigateToMain = () => {
    playCyberTone('click', soundEnabled);
    try {
      window.history.pushState({}, '', '/');
    } catch {}
    setAdminRouteActive(false);
  };

  const handleAdminLogout = async () => {
    playCyberTone('click', soundEnabled);
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    } catch {}
    setAdminToken('');
    try {
      localStorage.removeItem('xik_admin_token');
    } catch {}
  };

  const loadingRef = useRef(false);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // Poll backend state for pairing updates
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/state?clientId=${encodeURIComponent(clientId)}&ownerToken=${encodeURIComponent(
          ownerToken
        )}`
      );
      if (!res.ok) return;
      const data: SimpleBotState = await res.json();
      setState(data);

      if (!loadingRef.current) {
        if (data.whatsapp?.status === 'connected') {
          setPairingCode('');
          setQrDataUrl('');
          setErrorMessage(null);
        } else if (data.whatsapp?.pairingCode && data.whatsapp.status === 'pairing_code_ready') {
          setPairingCode(data.whatsapp.pairingCode);
          setQrDataUrl('');
          setLoading(false);
        } else if (data.whatsapp?.qrDataUrl && data.whatsapp.status === 'qr_ready') {
          setQrDataUrl(data.whatsapp.qrDataUrl);
          setPairingCode('');
          setLoading(false);
        } else if (data.whatsapp?.status === 'disconnected') {
          setPairingCode('');
          setQrDataUrl('');
          if (data.whatsapp?.errorMessage) {
            setErrorMessage(data.whatsapp.errorMessage);
          }
        }
      }
    } catch {
      // ignore
    }
  }, [clientId, ownerToken]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 2500);
    return () => clearInterval(interval);
  }, [fetchState]);

  // Code countdown timer (WhatsApp pairing codes remain valid ~120s)
  useEffect(() => {
    if (!pairingCode) return;
    setCodeCountdown(120);
    const t = setInterval(() => {
      setCodeCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(t);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [pairingCode]);

  // Request Pairing Code from Baileys Engine
  const handleGeneratePairingCode = async () => {
    setErrorMessage(null);
    playCyberTone('click', soundEnabled);

    const cleanInput = phoneDigits.replace(/[^0-9]/g, '').replace(/^0+/, '');
    if (cleanInput.length < 7) {
      setErrorMessage('Please enter a valid WhatsApp phone number with country code.');
      playCyberTone('beep', soundEnabled);
      return;
    }

    // Normalize country code cleanly (strip accidental leading 0 after country code e.g. 920300...)
    let fullPhoneNumber = cleanInput;
    const hasCountryPrefix =
      cleanInput.startsWith(selectedCountry.code) &&
      cleanInput.length >= selectedCountry.code.length + 9;
    if (hasCountryPrefix) {
      const rest = cleanInput.slice(selectedCountry.code.length).replace(/^0+/, '');
      fullPhoneNumber = `${selectedCountry.code}${rest}`;
    } else if (cleanInput.length <= 10) {
      fullPhoneNumber = `${selectedCountry.code}${cleanInput}`;
    }

    setLoading(true);
    setPairingCode('');
    setQrDataUrl('');

    try {
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: fullPhoneNumber,
          clientId,
          ownerToken,
          serverId: selectedServer.id === 'auto' ? undefined : selectedServer.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMessage(data.error || 'Failed to request pairing code. Please retry.');
        setLoading(false);
        playCyberTone('beep', soundEnabled);
        return;
      }

      if (data.whatsapp?.errorMessage && !data.whatsapp?.pairingCode) {
        setErrorMessage(data.whatsapp.errorMessage);
        setLoading(false);
        playCyberTone('beep', soundEnabled);
        return;
      }

      if (data.whatsapp?.status === 'connected') {
        setPairingCode('');
        setQrDataUrl('');
        setLoading(false);
        playCyberTone('success', soundEnabled);
        return;
      }

      if (data.whatsapp?.pairingCode) {
        setPairingCode(data.whatsapp.pairingCode);
        playCyberTone('success', soundEnabled);
        setLoading(false);
      } else {
        // Polling will catch it shortly
        let attempts = 0;
        const checkInterval = setInterval(async () => {
          attempts += 1;
          try {
            const checkRes = await fetch(
              `/api/state?clientId=${encodeURIComponent(clientId)}&ownerToken=${encodeURIComponent(
                ownerToken
              )}`
            );
            const checkData = await checkRes.json();
            if (checkData.whatsapp?.pairingCode) {
              setPairingCode(checkData.whatsapp.pairingCode);
              setLoading(false);
              playCyberTone('success', soundEnabled);
              clearInterval(checkInterval);
            } else if (checkData.whatsapp?.status === 'connected') {
              setPairingCode('');
              setQrDataUrl('');
              setLoading(false);
              playCyberTone('success', soundEnabled);
              clearInterval(checkInterval);
            } else if (checkData.whatsapp?.errorMessage) {
              setErrorMessage(checkData.whatsapp.errorMessage);
              setLoading(false);
              playCyberTone('beep', soundEnabled);
              clearInterval(checkInterval);
            }
          } catch {}
          if (attempts >= 15) {
            clearInterval(checkInterval);
            setLoading(false);
            setErrorMessage('WhatsApp connection timed out. Check your number and try again.');
          }
        }, 1200);
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Network error occurred. Please try again.');
      setLoading(false);
      playCyberTone('beep', soundEnabled);
    }
  };

  const handleGenerateQrCode = async () => {
    setErrorMessage(null);
    playCyberTone('click', soundEnabled);
    setLoading(true);
    setPairingCode('');
    setQrDataUrl('');

    try {
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'qr',
          clientId,
          ownerToken,
          serverId: selectedServer.id === 'auto' ? undefined : selectedServer.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMessage(data.error || 'Failed to generate QR code. Please retry.');
        setLoading(false);
        playCyberTone('beep', soundEnabled);
        return;
      }
      if (data.whatsapp?.status === 'connected') {
        setQrDataUrl('');
        setLoading(false);
        playCyberTone('success', soundEnabled);
        return;
      }
      if (data.whatsapp?.qrDataUrl) {
        setQrDataUrl(data.whatsapp.qrDataUrl);
        playCyberTone('success', soundEnabled);
        setLoading(false);
        return;
      }
      let attempts = 0;
      const checkInterval = setInterval(async () => {
        attempts += 1;
        try {
          const checkRes = await fetch(
            `/api/state?clientId=${encodeURIComponent(clientId)}&ownerToken=${encodeURIComponent(
              ownerToken
            )}`
          );
          const checkData = await checkRes.json();
          if (checkData.whatsapp?.qrDataUrl) {
            setQrDataUrl(checkData.whatsapp.qrDataUrl);
            setLoading(false);
            playCyberTone('success', soundEnabled);
            clearInterval(checkInterval);
          } else if (checkData.whatsapp?.status === 'connected') {
            setQrDataUrl('');
            setLoading(false);
            playCyberTone('success', soundEnabled);
            clearInterval(checkInterval);
          } else if (checkData.whatsapp?.errorMessage) {
            setErrorMessage(checkData.whatsapp.errorMessage);
            setLoading(false);
            playCyberTone('beep', soundEnabled);
            clearInterval(checkInterval);
          }
        } catch {}
        if (attempts >= 15) {
          clearInterval(checkInterval);
          setLoading(false);
          setErrorMessage('QR code request timed out. Please try again.');
        }
      }, 1200);
    } catch (e: any) {
      setErrorMessage(e?.message || 'Network error occurred.');
      setLoading(false);
      playCyberTone('beep', soundEnabled);
    }
  };

  const handleCopyCode = (code: string) => {
    playCyberTone('click', soundEnabled);
    const clean = code.replace(/[^a-zA-Z0-9]/g, '');
    navigator.clipboard.writeText(clean);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Determine active stepper step
  const isConnectedNow = state?.whatsapp?.status === 'connected';
  const currentStep = pairingCode || qrDataUrl || isConnectedNow ? 3 : phoneDigits.trim().length >= 7 ? 2 : 1;

  // Filter countries for modal search
  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.code.includes(countrySearch)
  );

  // Close popovers on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-anchor')) {
        setServerDropdownOpen(false);
        setMenuDropdownOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // =========================================================================
  // 👑 ROUTE: /sufyan-control (Admin Control Panel)
  // =========================================================================
  if (adminRouteActive) {
    if (!adminToken) {
      return (
        <AdminLogin
          onLoginSuccess={(token) => {
            setAdminToken(token);
            try {
              localStorage.setItem('xik_admin_token', token);
            } catch {}
          }}
          onExitToMain={navigateToMain}
        />
      );
    }
    return (
      <AdminDashboard
        token={adminToken}
        onLogout={handleAdminLogout}
        onExitToMain={navigateToMain}
      />
    );
  }

  // =========================================================================
  // 📱 MAIN WEBSITE: WHATSAPP PAIRING TOOL (1:1 Design Matching Screenshot)
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#030206] text-slate-100 font-sans selection:bg-rose-500 selection:text-white relative overflow-x-hidden transition-colors duration-500">
      {/* Background Cyber Wallpaper Image (Ultra Vivid, High Contrast & 100% Clear) */}
      <div
        className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat transition-all duration-700 filter brightness-105 contrast-110"
        style={{ backgroundImage: `url('/sayron_cyber_bg.jpg')` }}
      />
      {/* Subtle Cinematic Edge-only Vignette (Keeps center crystals and smoke 100% crisp) */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(3,2,6,0.65)_100%)]" />

      {/* Live Floating Fiery Cyber Embers (Adds live powerful motion to the background) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <span
          className="absolute bottom-0 left-[12%] w-1.5 h-1.5 rounded-full animate-ember-1 transition-all duration-500"
          style={{ backgroundColor: currentTheme.accent, boxShadow: `0 0 8px ${currentTheme.accent}` }}
        />
        <span
          className="absolute bottom-0 left-[28%] w-2 h-2 rounded-full animate-ember-2 transition-all duration-500"
          style={{ backgroundColor: currentTheme.accent, boxShadow: `0 0 10px ${currentTheme.accent}` }}
        />
        <span
          className="absolute bottom-0 left-[55%] w-1 h-1 rounded-full animate-ember-3 transition-all duration-500"
          style={{ backgroundColor: currentTheme.accent, boxShadow: `0 0 6px ${currentTheme.accent}` }}
        />
        <span
          className="absolute bottom-0 left-[75%] w-2 h-2 rounded-full animate-ember-4 transition-all duration-500"
          style={{ backgroundColor: currentTheme.accent, boxShadow: `0 0 12px ${currentTheme.accent}` }}
        />
        <span
          className="absolute bottom-0 left-[88%] w-1.5 h-1.5 rounded-full animate-ember-5 transition-all duration-500"
          style={{ backgroundColor: currentTheme.accent, boxShadow: `0 0 8px ${currentTheme.accent}` }}
        />
      </div>

      {/* Dynamic Theme Animated Laser Glow along Left and Right Edges */}
      <div
        className={`fixed top-0 bottom-0 left-0 w-[2.5px] bg-gradient-to-b ${currentTheme.laserGradient} opacity-90 z-20 pointer-events-none transition-all duration-500`}
        style={{ boxShadow: `0 0 18px ${currentTheme.accent}` }}
      />
      <div
        className={`fixed top-0 bottom-0 right-0 w-[2.5px] bg-gradient-to-b ${currentTheme.laserGradient} opacity-90 z-20 pointer-events-none transition-all duration-500`}
        style={{ boxShadow: `0 0 18px ${currentTheme.accent}` }}
      />

      {/* Theme Activated Floating Toast */}
      {themeToast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl border backdrop-blur-2xl bg-[#080d24]/95 flex items-center gap-3 shadow-[0_10px_35px_rgba(0,0,0,0.85)] animate-in fade-in slide-in-from-top-3 duration-200"
          style={{
            borderColor: themeToast.accent,
            boxShadow: `0 0 25px ${themeToast.accent}55`,
          }}
        >
          <Sparkles className="w-4 h-4 animate-spin [animation-duration:3s]" style={{ color: themeToast.accent }} />
          <div className="flex flex-col">
            <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400">
              THEME ACTIVATED
            </span>
            <span className="text-xs font-black tracking-wide text-white">
              {themeToast.title} • {themeToast.subtitle}
            </span>
          </div>
        </div>
      )}

      {/* Mobile-first Center Container matching exact reference proportions */}
      <div className="relative z-10 w-full max-w-[440px] mx-auto min-h-screen px-3.5 pt-2.5 pb-6 flex flex-col gap-3">
        
        {/* =========================================================================
            1. TOP BAR / HEADER (3D Silver-Ruby Crown + SAYRON MD + 3 Glowing Circles)
           ========================================================================= */}
        <header className="flex items-center justify-between py-1">
          {/* Left: 3D Crown + Metallic Title */}
          <div className="flex items-center gap-2.5 select-none">
            <div className="relative w-11 h-10 flex-shrink-0 flex items-center justify-center">
              <SilverRubyCrownSvg
                className="w-11 h-9 drop-shadow-[0_0_12px_rgba(239,29,52,0.85)]"
                accent={currentTheme.accent}
              />
            </div>
            <div className="flex flex-col leading-none">
              <div className="flex items-center gap-1.5">
                <span className="font-cyber font-black italic text-lg tracking-wider bg-gradient-to-b from-white via-slate-200 to-slate-400 bg-clip-text text-transparent drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                  SAYRON
                </span>
                <span
                  className="font-cyber font-black italic text-lg tracking-wider text-transparent bg-clip-text"
                  style={{
                    backgroundImage: `linear-gradient(180deg, #ff5c6c 0%, ${currentTheme.accent} 55%, #7f0915 100%)`,
                    filter: `drop-shadow(0 0 10px ${currentTheme.accent})`,
                  }}
                >
                  MD
                </span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[11px] font-medium text-slate-200 tracking-wide">
                  WhatsApp Pairing Tool
                </span>
                <Zap className="w-3 h-3 fill-current" style={{ color: currentTheme.accent }} />
              </div>
            </div>
          </div>

          {/* Right: Three Circular Glass Buttons (1: ••• Music Deck, 2: ☾ Theme, 3: i Menu) */}
          <div className="flex items-center gap-2 dropdown-anchor relative">
            {/* 1. Music Deck / Equalizer Button (•••) */}
            <button
              type="button"
              onClick={() => {
                playCyberTone('click', soundEnabled);
                setMusicModalOpen(true);
              }}
              title="Open Cyber Music Player"
              className="w-9 h-9 rounded-full bg-[#120407]/95 border flex items-center justify-center hover:scale-105 transition-all cursor-pointer backdrop-blur-md relative"
              style={{
                borderColor: isMusicPlaying ? '#22c55e' : `${currentTheme.accent}99`,
                boxShadow: isMusicPlaying
                  ? '0 0 14px rgba(34,197,94,0.75)'
                  : `0 0 10px ${currentTheme.accent}45`,
                color: isMusicPlaying ? '#4ade80' : '#f8fafc',
              }}
            >
              {isMusicPlaying ? (
                <div className="flex items-end gap-[2px] h-3.5">
                  <span className="w-[2.5px] bg-emerald-400 rounded-full animate-bounce [animation-delay:0ms] h-3" />
                  <span className="w-[2.5px] bg-emerald-300 rounded-full animate-bounce [animation-delay:150ms] h-2" />
                  <span className="w-[2.5px] bg-emerald-400 rounded-full animate-bounce [animation-delay:300ms] h-3.5" />
                </div>
              ) : (
                <MoreHorizontal className="w-4 h-4 text-slate-100" />
              )}
            </button>

            {/* 2. Theme Switcher (☾) */}
            <button
              type="button"
              onClick={cycleTheme}
              title={`Switch Theme (Current: ${currentTheme.name})`}
              className="w-9 h-9 rounded-full bg-[#120407]/95 border hover:scale-105 active:scale-95 flex items-center justify-center transition-all cursor-pointer backdrop-blur-md"
              style={{
                borderColor: `${currentTheme.accent}aa`,
                boxShadow: `0 0 10px ${currentTheme.accent}45`,
                color: '#f8fafc',
              }}
            >
              <Moon className="w-4 h-4 fill-slate-200/20" />
            </button>

            {/* 3. Info / Menu Button (i) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                playCyberTone('click', soundEnabled);
                setMenuDropdownOpen((prev) => !prev);
              }}
              title="Info & Menu Options"
              className="w-9 h-9 rounded-full bg-[#120407]/95 border hover:scale-105 flex items-center justify-center transition-all cursor-pointer backdrop-blur-md"
              style={{
                borderColor: menuDropdownOpen ? '#ffffff' : `${currentTheme.accent}aa`,
                boxShadow: menuDropdownOpen
                  ? `0 0 14px ${currentTheme.accent}`
                  : `0 0 10px ${currentTheme.accent}45`,
                color: '#f8fafc',
              }}
            >
              <Info className="w-4 h-4" />
            </button>

            {/* Menu Popover Dropdown */}
            {menuDropdownOpen && (
              <div
                className="absolute top-12 right-0 w-64 rounded-2xl bg-[#0d0408]/98 border p-2 shadow-[0_12px_35px_rgba(0,0,0,0.9)] backdrop-blur-2xl z-50 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-150"
                style={{
                  borderColor: `${currentTheme.accent}75`,
                  boxShadow: `0 10px 35px rgba(0,0,0,0.85), 0 0 16px ${currentTheme.accent}35`,
                }}
              >
                <button
                  type="button"
                  onClick={navigateToAdmin}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 text-left text-xs font-semibold transition-colors cursor-pointer"
                  style={{ color: currentTheme.accent }}
                >
                  <Lock className="w-4 h-4" style={{ color: currentTheme.accent }} />
                  <span>Admin Control Center</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playCyberTone('click', soundEnabled);
                    setMusicModalOpen(true);
                    setMenuDropdownOpen(false);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 text-left text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                >
                  <Music className="w-4 h-4 text-emerald-400" />
                  <span>Cyber Music Deck {isMusicPlaying ? '🔊' : '🎵'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playCyberTone('click', soundEnabled);
                    setStatsModalOpen(true);
                    setMenuDropdownOpen(false);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 text-left text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                >
                  <Activity className="w-4 h-4" style={{ color: currentTheme.accent }} />
                  <span>Cluster Live Stats</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playCyberTone('click', soundEnabled);
                    setCommandsModalOpen(true);
                    setMenuDropdownOpen(false);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 text-left text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                >
                  <Terminal className="w-4 h-4 text-rose-400" />
                  <span>Bot Command Catalog (.menu)</span>
                </button>
                <a
                  href={state?.channelInviteCode || 'https://whatsapp.com/channel/0029VbD2ggC9WtCAOvZlwe1I'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/10 text-left text-xs font-medium text-slate-200 transition-colors"
                >
                  <Radio className="w-4 h-4 text-emerald-400" />
                  <span>Official WhatsApp Channel</span>
                </a>
                <div className="h-px bg-slate-800 my-1" />
                <div className="px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>Sound Effects</span>
                  <button
                    type="button"
                    onClick={() => setSoundEnabled((p) => !p)}
                    className="hover:underline cursor-pointer"
                    style={{ color: currentTheme.accent }}
                  >
                    {soundEnabled ? 'ON 🔊' : 'OFF 🔇'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* =========================================================================
            2. HERO CHAMFERED CYBER BANNER (Crimson Masked Warrior + Crown SAYRON MD)
           ========================================================================= */}
        <div
          className="p-[1.5px] clip-cyber-card transition-all duration-500"
          style={{
            background: `linear-gradient(135deg, ${currentTheme.accent}, rgba(255,255,255,0.45), ${currentTheme.accent}, #450a0a, ${currentTheme.accent})`,
            filter: `drop-shadow(0 0 16px ${currentTheme.accent}55)`,
          }}
        >
          <section className="relative clip-cyber-card crimson-hero-frame px-4 py-4 min-h-[212px] overflow-hidden flex items-center">
            {/* Right-side Hooded Crimson Cyber Character Artwork from Reference */}
            <div
              className="absolute inset-y-0 right-0 w-[62%] pointer-events-none select-none bg-no-repeat"
              style={{
                backgroundImage: `url('/assets/aistudio/file_0000000037b881faa80c11c66190f01a_84ae5817.png')`,
                backgroundSize: '195% auto',
                backgroundPosition: '97% 13%',
              }}
            />
            {/* Smooth dark crimson scrim on left & edges so typography pops and frame lines blend seamlessly */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#070204] via-[#0a0205]/85 via-50% to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-[#070204]/90 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#080204] to-transparent pointer-events-none" />
            <div className="absolute inset-0 shadow-[inset_0_0_24px_rgba(7,2,4,0.92)] pointer-events-none" />

            {/* Decorative Bottom-Left Crimson Slash Accent Bars matching screenshot */}
            <div className="absolute bottom-1 left-2 flex items-end gap-1 pointer-events-none opacity-85">
              <span className="w-1 h-4 rotate-[-38deg]" style={{ backgroundColor: currentTheme.accent }} />
              <span className="w-1 h-5 rotate-[-38deg]" style={{ backgroundColor: currentTheme.accent }} />
              <span className="w-1 h-3 rotate-[-38deg]" style={{ backgroundColor: currentTheme.accent }} />
            </div>

            {/* Foreground Left Hero Lockup */}
            <div className="relative z-10 w-[60%] flex flex-col items-center text-center">
              {/* Top Kicker */}
              <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-white flex items-center gap-1.5 mb-2 whitespace-nowrap">
                <span>SECURE</span>
                <span style={{ color: currentTheme.accent }}>•</span>
                <span>FAST</span>
                <span style={{ color: currentTheme.accent }}>•</span>
                <span>RELIABLE</span>
              </div>

              {/* 3D Crown + Chrome SAYRON / Glowing Red MD */}
              <div className="flex flex-col items-center leading-none">
                <SilverRubyCrownSvg
                  className="w-12 h-9 -mb-1 drop-shadow-[0_0_12px_rgba(239,29,52,0.85)]"
                  accent={currentTheme.accent}
                />
                <div className="font-cyber font-black italic text-[28px] sm:text-[31px] tracking-wider bg-gradient-to-b from-white via-slate-200 to-slate-400 bg-clip-text text-transparent drop-shadow-[0_3px_10px_rgba(0,0,0,0.95)]">
                  SAYRON
                </div>
                <div className="flex items-center justify-center gap-2 -mt-0.5">
                  <span
                    className="h-[2.5px] w-7 rounded-full"
                    style={{ backgroundColor: currentTheme.accent, boxShadow: `0 0 8px ${currentTheme.accent}` }}
                  />
                  <span
                    className="font-cyber font-black italic text-[26px] sm:text-[29px] tracking-widest text-transparent bg-clip-text"
                    style={{
                      backgroundImage: `linear-gradient(180deg, #ff6b78 0%, ${currentTheme.accent} 55%, #7f0915 100%)`,
                      filter: `drop-shadow(0 0 12px ${currentTheme.accent})`,
                    }}
                  >
                    MD
                  </span>
                  <span
                    className="h-[2.5px] w-7 rounded-full"
                    style={{ backgroundColor: currentTheme.accent, boxShadow: `0 0 8px ${currentTheme.accent}` }}
                  />
                </div>
              </div>

              {/* Subtitle */}
              <div className="mt-2.5 text-[10.5px] font-bold tracking-wider uppercase leading-tight text-slate-100">
                <div>CONNECT YOUR WHATSAPP</div>
                <div>
                  GET{' '}
                  <span style={{ color: currentTheme.accent }}>PAIRING CODE</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* =========================================================================
            3. STEPPER INDICATOR ((1) Server —— (2) Number —— (3) Code)
           ========================================================================= */}
        <div className="flex items-center justify-between px-3 py-1 text-xs select-none">
          {/* Step 1: Server */}
          <div className="flex items-center gap-2">
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-sm transition-all"
              style={
                currentStep >= 1
                  ? {
                      background: 'radial-gradient(circle, rgba(239,29,52,0.3) 0%, rgba(15,3,6,0.95) 100%)',
                      border: `1.5px solid ${currentTheme.accent}`,
                      color: '#ffffff',
                      boxShadow: `0 0 12px ${currentTheme.accent}95`,
                    }
                  : {
                      backgroundColor: '#12070a',
                      border: '1px solid #450a0a',
                      color: '#94a3b8',
                    }
              }
            >
              1
            </span>
            <span className={`font-semibold text-xs ${currentStep >= 1 ? 'text-white' : 'text-slate-400'}`}>
              Server
            </span>
          </div>

          {/* Connector 1 */}
          <div
            className="flex-1 mx-2.5 h-[1.5px] transition-all duration-500"
            style={{
              background: `linear-gradient(to right, ${currentTheme.accent}, rgba(239,29,52,0.35))`,
            }}
          />

          {/* Step 2: Number */}
          <div className="flex items-center gap-2">
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-sm transition-all"
              style={
                currentStep >= 2
                  ? {
                      background: 'radial-gradient(circle, rgba(239,29,52,0.35) 0%, rgba(15,3,6,0.95) 100%)',
                      border: `1.5px solid ${currentTheme.accent}`,
                      color: '#ffffff',
                      boxShadow: `0 0 12px ${currentTheme.accent}95`,
                    }
                  : {
                      background: 'radial-gradient(circle, rgba(239,29,52,0.16) 0%, rgba(15,3,6,0.95) 100%)',
                      border: `1.5px solid ${currentTheme.accent}99`,
                      color: '#e2e8f0',
                      boxShadow: `0 0 8px ${currentTheme.accent}45`,
                    }
              }
            >
              2
            </span>
            <span className={`font-semibold text-xs ${currentStep >= 2 ? 'text-white' : 'text-slate-300'}`}>
              Number
            </span>
          </div>

          {/* Connector 2 */}
          <div
            className="flex-1 mx-2.5 h-[1.5px] transition-all duration-500"
            style={{
              background:
                currentStep >= 3
                  ? `linear-gradient(to right, ${currentTheme.accent}, #ffffff)`
                  : `linear-gradient(to right, ${currentTheme.accent}aa, rgba(239,29,52,0.3))`,
            }}
          />

          {/* Step 3: Code */}
          <div className="flex items-center gap-2">
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-sm transition-all"
              style={
                currentStep >= 3
                  ? {
                      background: 'radial-gradient(circle, rgba(239,29,52,0.35) 0%, rgba(15,3,6,0.95) 100%)',
                      border: `1.5px solid ${currentTheme.accent}`,
                      color: '#ffffff',
                      boxShadow: `0 0 12px ${currentTheme.accent}95`,
                    }
                  : {
                      background: 'radial-gradient(circle, rgba(239,29,52,0.16) 0%, rgba(15,3,6,0.95) 100%)',
                      border: `1.5px solid ${currentTheme.accent}99`,
                      color: '#e2e8f0',
                      boxShadow: `0 0 8px ${currentTheme.accent}45`,
                    }
              }
            >
              3
            </span>
            <span className={`font-semibold text-xs ${currentStep >= 3 ? 'text-white' : 'text-slate-300'}`}>
              Code
            </span>
          </div>
        </div>

        {/* =========================================================================
            4. CARD 1: SELECT A SERVER (Beveled Crimson Metallic Card)
           ========================================================================= */}
        <div className="relative dropdown-anchor">
          <div
            className="p-[1.5px] clip-cyber-card transition-all duration-300"
            style={{
              background: `linear-gradient(135deg, ${currentTheme.accent}cc, rgba(255,255,255,0.28), ${currentTheme.accent}cc)`,
              filter: `drop-shadow(0 0 12px ${currentTheme.accent}35)`,
            }}
          >
            <div
              onClick={() => {
                playCyberTone('click', soundEnabled);
                setServerDropdownOpen((prev) => !prev);
              }}
              className="clip-cyber-card crimson-metal-card px-3.5 py-3 relative cursor-pointer transition-all"
            >
              {/* Top-Right Decorative Diagonal Slashes */}
              <div className="absolute top-1.5 right-3 flex gap-1 pointer-events-none opacity-80">
                <span className="w-1 h-2.5 rotate-[-35deg]" style={{ backgroundColor: currentTheme.accent }} />
                <span className="w-1 h-2.5 rotate-[-35deg]" style={{ backgroundColor: currentTheme.accent }} />
              </div>

              <div className="flex items-center justify-between gap-2.5">
                {/* Left 3D Server Icon + Details */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-14 h-14 rounded-xl bg-[#090204] border flex items-center justify-center flex-shrink-0"
                    style={{
                      borderColor: `${currentTheme.accent}66`,
                      boxShadow: `inset 0 0 12px ${currentTheme.accent}30`,
                    }}
                  >
                    <ServerStackSvg className="w-10 h-10" accent={currentTheme.accent} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="text-[13.5px] font-bold text-white leading-snug">
                      {selectedServer.name}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-[11.5px] italic text-slate-300">
                      <span>Tap to choose</span>
                      <ChevronsRight className="w-3.5 h-3.5" style={{ color: currentTheme.accent }} />
                    </div>
                  </div>
                </div>

                {/* Right Online Indicator + Chevron */}
                <div className="flex items-center gap-2 shrink-0">
                  <div
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/75 border text-emerald-400 text-xs font-bold"
                    style={{
                      borderColor: `${currentTheme.accent}55`,
                    }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#22c55e]" />
                    <span>Online</span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      serverDropdownOpen ? 'rotate-180' : ''
                    }`}
                    style={{ color: currentTheme.accent }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Server Selection Dropdown */}
          {serverDropdownOpen && (
            <div
              className="absolute top-full left-0 right-0 mt-2 rounded-2xl bg-[#0e0306]/98 border p-2 shadow-[0_12px_35px_rgba(0,0,0,0.9)] backdrop-blur-xl z-40 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-150"
              style={{
                borderColor: `${currentTheme.accent}75`,
              }}
            >
              <div
                className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider border-b border-red-950/70"
                style={{ color: currentTheme.accent }}
              >
                Active Cloud Nodes ({SERVER_OPTIONS.length})
              </div>
              {SERVER_OPTIONS.map((srv) => (
                <button
                  key={srv.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedServer(srv);
                    setServerDropdownOpen(false);
                    playCyberTone('click', soundEnabled);
                  }}
                  className="flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-colors cursor-pointer"
                  style={
                    selectedServer.id === srv.id
                      ? {
                          backgroundColor: `${currentTheme.accent}25`,
                          border: `1px solid ${currentTheme.accent}90`,
                          color: '#ffffff',
                        }
                      : {
                          backgroundColor: 'transparent',
                          border: '1px solid transparent',
                          color: '#cbd5e1',
                        }
                  }
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-100">{srv.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{srv.region}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded border tabular-nums"
                      style={{
                        color: currentTheme.accent,
                        backgroundColor: `${currentTheme.accent}15`,
                        borderColor: `${currentTheme.accent}40`,
                      }}
                    >
                      {srv.ping}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* =========================================================================
            5. CARD 2: WHATSAPP NUMBER INPUT (Beveled Crimson Card + WhatsApp Icon)
           ========================================================================= */}
        <div
          className="p-[1.5px] clip-cyber-card transition-all duration-500"
          style={{
            background: `linear-gradient(135deg, ${currentTheme.accent}cc, rgba(255,255,255,0.28), ${currentTheme.accent}cc)`,
            filter: `drop-shadow(0 0 12px ${currentTheme.accent}35)`,
          }}
        >
          <div className="clip-cyber-card crimson-metal-card px-4 py-3.5 relative">
            {/* Top-Right Decorative Diagonal Slashes */}
            <div className="absolute top-1.5 right-3 flex gap-1 pointer-events-none opacity-80">
              <span className="w-1 h-2.5 rotate-[-35deg]" style={{ backgroundColor: currentTheme.accent }} />
              <span className="w-1 h-2.5 rotate-[-35deg]" style={{ backgroundColor: currentTheme.accent }} />
            </div>

            {/* Top Row: Green WhatsApp Logo + Header Labels */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-shrink-0 drop-shadow-[0_0_8px_rgba(37,211,102,0.5)]">
                <WhatsAppLogoSvg className="w-11 h-11" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black tracking-wide text-white uppercase">
                  WHATSAPP NUMBER
                </span>
                <span className="text-[11.5px] text-slate-300">
                  Include your country code, no + or 00
                </span>
              </div>
            </div>

            {/* Unified Recessed Input Box with Red UserPlus Country Picker Button */}
            <div className="relative flex items-center">
              <input
                type="tel"
                value={phoneDigits}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setPhoneDigits(val);
                  setErrorMessage(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleGeneratePairingCode();
                  }
                }}
                placeholder="923001234567"
                className="w-full bg-[#060204] border border-slate-700/80 rounded-xl pl-4 pr-16 py-3 text-white font-mono text-lg placeholder:text-slate-500 outline-none transition-all tracking-wider shadow-inner tabular-nums"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = currentTheme.accent;
                  e.currentTarget.style.boxShadow = `0 0 14px ${currentTheme.accent}45`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(51,65,85,0.8)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {phoneDigits && (
                  <button
                    type="button"
                    onClick={() => setPhoneDigits('')}
                    title="Clear number"
                    className="text-slate-400 hover:text-white p-1.5 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    playCyberTone('click', soundEnabled);
                    setCountryModalOpen(true);
                  }}
                  title="Select Country Code"
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  style={{ color: currentTheme.accent }}
                >
                  <UserPlus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Error Notice */}
            {errorMessage && (
              <div className="mt-2.5 px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            6. ACTION BUTTON: GENERATE PAIRING CODE (Chamfered Crimson Hex Button)
           ========================================================================= */}
        <div
          className="p-[2px] clip-cyber-btn transition-all duration-300"
          style={{
            background: `linear-gradient(90deg, ${currentTheme.accent}, #ffffff, ${currentTheme.accent}, #ffffff, ${currentTheme.accent})`,
            filter: `drop-shadow(0 0 18px ${currentTheme.accent}95)`,
          }}
        >
          <button
            type="button"
            onClick={handleGeneratePairingCode}
            disabled={loading}
            className={`clip-cyber-btn w-full py-3.5 px-6 relative font-cyber font-black italic text-sm sm:text-[15px] tracking-wider text-white uppercase flex items-center justify-between transition-all cursor-pointer bg-gradient-to-r ${currentTheme.buttonGradient} active:scale-[0.99] ${
              loading ? 'opacity-85 cursor-wait' : ''
            }`}
          >
            <Zap
              className={`w-5 h-5 fill-current ${loading ? 'animate-bounce' : ''}`}
              style={{ color: currentTheme.accent, filter: `drop-shadow(0 0 8px ${currentTheme.accent})` }}
            />

            <span className="flex-1 text-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
              {loading ? 'GENERATING CODE...' : 'GENERATE PAIRING CODE'}
            </span>

            <ChevronsRight
              className={`w-5 h-5 ${loading ? 'opacity-0' : ''}`}
              style={{ color: currentTheme.accent, filter: `drop-shadow(0 0 8px ${currentTheme.accent})` }}
            />
          </button>
        </div>

        <div className="flex justify-center -mt-1">
          <button
            type="button"
            onClick={handleGenerateQrCode}
            disabled={loading}
            className="text-[11px] font-mono tracking-wider uppercase text-slate-400 hover:text-white transition-colors cursor-pointer underline underline-offset-4 disabled:opacity-50"
          >
            Or link by scanning QR Code
          </button>
        </div>

        {/* =========================================================================
            7. RESULT CARD: PAIRING CODE DISPLAY (Chamfered Padlock + Copy Strip)
           ========================================================================= */}
        <div
          className="p-[1.5px] clip-cyber-card transition-all duration-500"
          style={{
            background: `linear-gradient(135deg, ${currentTheme.accent}cc, rgba(255,255,255,0.28), ${currentTheme.accent}cc)`,
            filter: `drop-shadow(0 0 12px ${currentTheme.accent}30)`,
          }}
        >
          <div className="clip-cyber-card crimson-metal-card px-4 py-3 min-h-[64px] flex flex-col justify-center relative overflow-hidden">
            {/* State 1: Connected State */}
            {isConnectedNow && !pairingCode && !qrDataUrl && !loading && (
              <div className="flex items-center justify-between gap-3 w-full py-1">
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1 text-center">
                  <div className="text-xs font-black tracking-wide text-emerald-400 uppercase">
                    WHATSAPP CONNECTED • 24/7 ACTIVE
                  </div>
                  <div className="text-[11px] font-mono text-slate-300 mt-0.5">
                    {state?.whatsapp?.connectedPhone || 'Bot Online'} — Send .menu in WhatsApp
                  </div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#22c55e] shrink-0" />
              </div>
            )}

            {/* State 2: Idle Initial State */}
            {!isConnectedNow && !pairingCode && !qrDataUrl && !loading && (
              <div className="flex items-center justify-between gap-3 w-full select-none">
                <div
                  className="w-9 h-9 rounded-full bg-black/80 border flex items-center justify-center shrink-0"
                  style={{
                    borderColor: `${currentTheme.accent}80`,
                    boxShadow: `0 0 10px ${currentTheme.accent}35`,
                  }}
                >
                  <Lock className="w-4 h-4" style={{ color: currentTheme.accent }} />
                </div>
                <span className="flex-1 text-center text-xs sm:text-[13px] font-medium text-slate-300">
                  Your pairing code will appear here
                </span>
                <button
                  type="button"
                  onClick={() => {
                    playCyberTone('click', soundEnabled);
                    handleGeneratePairingCode();
                  }}
                  title="Generate pairing code"
                  className="w-9 h-9 rounded-full bg-black/80 border border-slate-700/80 hover:border-red-500/70 flex items-center justify-center text-slate-200 cursor-pointer shrink-0 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* State 3: Connecting / Loading State */}
            {loading && (
              <div className="flex flex-col items-center justify-center gap-1.5 py-2 text-center">
                <div
                  className="flex items-center gap-2 font-mono text-xs font-semibold"
                  style={{ color: currentTheme.accent }}
                >
                  <RefreshCw className="w-4 h-4 animate-spin" style={{ color: currentTheme.accent }} />
                  <span>Connecting to Baileys Engine...</span>
                </div>
                <span className="text-[11px] text-slate-300 font-mono">
                  Initiating handshake on {selectedServer.name}
                </span>
              </div>
            )}

            {/* State 4: Code Generated (Large Glowing Monospace Code + Tap to Copy) */}
            {pairingCode && !loading && (() => {
              const rawClean = pairingCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
              const box1 = rawClean.slice(0, 4);
              const box2 = rawClean.slice(4, 8);
              const prettyCode = rawClean.length === 8 ? `${box1} - ${box2}` : pairingCode;
              return (
                <div className="w-full flex flex-col items-center gap-2.5 py-1 animate-in fade-in duration-200 text-center">
                  <div
                    className="text-[11px] font-mono tracking-wider uppercase flex items-center gap-1.5"
                    style={{ color: currentTheme.accent }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>OFFICIAL WHATSAPP PAIRING CODE</span>
                  </div>

                  {/* Big 8-Digit Monospace Display */}
                  <div
                    className="w-full py-2.5 px-4 rounded-xl bg-black/75 border flex items-center justify-center gap-3 transition-all"
                    style={{
                      borderColor: `${currentTheme.accent}90`,
                      boxShadow: `0 0 20px ${currentTheme.accent}40`,
                    }}
                  >
                    <span
                      className="font-mono font-black text-2xl tracking-[0.22em] tabular-nums"
                      style={{
                        color: '#ffffff',
                        textShadow: `0 0 14px ${currentTheme.accent}`,
                      }}
                    >
                      {prettyCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(pairingCode)}
                      className="p-2 rounded-lg transition-colors cursor-pointer"
                      style={{
                        backgroundColor: `${currentTheme.accent}30`,
                        color: '#ffffff',
                      }}
                      title="Copy Pairing Code"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* WhatsApp 8-Box Hint */}
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300">
                    <span>WhatsApp Entry:</span>
                    <span className="font-bold text-white px-2 py-0.5 rounded bg-white/10 tracking-widest border border-white/20">
                      {rawClean.length === 8 ? `${box1} - ${box2}` : rawClean}
                    </span>
                  </div>

                  {/* Copy Feedback */}
                  <button
                    type="button"
                    onClick={() => handleCopyCode(pairingCode)}
                    className="text-xs font-mono hover:underline flex items-center gap-1.5 cursor-pointer tabular-nums"
                    style={{ color: currentTheme.accent }}
                  >
                    {copied ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> COPIED TO CLIPBOARD ({rawClean})!
                      </span>
                    ) : (
                      <span>Tap code to copy ({codeCountdown}s remaining)</span>
                    )}
                  </button>

                  {/* Quick Switch: Fresh Code or QR */}
                  <div className="w-full flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleGeneratePairingCode}
                      className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-[11px] font-mono text-white cursor-pointer transition-colors"
                    >
                      Get New Code
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateQrCode}
                      className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-slate-300 cursor-pointer transition-colors"
                    >
                      Scan QR Instead
                    </button>
                  </div>

                  {/* Step-by-Step Instructions */}
                  <div className="w-full mt-1 pt-2 border-t border-slate-800/80 text-left text-[11px] font-mono text-slate-300 space-y-1">
                    <div className="font-bold" style={{ color: currentTheme.accent }}>
                      How to pair on WhatsApp:
                    </div>
                    <div className="text-slate-400">1. Open WhatsApp on your phone</div>
                    <div className="text-slate-400">2. Tap Menu (⋮) &gt; Linked Devices</div>
                    <div className="text-slate-400">3. Tap &ldquo;Link a Device&rdquo; &gt; &ldquo;Link with phone number instead&rdquo;</div>
                    <div className="text-slate-300">
                      4. Enter code: <strong className="text-emerald-400">{rawClean}</strong> (Box 1: <strong className="text-white">{box1}</strong>, Box 2: <strong className="text-white">{box2}</strong>)
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* State 5: QR Code Ready */}
            {qrDataUrl && !pairingCode && !loading && (
              <div className="w-full flex flex-col items-center gap-2.5 py-2 animate-in fade-in duration-200 text-center">
                <div
                  className="text-[11px] font-mono tracking-wider uppercase flex items-center gap-1.5"
                  style={{ color: currentTheme.accent }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SCAN QR IN WHATSAPP LINKED DEVICES</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white shadow-lg">
                  <img src={qrDataUrl} alt="WhatsApp Link QR Code" className="w-48 h-48 block" />
                </div>
                <button
                  type="button"
                  onClick={handleGenerateQrCode}
                  className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-[11px] font-mono text-white cursor-pointer transition-colors"
                >
                  Refresh QR Code
                </button>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            8. BOTTOM ADDRESS / ADMIN BAR & FOOTER (Matching Reference Screenshot)
           ========================================================================= */}
        <footer className="mt-1 flex flex-col items-center gap-2.5">
          {/* Chamfered Bottom Address + Admin Panel Strip */}
          <div
            className="w-full p-[1.5px] clip-cyber-bar"
            style={{
              background: `linear-gradient(90deg, ${currentTheme.accent}99, rgba(255,255,255,0.28), ${currentTheme.accent}99)`,
            }}
          >
            <div className="clip-cyber-bar crimson-metal-card w-full py-2.5 px-5 text-xs flex items-center justify-between select-none">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-slate-200" />
                <span className="text-white font-semibold tracking-wide">sayronmd.com</span>
              </div>

              <span className="h-4 w-[1px] bg-slate-600/80" />

              <button
                type="button"
                onClick={navigateToAdmin}
                className="flex items-center gap-2 font-semibold hover:brightness-125 transition-all cursor-pointer"
                style={{ color: currentTheme.accent }}
              >
                <Shield className="w-4 h-4 fill-current opacity-90" style={{ color: currentTheme.accent }} />
                <span>Admin Panel</span>
              </button>
            </div>
          </div>

          {/* Winged Crown Brand Attribution Footer */}
          <div className="flex items-center justify-center gap-2 text-[10.5px] font-mono tracking-wider text-slate-300 uppercase pt-0.5">
            <span>SAYRON MD BOT</span>
            <span style={{ color: currentTheme.accent }}>•</span>
            <div className="flex items-center gap-1">
              <span
                className="w-4 h-[2px] rounded-full"
                style={{ backgroundColor: currentTheme.accent }}
              />
              <SilverRubyCrownSvg className="w-6 h-5" accent={currentTheme.accent} />
              <span
                className="w-4 h-[2px] rounded-full"
                style={{ backgroundColor: currentTheme.accent }}
              />
            </div>
            <span style={{ color: currentTheme.accent }}>•</span>
            <span>BY SAYRON MD</span>
          </div>
        </footer>

      </div>

      {/* =========================================================================
          MODAL: COUNTRY CODE SELECTOR (Searchable)
         ========================================================================= */}
      {countryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#090716] border border-red-500/40 p-4 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-red-950/70">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-red-400" />
                <span className="font-bold text-sm text-white">Select Country Code</span>
              </div>
              <button
                type="button"
                onClick={() => setCountryModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="my-3 relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder="Search country or code..."
                className="w-full bg-[#050612] border border-red-500/30 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-red-400"
              />
            </div>

            {/* Country List */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {filteredCountries.map((c) => (
                <button
                  key={`${c.code}-${c.name}`}
                  type="button"
                  onClick={() => {
                    setSelectedCountry(c);
                    setCountryModalOpen(false);
                    playCyberTone('click', soundEnabled);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                    selectedCountry.code === c.code
                      ? 'bg-red-500/20 text-white font-bold border border-red-500/40'
                      : 'hover:bg-red-950/30 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{c.flag}</span>
                    <span>{c.name}</span>
                  </div>
                  <span className="font-mono text-red-400 font-bold">+{c.code}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CLUSTER LIVE STATS (Top Bar Chart Icon)
         ========================================================================= */}
      {statsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#090716] border border-red-500/40 p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-red-950/70">
              <div className="flex items-center gap-2 text-red-300">
                <Activity className="w-4 h-4 text-red-400" />
                <span className="font-bold text-sm text-white">Cluster & Server Status</span>
              </div>
              <button
                type="button"
                onClick={() => setStatsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-3 rounded-xl bg-black/40 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">Bot Status</div>
                <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>ONLINE</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">Active Sessions</div>
                <div className="text-sm font-bold text-red-300 mt-1">
                  {state?.activeBotsCount ?? 1} Connected
                </div>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">Average Ping</div>
                <div className="text-sm font-bold text-red-300 mt-1">12.4 ms</div>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">Total Handled</div>
                <div className="text-sm font-bold text-purple-300 mt-1">
                  {state?.totalUsersCount ?? 120}+ Users
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-red-950/25 border border-red-500/20 text-[11px] text-slate-300 font-mono space-y-1">
              <div className="text-red-400 font-bold">Connected Server:</div>
              <div>Node: {selectedServer.name}</div>
              <div>Region: {selectedServer.region}</div>
              <div>Anti-Ban Engine: 🟢 Active 24/7</div>
            </div>

            <button
              type="button"
              onClick={() => setStatsModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-400/50 text-red-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Close Stats
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: BOT COMMANDS QUICK REFERENCE
         ========================================================================= */}
      {commandsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#090716] border border-red-500/40 p-5 shadow-2xl flex flex-col gap-3 max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-red-950/70">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-red-400" />
                <span className="font-bold text-sm text-white">Popular Bot Commands (.menu)</span>
              </div>
              <button
                type="button"
                onClick={() => setCommandsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 text-xs font-mono pr-1">
              {[
                { cmd: '.menu', desc: 'Full interactive command catalog with animated banner' },
                { cmd: '.alive', desc: 'Checks 24/7 bot status and server health' },
                { cmd: '.ping', desc: 'Speed check & latency response time' },
                { cmd: '.mode private', desc: 'Owner-only private mode (ignores non-owners)' },
                { cmd: '.mode public', desc: 'Open to everyone in groups & DMs' },
                { cmd: '.song <name>', desc: 'High-speed MP3 song downloader' },
                { cmd: '.video <name>', desc: 'Full HD MP4 video downloader' },
                { cmd: '.sticker', desc: 'Converts photo/video into animated sticker' },
                { cmd: '.ai on / .ai off', desc: 'Toggles Gemini 2.5 Flash intelligent auto-reply' },
                { cmd: '.tts <text>', desc: 'Converts Urdu / English text into voice note' },
                { cmd: '.statussave', desc: 'Downloads WhatsApp status directly' },
                { cmd: '.vv', desc: 'Unlocks View-Once photos and voice notes' },
              ].map((c) => (
                <div key={c.cmd} className="p-2.5 rounded-xl bg-black/40 border border-slate-800/80">
                  <div className="text-red-400 font-bold">{c.cmd}</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">{c.desc}</div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setCommandsModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-400/50 text-red-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CYBER MUSIC PLAYER DECK
         ========================================================================= */}
      <CyberMusicPlayer
        isOpen={musicModalOpen}
        onClose={() => setMusicModalOpen(false)}
        onOpen={() => setMusicModalOpen(true)}
        accentColor={currentTheme.accent}
        isPlayingGlobal={isMusicPlaying}
        onPlayingStateChange={setIsMusicPlaying}
      />

    </div>
  );
}
