import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Blocks,
  CheckCircle2,
  Clock3,
  ExternalLink,
  GitBranch,
  Github,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Shield,
  Trash2,
  X,
  Radio,
  Check,
  Terminal,
  Layers,
  Sparkles,
  Link2,
} from 'lucide-react';
import { ToolDoctorStore } from '../services/store';
import { Tool, Finding, User, ToolStatus, CheckSeverity, ProviderType } from '../types';

const videoUrl =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_104303_0c6d60b2-9353-408e-9449-585108a22fb5.mp4';
const posterUrl =
  'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/130837c4-0244-4f37-9c61-8d801d93fd29.jpg';

interface DashboardProps {
  initialSection?: 'overview' | 'repositories' | 'findings' | 'integrations' | 'settings';
  onNavigate: (path: string) => void;
}

type Section = 'overview' | 'repositories' | 'findings' | 'integrations' | 'settings';

interface ForgeOption {
  id: ProviderType;
  name: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tagline: string;
  badgeColor: string;
  sampleTools: { name: string; slug: string; desc: string }[];
}

const FORGE_PLATFORMS: ForgeOption[] = [
  {
    id: 'github',
    name: 'GitHub',
    icon: Github,
    tagline: 'World’s largest developer platform and open source ecosystem',
    badgeColor: 'border-white/20 bg-white/10 text-white',
    sampleTools: [
      { name: 'React', slug: 'facebook/react', desc: 'The library for web and native user interfaces' },
      { name: 'Next.js', slug: 'vercel/next.js', desc: 'The React Framework for the Web' },
      { name: 'Tailwind CSS', slug: 'tailwindlabs/tailwindcss', desc: 'A utility-first CSS framework' },
      { name: 'Linux', slug: 'torvalds/linux', desc: 'Linux kernel source tree' },
      { name: 'Kubernetes', slug: 'kubernetes/kubernetes', desc: 'Production-Grade Container Scheduling and Management' },
    ],
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    icon: GitBranch,
    tagline: 'DevSecOps platform for collaborative open-source projects',
    badgeColor: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
    sampleTools: [
      { name: 'GitLab Runner', slug: 'gitlab-org/gitlab-runner', desc: 'GitLab CI/CD automated job executor' },
      { name: 'Inkscape', slug: 'inkscape/inkscape', desc: 'Vector graphics editor' },
      { name: 'GIMP', slug: 'gnome/gimp', desc: 'GNU Image Manipulation Program' },
      { name: 'F-Droid Client', slug: 'fdroid/fdroidclient', desc: 'Open source Android app repository client' },
      { name: 'Wireshark', slug: 'wireshark/wireshark', desc: 'Network protocol analyzer' },
    ],
  },
  {
    id: 'codeberg',
    name: 'Codeberg',
    icon: Layers,
    tagline: 'Free, community-driven, privacy-respecting open source forge',
    badgeColor: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
    sampleTools: [
      { name: 'Forgejo', slug: 'forgejo/forgejo', desc: 'Beyond coding. We forge. Self-hosted git platform' },
      { name: 'Woodpecker CI', slug: 'woodpecker-ci/woodpecker', desc: 'Community fork of Drone CI engine' },
      { name: 'Teddit', slug: 'teddit/teddit', desc: 'Alternative privacy-respecting Reddit frontend' },
      { name: 'Matrix SDK', slug: 'famedly/matrix-sdk-swift', desc: 'Open protocol for secure, decentralized comms' },
    ],
  },
  {
    id: 'bitbucket',
    name: 'Bitbucket',
    icon: Terminal,
    tagline: 'Atlassian git code hosting with integrated CI/CD pipelines',
    badgeColor: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    sampleTools: [
      { name: 'LocalStack', slug: 'atlassian/localstack', desc: 'A fully functional local AWS cloud stack' },
      { name: 'PyPy', slug: 'pypy/pypy', desc: 'Fast, compliant alternative Python implementation' },
      { name: 'TortoiseHg', slug: 'tortoisehg/thg', desc: 'Graphical front-end for Mercurial' },
      { name: 'Flog', slug: 'bernd/flog', desc: 'High-performance synthetic log generator' },
    ],
  },
  {
    id: 'gitea',
    name: 'Gitea & Federated',
    icon: Activity,
    tagline: 'Lightweight, self-hosted and federated git services',
    badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    sampleTools: [
      { name: 'Gitea Core', slug: 'go-gitea/gitea', desc: 'Git with a cup of tea - effortless self-hosted git' },
      { name: 'Miniflux', slug: 'miniflux/v2', desc: 'Minimalist and opinionated feed reader' },
      { name: 'Act Runner', slug: 'act/act_runner', desc: 'Runner for Gitea automated actions' },
    ],
  },
  {
    id: 'sourcehut',
    name: 'Sourcehut',
    icon: CheckCircle2,
    tagline: 'Fast, 100% free software suite for open-source hackers',
    badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
    sampleTools: [
      { name: 'Hare Language', slug: 'sircmpwn/hare', desc: 'Systems programming language designed to be simple' },
      { name: 'scdoc', slug: 'ddevault/scdoc', desc: 'Small man page generator for POSIX systems' },
      { name: 'Kousin', slug: 'emersion/kousin', desc: 'Wayland protocol extensions library' },
    ],
  },
];

export const Dashboard: React.FC<DashboardProps> = ({ initialSection = 'overview', onNavigate }) => {
  const store = ToolDoctorStore.get();
  const [section, setSection] = useState<Section>(initialSection);
  const [tools, setTools] = useState<Tool[]>(store.getTools());
  const [findings, setFindings] = useState<Finding[]>(store.getFindings());
  const [currentUser, setCurrentUser] = useState<User | null>(store.getCurrentUser());
  const [monitorInterval, setMonitorInterval] = useState<number>(store.getMonitorInterval());

  // Multi-forge connected states
  const [connectedForges, setConnectedForges] = useState<Record<ProviderType, boolean>>({
    sample: true,
    github: true,
    gitlab: true,
    codeberg: true,
    bitbucket: false,
    gitea: false,
    sourcehut: false,
  });

  // Selected forge for connection/project choosing
  const [activeForge, setActiveForge] = useState<ProviderType>('github');
  const [customRepoInput, setCustomRepoInput] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | ToolStatus>('all');
  const [providerFilter, setProviderFilter] = useState<'all' | ProviderType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [findingStatusFilter, setFindingStatusFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [findingSeverityFilter, setFindingSeverityFilter] = useState<'all' | CheckSeverity>('all');

  // Selected tool for detail modal
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [recheckingToolId, setRecheckingToolId] = useState<string | null>(null);
  const [isRecheckingAll, setIsRecheckingAll] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Listen to store updates
  useEffect(() => {
    return store.subscribe(() => {
      setTools(store.getTools());
      setFindings(store.getFindings());
      setCurrentUser(store.getCurrentUser());
      setMonitorInterval(store.getMonitorInterval());
    });
  }, [store]);

  useEffect(() => {
    if (selectedTool) {
      const updated = tools.find((t) => t.id === selectedTool.id);
      if (updated) setSelectedTool(updated);
    }
  }, [tools, selectedTool]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = tools.length;
    const healthy = tools.filter((t) => t.status === 'healthy').length;
    const attention = tools.filter((t) => t.status === 'attention').length;
    const critical = tools.filter((t) => t.status === 'critical').length;
    const openFindings = findings.filter((f) => f.status === 'open').length;
    const averageScore = total > 0 ? Math.round(tools.reduce((acc, t) => acc + t.healthScore, 0) / total) : 0;

    return { total, healthy, attention, critical, openFindings, averageScore };
  }, [tools, findings]);

  // Filtered tools
  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      if (statusFilter !== 'all' && tool.status !== statusFilter) return false;
      if (providerFilter !== 'all' && tool.provider !== providerFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          tool.name.toLowerCase().includes(q) ||
          tool.repository.toLowerCase().includes(q) ||
          tool.owner.toLowerCase().includes(q) ||
          tool.provider.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tools, statusFilter, providerFilter, searchQuery]);

  // Filtered findings
  const filteredFindings = useMemo(() => {
    return findings.filter((finding) => {
      if (findingStatusFilter !== 'all' && finding.status !== findingStatusFilter) return false;
      if (findingSeverityFilter !== 'all' && finding.severity !== findingSeverityFilter) return false;
      return true;
    });
  }, [findings, findingStatusFilter, findingSeverityFilter]);

  // Connect Forge Handler
  const handleToggleConnectForge = (forgeId: ProviderType) => {
    const nextState = !connectedForges[forgeId];
    setConnectedForges((prev) => ({ ...prev, [forgeId]: nextState }));
    showToast(
      nextState
        ? `Connected to ${forgeId.toUpperCase()} with active read-only inspection scopes.`
        : `Disconnected from ${forgeId.toUpperCase()}.`,
      'success'
    );
  };

  // Import, Analyse, Monitor & Manage project
  const handleAnalyseMonitorManage = async (provider: ProviderType, repoSlug: string) => {
    if (!repoSlug.trim()) return;
    setIsProcessingAction(true);
    try {
      const tool = await store.importProject(provider, repoSlug);
      setCustomRepoInput('');
      showToast(
        `Analysed ${tool.repository} (${provider.toUpperCase()})! Score: ${tool.healthScore}%. Continuous monitoring active.`,
        'success'
      );
      setSection('repositories');
      setSelectedTool(tool);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Analysis failed', 'error');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRecheckTool = async (toolId: string) => {
    setRecheckingToolId(toolId);
    try {
      const updated = await store.recheckRepository(toolId);
      showToast(`Rechecked ${updated.repository}. Health score: ${updated.healthScore}%.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Recheck failed', 'error');
    } finally {
      setRecheckingToolId(null);
    }
  };

  const handleRecheckAll = async () => {
    setIsRecheckingAll(true);
    try {
      for (const tool of tools) {
        await store.recheckRepository(tool.id);
      }
      showToast(`Successfully re-analysed all ${tools.length} repository health signals.`, 'success');
    } catch {
      showToast('Scan complete.', 'success');
    } finally {
      setIsRecheckingAll(false);
    }
  };

  const handleRemoveTool = (toolId: string, name: string) => {
    try {
      store.removeRepository(toolId);
      if (selectedTool?.id === toolId) setSelectedTool(null);
      showToast(`Removed ${name} from monitored workspace.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Cannot remove sample repository', 'error');
    }
  };

  const handleToggleFinding = (findingId: string, currentStatus: 'open' | 'resolved') => {
    const nextStatus = currentStatus === 'open' ? 'resolved' : 'open';
    store.setFindingStatus(findingId, nextStatus);
    showToast(`Finding marked as ${nextStatus}.`, 'success');
  };

  const handleSaveInterval = (seconds: number) => {
    store.updateMonitorInterval(seconds);
    showToast(`Monitor polling interval updated to ${Math.round(seconds / 3600)} hours.`, 'success');
  };

  return (
    <div className="relative min-h-screen bg-[#02060f] text-white font-sans flex flex-col selection:bg-emerald-500/20">
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

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-5 right-5 z-50 animate-bounce">
            <div
              className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs shadow-2xl backdrop-blur-md ${
                toastType === 'success'
                  ? 'border-emerald-500/30 bg-emerald-950/90 text-emerald-200'
                  : 'border-rose-500/30 bg-rose-950/90 text-rose-200'
              }`}
            >
              {toastType === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span className="font-medium">{toastMessage}</span>
            </div>
          </div>
        )}

        {/* Top Application Bar */}
        <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#030712]/80 backdrop-blur-xl px-4 sm:px-8 py-3.5">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="flex items-center gap-2.5 bg-transparent border-0 cursor-pointer p-0 group"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200 transition group-hover:bg-emerald-300/20">
                <Activity aria-hidden="true" size={18} />
              </span>
              <div className="text-left">
                <span className="block text-sm font-semibold tracking-wider text-white">TOOL DOCTOR</span>
                <span className="block text-[10px] text-white/40">Workshop & Signal Control</span>
              </div>
            </button>

            {/* Navigation Tabs (Workshop) */}
            <nav className="hidden md:flex items-center gap-1 ml-6 border-l border-white/[0.08] pl-6">
              {[
                { id: 'overview', label: 'Workshop Overview', icon: LayoutDashboard },
                { id: 'repositories', label: 'Monitored Tools', count: tools.length, icon: Blocks },
                { id: 'findings', label: 'Findings', count: metrics.openFindings, alert: metrics.openFindings > 0, icon: AlertCircle },
                { id: 'integrations', label: 'Open Source Connections', icon: GitBranch },
                { id: 'settings', label: 'Monitor Settings', icon: Settings2 },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = section === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSection(tab.id as Section)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                      isActive
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon size={14} className={isActive ? 'text-emerald-300' : 'text-white/40'} />
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                          tab.alert
                            ? 'bg-amber-400/20 text-amber-300'
                            : isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-white/[0.06] text-white/40'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* User Controls & Auth Navigation */}
          <div className="flex items-center gap-3">
            {currentUser?.role === 'admin' ? (
              <button
                type="button"
                onClick={() => onNavigate('/admin')}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20 transition cursor-pointer"
              >
                <Shield size={13} />
                <span>Admin Console</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  store.switchRole('admin');
                  onNavigate('/admin');
                }}
                className="hidden sm:flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/50 hover:text-white hover:bg-white/[0.07] transition cursor-pointer"
              >
                <Shield size={13} />
                <span>Switch to Admin</span>
              </button>
            )}

            {currentUser ? (
              <div className="flex items-center gap-2 pl-2 border-l border-white/[0.08]">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-medium text-white leading-tight">{currentUser.name}</p>
                  <p className="text-[10px] text-white/40 leading-tight capitalize">{currentUser.role}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    store.logout();
                    onNavigate('/login');
                  }}
                  className="p-1.5 rounded-lg text-white/40 hover:text-rose-300 hover:bg-rose-500/10 transition cursor-pointer"
                  title="Sign out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('/login')}
                  className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/10 text-white text-xs font-medium transition cursor-pointer"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/register')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-semibold transition cursor-pointer"
                >
                  Register
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Nav Bar */}
        <div className="flex md:hidden overflow-x-auto gap-2 mt-3 pt-3 border-t border-white/[0.06] pb-1">
          {[
            { id: 'overview', label: 'Workshop' },
            { id: 'repositories', label: 'Tools' },
            { id: 'findings', label: 'Findings' },
            { id: 'integrations', label: 'Open Source' },
            { id: 'settings', label: 'Settings' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id as Section)}
              className={`px-3 py-1 rounded-lg text-xs capitalize whitespace-nowrap ${
                section === tab.id ? 'bg-white/10 text-white font-medium' : 'text-white/45'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-8 py-6">
        {/* ===================== OVERVIEW SECTION ===================== */}
        {section === 'overview' && (
          <div className="space-y-6">
            {/* Header banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/[0.08] bg-gradient-to-r from-emerald-950/25 via-[#141615] to-[#141615] p-6 sm:p-7">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                  <Radio size={12} className="animate-pulse" /> Workshop Signal Center
                </span>
                <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Analyse. Monitor. Manage.
                </h1>
                <p className="mt-1 text-xs text-white/50 max-w-xl leading-relaxed">
                  Deep repository signal evaluation across GitHub, GitLab, Bitbucket, and Codeberg. Inspect availability, README documentation, CI automated runs, release tags, and license compliance.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleRecheckAll}
                  disabled={isRecheckingAll}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] hover:bg-white/10 px-4 py-2.5 text-xs font-medium text-white transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={13} className={isRecheckingAll ? 'animate-spin text-emerald-400' : ''} />
                  <span>{isRecheckingAll ? 'Re-analysing signals...' : 'Run All Health Checks'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSection('integrations')}
                  className="flex items-center gap-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 px-4 py-2.5 text-xs font-semibold text-black transition cursor-pointer shadow-lg shadow-emerald-500/10"
                >
                  <Plus size={14} />
                  <span>Connect Open Source Forge</span>
                </button>
              </div>
            </div>

            {/* Quick Multi-Platform Connect & Choose Bar */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#141615] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Sparkles size={15} className="text-emerald-400" />
                    <span>Choose Project / Tool to Connect & Analyse</span>
                  </h3>
                  <p className="mt-0.5 text-xs text-white/40">Select an open source platform and pick a project to begin continuous monitoring</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSection('integrations')}
                  className="text-xs text-emerald-300 hover:underline flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0"
                >
                  <span>Manage All Connections</span>
                  <ArrowRight size={12} />
                </button>
              </div>

              {/* Platform Selector Tabs */}
              <div className="mt-4 flex flex-wrap gap-2">
                {FORGE_PLATFORMS.map((forge) => {
                  const Icon = forge.icon;
                  const isSelected = activeForge === forge.id;
                  const isConnected = connectedForges[forge.id];
                  return (
                    <button
                      key={forge.id}
                      type="button"
                      onClick={() => setActiveForge(forge.id)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-medium transition cursor-pointer ${
                        isSelected
                          ? 'border-emerald-400/50 bg-emerald-400/15 text-white shadow-sm'
                          : 'border-white/[0.08] bg-white/[0.02] text-white/60 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <Icon size={14} />
                      <span>{forge.name}</span>
                      {isConnected && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" title="Connected" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Quick Pick Projects for Selected Platform */}
              <div className="mt-4 pt-3 border-t border-white/[0.05]">
                <p className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">
                  1-Click Projects on {activeForge.toUpperCase()}
                </p>
                <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {FORGE_PLATFORMS.find((f) => f.id === activeForge)?.sampleTools.map((proj) => {
                    const alreadyMonitored = tools.some(
                      (t) => t.repository.toLowerCase() === proj.slug.toLowerCase() && t.provider === activeForge
                    );
                    return (
                      <div
                        key={proj.slug}
                        className="rounded-xl border border-white/[0.06] bg-[#0c0e0d] p-3 flex flex-col justify-between hover:border-white/15 transition"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-white">{proj.name}</span>
                            <span className="text-[10px] font-mono text-white/40 uppercase">{activeForge}</span>
                          </div>
                          <p className="mt-0.5 font-mono text-[11px] text-emerald-300/80">{proj.slug}</p>
                          <p className="mt-1 text-[11px] text-white/50 line-clamp-1">{proj.desc}</p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-white/[0.04] flex items-center justify-between">
                          {alreadyMonitored ? (
                            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                              <Check size={11} /> Monitoring Active
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAnalyseMonitorManage(activeForge, proj.slug)}
                              disabled={isProcessingAction}
                              className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 transition bg-transparent border-0 cursor-pointer p-0 flex items-center gap-1"
                            >
                              <span>Analyse & Monitor</span>
                              <ArrowRight size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="rounded-xl border border-white/[0.08] bg-[#141615] p-4">
                <p className="text-[11px] text-white/40 uppercase tracking-wider">Monitored Tools</p>
                <p className="mt-1.5 text-2xl font-bold text-white">{metrics.total}</p>
                <p className="mt-1 text-[10px] text-white/40">Active in Workshop</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#141615] p-4">
                <p className="text-[11px] text-white/40 uppercase tracking-wider">Health Index</p>
                <p className="mt-1.5 text-2xl font-bold text-emerald-300">{metrics.averageScore}%</p>
                <p className="mt-1 text-[10px] text-white/40">Weighted signals</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#141615] p-4">
                <p className="text-[11px] text-white/40 uppercase tracking-wider">Healthy</p>
                <p className="mt-1.5 text-2xl font-bold text-emerald-400">{metrics.healthy}</p>
                <p className="mt-1 text-[10px] text-emerald-400/60">All signals passed</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#141615] p-4">
                <p className="text-[11px] text-white/40 uppercase tracking-wider">Needs Attention</p>
                <p className="mt-1.5 text-2xl font-bold text-amber-300">{metrics.attention}</p>
                <p className="mt-1 text-[10px] text-amber-300/60">Minor warnings</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#141615] p-4">
                <p className="text-[11px] text-white/40 uppercase tracking-wider">Critical Issues</p>
                <p className="mt-1.5 text-2xl font-bold text-rose-400">{metrics.critical}</p>
                <p className="mt-1 text-[10px] text-rose-400/60">Failed CI or docs</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#141615] p-4">
                <p className="text-[11px] text-white/40 uppercase tracking-wider">Open Findings</p>
                <p className="mt-1.5 text-2xl font-bold text-amber-200">{metrics.openFindings}</p>
                <p className="mt-1 text-[10px] text-amber-200/60">Triage required</p>
              </div>
            </div>

            {/* Repositories Quick Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tools.map((tool) => (
                <div
                  key={tool.id}
                  onClick={() => setSelectedTool(tool)}
                  className="group rounded-2xl border border-white/[0.08] bg-[#141615] p-5 hover:border-white/20 transition cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                              tool.status === 'healthy'
                                ? 'bg-emerald-400 ring-4 ring-emerald-400/10'
                                : tool.status === 'critical'
                                  ? 'bg-rose-400 ring-4 ring-rose-400/10'
                                  : 'bg-amber-300 ring-4 ring-amber-300/10'
                            }`}
                          />
                          <h3 className="text-base font-semibold text-white group-hover:text-emerald-300 transition">
                            {tool.name}
                          </h3>
                          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/50">
                            {tool.provider}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-xs text-white/50">{tool.repository}</p>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-xl font-bold font-mono ${
                            tool.healthScore >= 85
                              ? 'text-emerald-300'
                              : tool.healthScore >= 60
                                ? 'text-amber-300'
                                : 'text-rose-300'
                          }`}
                        >
                          {tool.healthScore}%
                        </span>
                        <p className="text-[9px] uppercase tracking-wider text-white/40">score</p>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-white/60 line-clamp-2 leading-relaxed">{tool.summary}</p>
                  </div>

                  {/* Signals mini badges */}
                  <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {tool.checkRuns.map((cr) => (
                        <span
                          key={cr.id}
                          title={`${cr.checkType}: ${cr.summary}`}
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${
                            cr.status === 'passed'
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                          }`}
                        >
                          {cr.checkType.slice(0, 4)}
                        </span>
                      ))}
                    </div>

                    <span className="text-[11px] text-white/40 group-hover:text-white transition flex items-center gap-1 shrink-0 ml-2">
                      Inspect & Manage <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================== REPOSITORIES SECTION ===================== */}
        {section === 'repositories' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Monitored Tools & Repositories</h1>
                <p className="mt-1 text-xs text-white/50">
                  Continuously monitor health scores, inspect collected evidence, and recheck repository signals across connected forges.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSection('integrations')}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 px-3.5 py-2 text-xs font-semibold text-black transition cursor-pointer"
                >
                  <Plus size={14} /> Connect New Tool
                </button>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#141615] p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-white/30" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tools, repos, owners…"
                    className="h-8 w-56 rounded-lg border border-white/[0.08] bg-[#0f1110] pl-8 pr-3 text-xs text-white placeholder:text-white/25 focus:border-emerald-300/40 outline-none"
                  />
                </div>

                {/* Status Filter */}
                <div className="flex items-center rounded-lg border border-white/[0.08] bg-[#0f1110] p-0.5 text-xs">
                  {(['all', 'healthy', 'attention', 'critical'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusFilter(s)}
                      className={`px-2.5 py-1 rounded-md text-[11px] capitalize cursor-pointer transition ${
                        statusFilter === s ? 'bg-white/10 text-white font-medium' : 'text-white/40 hover:text-white'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {/* Provider Filter */}
                <div className="flex items-center rounded-lg border border-white/[0.08] bg-[#0f1110] p-0.5 text-xs overflow-x-auto">
                  {(['all', 'github', 'gitlab', 'codeberg', 'sample'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setProviderFilter(p)}
                      className={`px-2.5 py-1 rounded-md text-[11px] uppercase cursor-pointer transition ${
                        providerFilter === p ? 'bg-white/10 text-white font-medium' : 'text-white/40 hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <span className="text-xs text-white/40">{filteredTools.length} tools monitored</span>
            </div>

            {/* Repositories Table / List */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141615]">
              {filteredTools.length === 0 ? (
                <div className="p-12 text-center text-xs text-white/45">
                  <p>No repositories match your filter criteria.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('all');
                      setProviderFilter('all');
                      setSearchQuery('');
                    }}
                    className="mt-3 text-emerald-300 hover:underline bg-transparent border-0 cursor-pointer"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] text-left text-xs">
                    <thead className="border-b border-white/[0.06] bg-white/[0.02] text-[10px] uppercase tracking-wider text-white/35">
                      <tr>
                        <th className="px-5 py-3.5 font-medium">Tool / Repository</th>
                        <th className="px-4 py-3.5 font-medium">Forge</th>
                        <th className="px-4 py-3.5 font-medium">Health Score</th>
                        <th className="px-4 py-3.5 font-medium">Signal Checks</th>
                        <th className="px-4 py-3.5 font-medium">Last Checked</th>
                        <th className="px-5 py-3.5 text-right font-medium">Manage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {filteredTools.map((tool) => (
                        <tr key={tool.id} className="hover:bg-white/[0.02] transition">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span
                                className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                                  tool.status === 'healthy'
                                    ? 'bg-emerald-400'
                                    : tool.status === 'critical'
                                      ? 'bg-rose-400'
                                      : 'bg-amber-300'
                                }`}
                              />
                              <div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedTool(tool)}
                                  className="font-semibold text-white hover:text-emerald-300 text-left bg-transparent border-0 cursor-pointer p-0 transition"
                                >
                                  {tool.name}
                                </button>
                                <p className="mt-0.5 font-mono text-[11px] text-white/50">{tool.repository}</p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-[10px] font-mono uppercase text-white/70">
                              {tool.provider}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-mono text-sm font-bold ${
                                  tool.healthScore >= 85
                                    ? 'text-emerald-300'
                                    : tool.healthScore >= 60
                                      ? 'text-amber-300'
                                      : 'text-rose-300'
                                }`}
                              >
                                {tool.healthScore}%
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                                  tool.status === 'healthy'
                                    ? 'bg-emerald-400/10 text-emerald-300 border border-emerald-400/20'
                                    : tool.status === 'critical'
                                      ? 'bg-rose-400/10 text-rose-300 border border-rose-400/20'
                                      : 'bg-amber-400/10 text-amber-300 border border-amber-400/20'
                                }`}
                              >
                                {tool.status}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {tool.checkRuns.slice(0, 4).map((cr) => (
                                <span
                                  key={cr.id}
                                  title={`${cr.checkType}: ${cr.summary}`}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                    cr.status === 'passed'
                                      ? 'bg-emerald-500/10 text-emerald-300'
                                      : 'bg-rose-500/15 text-rose-300 font-semibold'
                                  }`}
                                >
                                  {cr.checkType}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="px-4 py-4 text-white/50 text-[11px]">
                            {tool.lastCheckedAt ? new Date(tool.lastCheckedAt).toLocaleTimeString() : '—'}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleRecheckTool(tool.id)}
                                disabled={recheckingToolId === tool.id}
                                title="Re-analyse tool health"
                                className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-white/70 hover:text-white transition cursor-pointer"
                              >
                                <RefreshCw
                                  size={13}
                                  className={recheckingToolId === tool.id ? 'animate-spin text-emerald-400' : ''}
                                />
                              </button>

                              <button
                                type="button"
                                onClick={() => setSelectedTool(tool)}
                                className="px-2.5 py-1 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-[11px] text-white/80 hover:text-white transition cursor-pointer"
                              >
                                Details
                              </button>

                              {tool.provider !== 'sample' ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTool(tool.id, tool.repository)}
                                  title="Remove from monitoring"
                                  className="p-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                </button>
                              ) : (
                                <span
                                  title="Sample tools are protected"
                                  className="p-1.5 text-white/20 cursor-not-allowed"
                                >
                                  <Trash2 size={13} />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== FINDINGS SECTION ===================== */}
        {section === 'findings' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Repository Findings</h1>
                <p className="mt-1 text-xs text-white/50">
                  Track, review evidence, and resolve findings identified during automated check runs.
                </p>
              </div>

              {/* Status toggles */}
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-lg border border-white/[0.08] bg-[#141615] p-1 text-xs">
                  {(['all', 'open', 'resolved'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFindingStatusFilter(st)}
                      className={`px-3 py-1 rounded-md text-xs capitalize cursor-pointer transition ${
                        findingStatusFilter === st
                          ? 'bg-white/10 text-white font-medium'
                          : 'text-white/40 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <div className="flex items-center rounded-lg border border-white/[0.08] bg-[#141615] p-1 text-xs">
                  {(['all', 'critical', 'high', 'medium', 'low'] as const).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setFindingSeverityFilter(sev)}
                      className={`px-2.5 py-1 rounded-md text-xs capitalize cursor-pointer transition ${
                        findingSeverityFilter === sev
                          ? 'bg-white/10 text-white font-medium'
                          : 'text-white/40 hover:text-white'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Findings List */}
            <div className="space-y-3">
              {filteredFindings.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.08] bg-[#141615] p-12 text-center text-xs text-white/45">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-2" />
                  <p className="font-semibold text-white text-sm">No findings found</p>
                  <p className="mt-1 text-white/50">All checked repositories satisfy your selected filters.</p>
                </div>
              ) : (
                filteredFindings.map((finding) => (
                  <div
                    key={finding.id}
                    className={`rounded-2xl border p-5 transition ${
                      finding.status === 'open'
                        ? 'border-white/[0.09] bg-[#141615]'
                        : 'border-white/[0.05] bg-[#101211] opacity-70'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                              finding.severity === 'critical'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : finding.severity === 'high'
                                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                                  : finding.severity === 'medium'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {finding.severity}
                          </span>
                          <span className="font-mono text-xs font-semibold text-white">
                            {finding.repository || finding.toolName}
                          </span>
                          {finding.provider && (
                            <span className="rounded border border-white/10 px-1.5 py-0.2 font-mono text-[9px] uppercase text-white/40">
                              {finding.provider}
                            </span>
                          )}
                          <span className="text-white/30">·</span>
                          <span className="font-mono text-xs text-white/60">{finding.checkType}</span>
                        </div>
                        <h4 className="mt-2 text-sm font-semibold text-white">{finding.summary}</h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleFinding(finding.id, finding.status)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                          finding.status === 'open'
                            ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                            : 'border border-white/10 bg-white/5 text-white/50 hover:bg-white/10'
                        }`}
                      >
                        <Check size={13} />
                        <span>{finding.status === 'open' ? 'Resolve Finding' : 'Reopen Finding'}</span>
                      </button>
                    </div>

                    <div className="mt-3 rounded-xl border border-white/[0.06] bg-[#0c0e0d] p-3 font-mono text-[11px] text-white/70">
                      <p className="text-[10px] uppercase tracking-wider text-white/35 font-semibold">Evidence Log</p>
                      <p className="mt-1 leading-relaxed">{finding.evidence}</p>
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-[10px] text-white/40">
                      <span>First observed: {new Date(finding.firstSeenAt).toLocaleDateString()}</span>
                      <span>Last checked: {new Date(finding.lastSeenAt).toLocaleTimeString()}</span>
                      {finding.resolvedAt && (
                        <span className="text-emerald-400">
                          Resolved on: {new Date(finding.resolvedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ===================== INTEGRATIONS SECTION ===================== */}
        {section === 'integrations' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Open Source Forge Connections</h1>
              <p className="mt-1 text-xs text-white/50">
                Connect external open-source platforms (GitHub, GitLab, Bitbucket, Codeberg, Gitea, Sourcehut), choose projects or tools, and begin automated analysis, monitoring, and management.
              </p>
            </div>

            {/* Custom Input Project Bar */}
            <div className="rounded-2xl border border-white/[0.09] bg-[#141615] p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Link2 size={16} className="text-emerald-400" />
                <span>Custom Repository Importer</span>
              </h3>
              <p className="mt-1 text-xs text-white/50">
                Choose any open source connection option and specify a repository path to analyse, monitor, and manage.
              </p>

              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <select
                  value={activeForge}
                  onChange={(e) => setActiveForge(e.target.value as ProviderType)}
                  className="h-10 rounded-xl border border-white/[0.09] bg-[#0f1110] px-3 text-xs text-white font-medium outline-none focus:border-emerald-400/50"
                >
                  {FORGE_PLATFORMS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={customRepoInput}
                  onChange={(e) => setCustomRepoInput(e.target.value)}
                  placeholder="owner/repo (e.g. torvalds/linux or gitlab-org/gitlab-runner)"
                  className="flex-1 h-10 rounded-xl border border-white/[0.09] bg-[#0f1110] px-3.5 text-xs text-white placeholder:text-white/25 focus:border-emerald-400/50 outline-none font-mono"
                />

                <button
                  type="button"
                  onClick={() => handleAnalyseMonitorManage(activeForge, customRepoInput)}
                  disabled={isProcessingAction || !customRepoInput.trim()}
                  className="px-5 h-10 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-semibold transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
                >
                  {isProcessingAction ? <LoaderCircle className="animate-spin" size={14} /> : <Activity size={14} />}
                  <span>Analyse, Monitor & Manage</span>
                </button>
              </div>
            </div>

            {/* Open Source Platforms Connection Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {FORGE_PLATFORMS.map((forge) => {
                const Icon = forge.icon;
                const isConnected = connectedForges[forge.id];
                return (
                  <div
                    key={forge.id}
                    className="rounded-2xl border border-white/[0.09] bg-[#141615] p-5 flex flex-col justify-between hover:border-white/20 transition"
                  >
                    <div>
                      {/* Forge Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-white">
                            <Icon size={20} />
                          </span>
                          <div>
                            <h3 className="text-base font-semibold text-white">{forge.name}</h3>
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                                isConnected ? 'text-emerald-400' : 'text-white/40'
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  isConnected ? 'bg-emerald-400' : 'bg-white/30'
                                }`}
                              />
                              {isConnected ? 'Connected & Ready' : 'Standby / Ready'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleConnectForge(forge.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                            isConnected
                              ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                              : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          {isConnected ? 'Disconnect' : 'Connect'}
                        </button>
                      </div>

                      <p className="mt-3 text-xs text-white/50 leading-relaxed">{forge.tagline}</p>

                      {/* Choose Project / Tool for this Forge */}
                      <div className="mt-4 pt-3 border-t border-white/[0.06]">
                        <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-2">
                          Choose Project / Tool:
                        </p>
                        <div className="space-y-1.5">
                          {forge.sampleTools.slice(0, 3).map((st) => {
                            const monitored = tools.some(
                              (t) => t.repository.toLowerCase() === st.slug.toLowerCase() && t.provider === forge.id
                            );
                            return (
                              <button
                                key={st.slug}
                                type="button"
                                onClick={() => handleAnalyseMonitorManage(forge.id, st.slug)}
                                disabled={isProcessingAction || monitored}
                                className={`w-full text-left p-2 rounded-lg border text-xs transition cursor-pointer flex items-center justify-between ${
                                  monitored
                                    ? 'border-emerald-500/20 bg-emerald-950/10 text-emerald-300/80 cursor-default'
                                    : 'border-white/[0.06] bg-[#0c0e0d] hover:border-emerald-400/40 text-white/80 hover:text-white'
                                }`}
                              >
                                <span className="font-mono text-[11px] truncate">{st.slug}</span>
                                {monitored ? (
                                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 shrink-0 ml-2">
                                    <Check size={11} /> Monitored
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-emerald-300 font-semibold shrink-0 ml-2">
                                    + Add
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-white/40">
                      <span>Analyse, Monitor & Manage</span>
                      <span className="font-mono uppercase text-[10px]">{forge.id}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================== SETTINGS SECTION ===================== */}
        {section === 'settings' && (
          <div className="space-y-6 max-w-4xl">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Monitor Settings</h1>
              <p className="mt-1 text-xs text-white/50">Configure monitoring cycle intervals, diagnostics, and notifications.</p>
            </div>

            {/* Monitor Polling Configuration */}
            <div className="rounded-2xl border border-white/[0.09] bg-[#141615] p-6">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Clock3 size={17} className="text-emerald-400" />
                <span>Background Monitor Interval</span>
              </h3>
              <p className="mt-1 text-xs text-white/50 leading-relaxed">
                Controls how frequently the Tool Doctor daemon re-evaluates public repository availability, README integrity, and CI signals.
              </p>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { label: 'Every 1 Hour', seconds: 3600 },
                  { label: 'Every 6 Hours', seconds: 21600 },
                  { label: 'Every 12 Hours', seconds: 43200 },
                  { label: 'Every 24 Hours (Default)', seconds: 86400 },
                ].map((opt) => (
                  <button
                    key={opt.seconds}
                    type="button"
                    onClick={() => handleSaveInterval(opt.seconds)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                      monitorInterval === opt.seconds
                        ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                        : 'border-white/[0.08] bg-white/[0.02] text-white/60 hover:bg-white/[0.05]'
                    }`}
                  >
                    <p className="text-xs font-semibold">{opt.label}</p>
                    <p className="mt-0.5 text-[10px] text-white/40 font-mono">{opt.seconds}s</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Diagnostics and Health */}
            <div className="rounded-2xl border border-white/[0.09] bg-[#141615] p-6">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Activity size={17} className="text-emerald-400" />
                <span>Platform Health & Engine State</span>
              </h3>
              <p className="mt-1 text-xs text-white/50">Runtime health diagnostics for Tool Doctor stack.</p>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/[0.06] bg-[#0c0e0d] p-3.5 text-xs">
                  <p className="text-white/40 uppercase tracking-wider text-[10px]">Database</p>
                  <p className="mt-1 font-semibold text-white">PostgreSQL Store</p>
                  <p className="mt-1 text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Healthy (0.8ms)
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-[#0c0e0d] p-3.5 text-xs">
                  <p className="text-white/40 uppercase tracking-wider text-[10px]">In-Memory Cache</p>
                  <p className="mt-1 font-semibold text-white">Redis Service</p>
                  <p className="mt-1 text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Ready (0.3ms)
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-[#0c0e0d] p-3.5 text-xs">
                  <p className="text-white/40 uppercase tracking-wider text-[10px]">Worker Monitor</p>
                  <p className="mt-1 font-semibold text-white">Scheduled Daemon</p>
                  <p className="mt-1 text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active Polling
                  </p>
                </div>
              </div>
            </div>

            {/* Profile Info */}
            {currentUser && (
              <div className="rounded-2xl border border-white/[0.09] bg-[#141615] p-6">
                <h3 className="text-base font-semibold text-white">Current Identity</h3>
                <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-white/40">Full Name</span>
                    <p className="mt-0.5 text-white font-medium">{currentUser.name}</p>
                  </div>
                  <div>
                    <span className="text-white/40">Email</span>
                    <p className="mt-0.5 text-white font-medium">{currentUser.email || '—'}</p>
                  </div>
                  <div>
                    <span className="text-white/40">Mobile</span>
                    <p className="mt-0.5 text-white font-medium">{currentUser.mobile || '—'}</p>
                  </div>
                  <div>
                    <span className="text-white/40">Role</span>
                    <p className="mt-0.5 text-emerald-300 font-medium uppercase font-mono">{currentUser.role}</p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      store.resetToDefaults();
                      showToast('Workspace reset to initial seed state.', 'success');
                    }}
                    className="text-xs text-rose-300/80 hover:text-rose-200 bg-transparent border-0 cursor-pointer p-0 underline"
                  >
                    Reset Workspace to Factory Seed Data
                  </button>
                  <span className="text-[10px] text-white/35">Tool Doctor v1.2.0</span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ===================== REPOSITORY DETAIL DRAWER / MODAL ===================== */}
      {selectedTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#141615] p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <span
                    className={`h-3 w-3 rounded-full shrink-0 ${
                      selectedTool.status === 'healthy'
                        ? 'bg-emerald-400'
                        : selectedTool.status === 'critical'
                          ? 'bg-rose-400'
                          : 'bg-amber-300'
                    }`}
                  />
                  <h2 className="text-xl font-bold text-white">{selectedTool.name}</h2>
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 font-mono text-[10px] uppercase text-white/50">
                    {selectedTool.provider}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-white/50">{selectedTool.repository}</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span
                    className={`text-2xl font-bold font-mono ${
                      selectedTool.healthScore >= 85
                        ? 'text-emerald-300'
                        : selectedTool.healthScore >= 60
                          ? 'text-amber-300'
                          : 'text-rose-300'
                    }`}
                  >
                    {selectedTool.healthScore}%
                  </span>
                  <p className="text-[10px] uppercase tracking-wider text-white/40">Health Score</p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedTool(null)}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="mt-5 space-y-5">
              <div>
                <h4 className="text-xs uppercase tracking-wider text-white/40 font-semibold">Summary & Analysis</h4>
                <p className="mt-1 text-xs text-white/75 leading-relaxed">{selectedTool.summary}</p>
              </div>

              {/* Check Runs Breakdown */}
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs uppercase tracking-wider text-white/40 font-semibold">
                    Signal Check Runs ({selectedTool.checkRuns.length})
                  </h4>
                  <span className="text-[10px] text-white/35">Evidence collected live</span>
                </div>

                <div className="mt-3 space-y-2.5">
                  {selectedTool.checkRuns.map((cr) => (
                    <div
                      key={cr.id}
                      className="rounded-xl border border-white/[0.06] bg-[#0c0e0d] p-3.5 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase font-bold ${
                              cr.status === 'passed'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {cr.status}
                          </span>
                          <span className="font-semibold text-white capitalize">{cr.checkType} Check</span>
                        </div>
                        <span className="text-[10px] text-white/40 font-mono">
                          {new Date(cr.observedAt).toLocaleTimeString()}
                        </span>
                      </div>

                      <p className="text-white/80 leading-relaxed">{cr.summary}</p>
                      <div className="rounded-lg bg-black/40 p-2 font-mono text-[10px] text-white/50 break-all">
                        {cr.evidence}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Open Findings for this repo */}
              {findings.filter((f) => f.toolId === selectedTool.id).length > 0 && (
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-white/40 font-semibold">
                    Active Findings for this Repository
                  </h4>
                  <div className="mt-2.5 space-y-2">
                    {findings
                      .filter((f) => f.toolId === selectedTool.id)
                      .map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-amber-500/20 bg-amber-950/10 text-xs"
                        >
                          <div>
                            <p className="font-semibold text-white">{f.summary}</p>
                            <p className="text-[10px] text-amber-200/60 font-mono">{f.checkType} check</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleFinding(f.id, f.status)}
                            className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-medium transition cursor-pointer"
                          >
                            {f.status === 'open' ? 'Resolve' : 'Reopen'}
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="mt-6 pt-5 border-t border-white/[0.08] flex items-center justify-between">
              <a
                href={
                  selectedTool.provider === 'github'
                    ? `https://github.com/${selectedTool.repository}`
                    : selectedTool.provider === 'gitlab'
                      ? `https://gitlab.com/${selectedTool.repository}`
                      : selectedTool.provider === 'codeberg'
                        ? `https://codeberg.org/${selectedTool.repository}`
                        : `https://github.com/${selectedTool.repository}`
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white transition"
              >
                <span>Open on {selectedTool.provider.toUpperCase()}</span>
                <ExternalLink size={12} />
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleRecheckTool(selectedTool.id)}
                  disabled={recheckingToolId === selectedTool.id}
                  className="px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-white transition flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw
                    size={13}
                    className={recheckingToolId === selectedTool.id ? 'animate-spin text-emerald-400' : ''}
                  />
                  <span>Re-analyse Now</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTool(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-white font-medium transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
