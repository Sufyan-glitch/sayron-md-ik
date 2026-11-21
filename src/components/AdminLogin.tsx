import React, { useState } from 'react';
import { Lock, Shield, Eye, EyeOff, AlertTriangle, KeyRound, Sparkles, Terminal } from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: (token: string, user: any) => void;
  onExitToMain: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onExitToMain }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || loading || isLocked) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.locked) {
          setIsLocked(true);
          setError(data.error || 'Account locked due to security violations.');
        } else {
          setError(data.error || 'Authentication rejected. Invalid credentials.');
          if (typeof data.attemptsLeft === 'number') {
            setAttemptsLeft(data.attemptsLeft);
          }
        }
        setLoading(false);
        return;
      }

      if (data.token) {
        // Save token to localStorage as backup
        try {
          localStorage.setItem('xik_admin_token', data.token);
        } catch {
          // ignore
        }
        onLoginSuccess(data.token, data.user);
      }
    } catch {
      setError('Connection failure: Unable to reach SUFYAN-X-IK Security Node.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030612] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Cyber Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Cyber Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Top Header Card */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-[11px] font-mono text-cyan-400 tracking-wider mb-3 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>CLASSIFIED PROTOCOL • LEVEL 5 CLEARANCE</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-mono tracking-wider bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
            SUFYAN-X-IK
          </h1>
          <p className="text-xs text-slate-400 font-mono tracking-widest mt-0.5">
            ULTIMATE WHATSAPP BOT CONTROL CENTER
          </p>
        </div>

        {/* Live Cyber Bot Video Banner */}
        <div className="mb-4 relative rounded-2xl overflow-hidden border border-cyan-500/40 bg-black/90 shadow-[0_0_30px_rgba(0,240,255,0.2)] group">
          <div className="relative aspect-[16/9] w-full overflow-hidden">
            <video
              autoPlay
              loop
              muted
              playsInline
              poster="/sayron_md_banner.gif"
              className="w-full h-full object-cover block"
            >
              <source src="/sayron_md_menu_gif.mp4" type="video/mp4" />
              <img
                src="/sayron_md_banner.gif"
                alt="SAYRON MD Core Banner"
                className="w-full h-full object-cover"
              />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-black/40 pointer-events-none" />
            <div className="absolute top-2 left-2 pointer-events-none text-[10px] font-mono font-bold text-cyan-300 bg-black/80 px-2 py-0.5 rounded border border-cyan-500/50 flex items-center gap-1.5 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>LIVE BOT ENGINE ● 60FPS</span>
            </div>
            <div className="absolute top-2 right-2 pointer-events-none text-[10px] font-mono text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-500/50 backdrop-blur-md">
              COMMAND SYSTEM v9.0
            </div>
            <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-slate-300 pointer-events-none">
              <span className="text-cyan-400 font-bold">👑 SAYRON MD</span>
              <span className="text-slate-400">STATUS: READY</span>
            </div>
          </div>
        </div>

        {/* Main Login Glassmorphism Box */}
        <div className="relative rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-cyan-500/30 p-6 shadow-[0_0_40px_rgba(0,240,255,0.12)]">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-bold tracking-wide uppercase font-mono text-slate-200">
                Master Authentication
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/70 border border-purple-500/40 text-purple-300">
              SHA-256 SALT
            </span>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 flex items-start gap-2.5 text-rose-300 text-xs animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 font-mono">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                Security Password Key
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4 text-cyan-400/70" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || isLocked}
                  placeholder="Enter Master Password..."
                  autoComplete="current-password"
                  autoFocus
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-black/60 border border-slate-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-slate-100 placeholder-slate-600 text-sm font-mono tracking-wider transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-cyan-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {attemptsLeft !== null && attemptsLeft > 0 && attemptsLeft < 5 && (
                <p className="mt-1.5 text-[11px] font-mono text-amber-400 flex items-center gap-1">
                  <span>⚠️ Caution: Only {attemptsLeft} attempt(s) remaining before security lockout.</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !password.trim() || isLocked}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-sm tracking-wider uppercase font-mono shadow-[0_0_25px_rgba(0,240,255,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>DECRYPTING CREDENTIALS...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-cyan-200" />
                  <span>ACCESS CONTROL CENTER</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Return to Public Web View */}
          <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
            <button
              type="button"
              onClick={onExitToMain}
              className="text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>← Back to Public Bot Interface</span>
            </button>
            <span className="text-[10px] text-slate-600">v8.0 CYBER</span>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] font-mono text-slate-500 mt-4 tracking-widest uppercase">
          POWERED BY SUFYAN • ALL RIGHTS RESERVED
        </p>
      </div>
    </div>
  );
};
