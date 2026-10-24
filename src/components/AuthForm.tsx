import React, { useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Github,
  GitBranch,
  LoaderCircle,
  Mail,
  Phone,
  Shield,
  KeyRound,
  CheckCircle2,
  Terminal,
  Layers,
} from 'lucide-react';
import { ToolDoctorStore } from '../services/store';

interface AuthFormProps {
  mode: 'login' | 'register';
  onNavigate: (path: string) => void;
}

const videoUrl =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_104303_0c6d60b2-9353-408e-9449-585108a22fb5.mp4';
const posterUrl =
  'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/130837c4-0244-4f37-9c61-8d801d93fd29.jpg';

const inputClass =
  'mt-2 h-11 w-full rounded-lg border border-white/[0.09] bg-[#030712]/80 px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-emerald-300/35 transition';

export const AuthForm: React.FC<AuthFormProps> = ({ mode: initialMode, onNavigate }) => {
  const store = ToolDoctorStore.get();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialMode);
  const [channel, setChannel] = useState<'email' | 'phone'>('email');
  const [destination, setDestination] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otpMode, setOtpMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [organization, setOrganization] = useState('');
  const [jobTitle, setJobTitle] = useState('');

  const afterLogin = (role?: string) => {
    if (role === 'admin') {
      onNavigate('/admin');
    } else {
      onNavigate('/dashboard');
    }
  };

  const handleSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (activeTab === 'register') {
        if (!name.trim()) throw new Error('Please provide your full name.');
        if (!email.trim() || !email.includes('@')) throw new Error('Please provide a valid email address.');
        if (!mobile.trim()) throw new Error('Please provide your mobile number in international format.');
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');

        const result = store.registerUser({
          name,
          email,
          mobile,
          organization,
          jobTitle,
        });
        afterLogin(result.user.role);
      } else {
        const identifier = email || mobile;
        if (!identifier.trim()) throw new Error('Please enter your email or mobile number.');
        const result = store.loginUser(identifier);
        if (!result.success) throw new Error(result.error || 'Failed to authenticate');
        afterLogin(result.user?.role);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) {
      setError(`Please enter your ${channel === 'email' ? 'email address' : 'mobile number'}.`);
      return;
    }
    setBusy(true);
    setError(null);
    setTimeout(() => {
      setChallengeId(`challenge-${Math.floor(100000 + Math.random() * 900000)}`);
      setSuccessNotice(`Verification code sent to ${destination}. (Demo code: 123456)`);
      setBusy(false);
    }, 600);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    setBusy(true);
    setError(null);
    setTimeout(() => {
      setBusy(false);
      const res = store.loginUser(destination);
      afterLogin(res.user?.role);
    }, 600);
  };

  const handleQuickDemo = (role: 'admin' | 'developer') => {
    store.switchRole(role);
    afterLogin(role);
  };

  const handleOAuthLogin = (provider: string) => {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      store.loginUser(`${provider.toLowerCase()}-user@tooldoctor.dev`);
      afterLogin('developer');
    }, 400);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#02060f] px-4 py-10 text-white font-sans selection:bg-emerald-500/20">
      {/* Ambient Atmospheric Backdrop matching Landing Page */}
      <div className="app-atmosphere" aria-hidden="true">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={posterUrl}
          src={videoUrl}
          className="art-bg"
        />
        <div className="veil-overlay" />
      </div>

      <section className="relative z-10 w-full max-w-md rounded-2xl border border-white/[0.09] bg-[#070e1c]/80 backdrop-blur-2xl p-6 shadow-2xl shadow-black/40 sm:p-8">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="inline-flex items-center gap-2 text-xs text-white/45 transition hover:text-white bg-transparent border-0 cursor-pointer p-0"
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Back to Tool Doctor
        </button>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
              <Activity aria-hidden="true" size={19} />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-wide">tool doctor</p>
              <p className="text-[11px] text-white/40">Workshop signal controller</p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex rounded-lg border border-white/[0.08] bg-[#0c0e0d] p-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setError(null);
              }}
              className={`px-3 py-1 rounded-md transition font-medium cursor-pointer ${
                activeTab === 'login' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setError(null);
              }}
              className={`px-3 py-1 rounded-md transition font-medium cursor-pointer ${
                activeTab === 'register' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>
        </div>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          {activeTab === 'register' ? 'Create developer account' : 'Sign in to Workshop'}
        </h1>
        <p className="mt-1 text-xs text-white/45">
          {activeTab === 'register'
            ? 'Set up a new workspace profile to monitor your open source tools.'
            : 'Access your monitored repositories, signals, and findings.'}
        </p>

        {/* Demo fast-login */}
        <div className="mt-4 p-3 rounded-xl border border-emerald-500/20 bg-emerald-950/20 text-xs">
          <p className="text-emerald-300 font-medium flex items-center gap-1.5">
            <KeyRound size={13} /> Quick Access
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo('developer')}
              className="flex-1 py-1.5 px-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/90 text-xs font-medium border border-white/10 transition cursor-pointer"
            >
              Developer Profile
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('admin')}
              className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-medium border border-emerald-500/30 transition cursor-pointer flex items-center justify-center gap-1"
            >
              <Shield size={12} /> Administrator
            </button>
          </div>
        </div>

        {/* Open Source Single Sign-On Options */}
        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-wider text-white/35 font-semibold mb-2">
            Sign in with Open Source Forge
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleOAuthLogin('github')}
              className="flex h-9 items-center justify-center gap-2 rounded-lg border border-white/[0.08] text-xs text-white/70 transition hover:bg-white/[0.05] cursor-pointer"
            >
              <Github aria-hidden="true" size={13} /> GitHub
            </button>
            <button
              type="button"
              onClick={() => handleOAuthLogin('gitlab')}
              className="flex h-9 items-center justify-center gap-2 rounded-lg border border-white/[0.08] text-xs text-white/70 transition hover:bg-white/[0.05] cursor-pointer"
            >
              <GitBranch aria-hidden="true" size={13} className="text-orange-400" /> GitLab
            </button>
            <button
              type="button"
              onClick={() => handleOAuthLogin('codeberg')}
              className="flex h-9 items-center justify-center gap-2 rounded-lg border border-white/[0.08] text-xs text-white/70 transition hover:bg-white/[0.05] cursor-pointer"
            >
              <Layers aria-hidden="true" size={13} className="text-teal-400" /> Codeberg
            </button>
            <button
              type="button"
              onClick={() => handleOAuthLogin('bitbucket')}
              className="flex h-9 items-center justify-center gap-2 rounded-lg border border-white/[0.08] text-xs text-white/70 transition hover:bg-white/[0.05] cursor-pointer"
            >
              <Terminal aria-hidden="true" size={13} className="text-blue-400" /> Bitbucket
            </button>
          </div>
        </div>

        {activeTab === 'login' && (
          <div className="mt-4 flex items-center justify-between border-t border-white/[0.08] pt-3 text-xs text-white/50">
            <span>{otpMode ? 'One-time verification code' : 'Password login'}</span>
            <button
              type="button"
              onClick={() => {
                setOtpMode(!otpMode);
                setChallengeId(null);
                setError(null);
              }}
              className="text-emerald-300 hover:text-emerald-200 bg-transparent border-0 cursor-pointer p-0 underline"
            >
              {otpMode ? 'Use password instead' : 'Use one-time code (OTP)'}
            </button>
          </div>
        )}

        {activeTab === 'login' && otpMode ? (
          /* OTP Form */
          <div className="mt-3 space-y-3">
            {!challengeId ? (
              <form onSubmit={handleRequestOtp} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setChannel('email')}
                    className={`flex h-9 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium cursor-pointer transition ${
                      channel === 'email'
                        ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200'
                        : 'border-white/[0.08] text-white/50 hover:bg-white/[0.03]'
                    }`}
                  >
                    <Mail size={13} /> Email code
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel('phone')}
                    className={`flex h-9 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium cursor-pointer transition ${
                      channel === 'phone'
                        ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200'
                        : 'border-white/[0.08] text-white/50 hover:bg-white/[0.03]'
                    }`}
                  >
                    <Phone size={13} /> SMS code
                  </button>
                </div>
                <div>
                  <label className="text-xs text-white/60">
                    {channel === 'email' ? 'Email address' : 'Mobile number (+1...)'}
                  </label>
                  <input
                    type={channel === 'email' ? 'email' : 'tel'}
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder={channel === 'email' ? 'alex@tooldoctor.dev' : '+14155550199'}
                    className={inputClass}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full h-10 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black font-semibold text-xs tracking-wide transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {busy ? <LoaderCircle className="animate-spin" size={16} /> : 'Send code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <div>
                  <label className="text-xs text-white/60">Enter verification code</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    className={`${inputClass} tracking-widest text-center text-lg`}
                    required
                    maxLength={8}
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full h-10 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black font-semibold text-xs tracking-wide transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {busy ? <LoaderCircle className="animate-spin" size={16} /> : 'Verify & Enter Workshop'}
                </button>
                <button
                  type="button"
                  onClick={() => setChallengeId(null)}
                  className="w-full text-center text-xs text-white/40 hover:text-white bg-transparent border-0 cursor-pointer"
                >
                  Resend code
                </button>
              </form>
            )}
          </div>
        ) : (
          /* Password Form */
          <form onSubmit={handleSubmitPassword} className="mt-4 space-y-3">
            {activeTab === 'register' && (
              <div>
                <label className="text-xs text-white/60">Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  className={inputClass}
                  required
                />
              </div>
            )}

            <div>
              <label className="text-xs text-white/60">
                {activeTab === 'register' ? 'Email address' : 'Email address or mobile'}
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@tooldoctor.dev"
                className={inputClass}
                required
              />
            </div>

            {activeTab === 'register' && (
              <div>
                <label className="text-xs text-white/60">Mobile number</label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+14155550199"
                  className={inputClass}
                  required
                />
              </div>
            )}

            <div>
              <div className="flex justify-between items-center">
                <label className="text-xs text-white/60">Password</label>
                {activeTab === 'login' && (
                  <span className="text-[11px] text-white/35">Admin: admin@tooldoctor.dev</span>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className={inputClass}
                required
              />
            </div>

            {activeTab === 'register' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-white/60">Organization (optional)</label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="Acme Labs"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60">Job title (optional)</label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Staff SRE"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-4 w-full h-11 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black font-semibold text-xs tracking-wide transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {busy ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : activeTab === 'register' ? (
                'Create Developer Account'
              ) : (
                'Sign In & Enter Workshop'
              )}
            </button>
          </form>
        )}

        {successNotice && (
          <div className="mt-3 p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-950/20 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {error && (
          <div className="mt-3 p-2.5 rounded-lg border border-rose-500/20 bg-rose-950/20 text-xs text-rose-200" role="alert">
            {error}
          </div>
        )}
      </section>
    </main>
  );
};
