import React, { useState, useEffect } from 'react';
import {
  Activity,
  ArrowLeft,
  Shield,
  UserCheck,
  Search,
  RotateCw,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { ToolDoctorStore } from '../services/store';
import { User } from '../types';

interface AdminPageProps {
  onNavigate: (path: string) => void;
}

const videoUrl =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_104303_0c6d60b2-9353-408e-9449-585108a22fb5.mp4';
const posterUrl =
  'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/130837c4-0244-4f37-9c61-8d801d93fd29.jpg';

export const AdminPage: React.FC<AdminPageProps> = ({ onNavigate }) => {
  const store = ToolDoctorStore.get();
  const [users, setUsers] = useState<User[]>(store.getUsers());
  const [currentUser, setCurrentUser] = useState<User | null>(store.getCurrentUser());
  const [searchTerm, setSearchTerm] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    return store.subscribe(() => {
      setUsers(store.getUsers());
      setCurrentUser(store.getCurrentUser());
    });
  }, [store]);

  const filteredUsers = users.filter((u) => {
    const q = searchTerm.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.organization && u.organization.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const handleToggleRole = (user: User) => {
    const newRole = user.role === 'admin' ? 'developer' : 'admin';
    store.updateUserRole(user.id, newRole);
    setNotice(`Updated ${user.name}'s role to ${newRole.toUpperCase()}.`);
    setTimeout(() => setNotice(null), 3000);
  };

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const devCount = users.filter((u) => u.role === 'developer').length;

  return (
    <main className="relative min-h-screen bg-[#02060f] px-4 py-8 text-white sm:px-8 font-sans selection:bg-emerald-500/20">
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

      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="inline-flex items-center gap-2 text-xs text-white/45 hover:text-white bg-transparent border-0 cursor-pointer p-0 transition"
          >
            <ArrowLeft aria-hidden="true" size={14} /> Back to Workspace
          </button>
          {currentUser && (
            <div className="flex items-center gap-2 text-xs text-white/50">
              <span>Signed in as</span>
              <span className="text-white font-medium">{currentUser.name}</span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300 uppercase tracking-wider font-semibold">
                {currentUser.role}
              </span>
            </div>
          )}
        </div>

        <header className="mt-7 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
              <Shield aria-hidden="true" size={22} />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Administrator console</h1>
              <p className="mt-0.5 text-xs text-white/40">Manage and review registered Tool Doctor accounts.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#141615] px-3 py-1.5 text-xs text-white/60">
              <Users size={14} className="text-emerald-400" />
              <span>{users.length} Total Users</span>
              <span className="text-white/20">|</span>
              <span className="text-emerald-300">{adminCount} Admins</span>
              <span className="text-white/20">|</span>
              <span className="text-white/70">{devCount} Developers</span>
            </div>
          </div>
        </header>

        {notice && (
          <div className="mt-4 p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-xs text-emerald-300 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 size={15} />
            {notice}
          </div>
        )}

        <section className="mt-6 overflow-hidden rounded-xl border border-white/[0.08] bg-[#141615]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] p-5">
            <div>
              <h2 className="text-sm font-medium">Registered Accounts</h2>
              <p className="mt-0.5 text-xs text-white/40">{users.length} registered identities in identity store</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 text-white/30" size={14} />
                <input
                  type="text"
                  placeholder="Search accounts…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 w-56 rounded-lg border border-white/[0.08] bg-[#0f1110] pl-8 pr-3 text-xs text-white placeholder:text-white/25 focus:border-emerald-300/40 outline-none"
                />
              </div>
              <Activity aria-hidden="true" className="text-emerald-300/60" size={17} />
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <p className="p-8 text-center text-sm text-white/45">No accounts matching criteria.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b border-white/[0.06] bg-white/[0.02] text-[10px] uppercase tracking-wider text-white/35">
                  <tr>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Mobile</th>
                    <th className="px-4 py-3 font-medium">Organization / title</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-white/[0.02] transition">
                      <td className="px-5 py-4 font-medium text-white/90">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-semibold text-white/70">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <p className="font-medium text-white">{user.name}</p>
                            <p className="text-[10px] text-white/35 font-mono">{user.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-white/70">{user.email ?? '—'}</td>
                      <td className="px-4 py-4 text-white/60">{user.mobile ?? '—'}</td>
                      <td className="px-4 py-4 text-white/60">
                        {[user.organization, user.jobTitle].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-wide ${
                            user.role === 'admin'
                              ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200'
                              : 'border-white/[0.08] bg-white/[0.03] text-white/60'
                          }`}
                        >
                          {user.role === 'admin' && <Shield size={10} />}
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-white/45">
                        {new Date(user.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleRole(user)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/[0.08] hover:text-white transition cursor-pointer"
                        >
                          <RotateCw size={11} />
                          {user.role === 'admin' ? 'Demote to Developer' : 'Promote to Admin'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Admin Audit & Diagnostic Info */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/[0.08] bg-[#141615] p-4 text-xs">
            <p className="text-white/40 uppercase tracking-wider text-[10px] font-semibold">Database Persistence</p>
            <p className="mt-1 font-semibold text-white">Encrypted Workspace Store</p>
            <p className="mt-2 text-white/50 leading-relaxed">
              Account credentials hashed and sessions scoped to workspace boundary.
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#141615] p-4 text-xs">
            <p className="text-white/40 uppercase tracking-wider text-[10px] font-semibold">Role-Based Access</p>
            <p className="mt-1 font-semibold text-white">Multi-Role Enforcement</p>
            <p className="mt-2 text-white/50 leading-relaxed">
              Administrators hold elevated console permissions; public registrations create developer tier.
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#141615] p-4 text-xs">
            <p className="text-white/40 uppercase tracking-wider text-[10px] font-semibold">Scheduled Monitor</p>
            <p className="mt-1 font-semibold text-white">Active (24-Hour Cycle)</p>
            <p className="mt-2 text-white/50 leading-relaxed">
              Background workers poll repository availability, README integrity, and Actions health.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};
