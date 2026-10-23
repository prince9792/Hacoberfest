"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, LoaderCircle, Shield } from "lucide-react";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/graphql")
  .replace(/\/graphql\/?$/, "");

type AdminUser = {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  organization: string | null;
  jobTitle: string | null;
  role: string;
  createdAt: string;
};

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch(`${apiBaseUrl}/auth/admin/users`, {
      credentials: "include",
      cache: "no-store",
    }).then(async (response) => {
      if (response.status === 401) {
        window.location.replace("/login?next=%2Fadmin");
        return;
      }
      const result = (await response.json()) as { error?: string; users?: AdminUser[] };
      if (response.status === 403) {
        window.location.replace("/dashboard");
        return;
      }
      if (!response.ok) throw new Error(result.error ?? "Could not load administrator data.");
      if (active) setUsers(result.users ?? []);
    }).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : "Could not load administrator data.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#0d0f0e] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link className="inline-flex items-center gap-2 text-xs text-white/45 hover:text-white" href="/dashboard">
          <ArrowLeft aria-hidden="true" size={14} /> Workspace
        </Link>
        <header className="mt-7 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
            <Shield aria-hidden="true" size={19} />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Administrator console</h1>
            <p className="mt-1 text-xs text-white/40">Manage and review registered Tool Doctor accounts.</p>
          </div>
        </header>
        <section className="mt-7 overflow-hidden rounded-xl border border-white/[0.08] bg-[#141615]">
          <div className="flex items-center justify-between border-b border-white/[0.07] p-5">
            <div>
              <h2 className="text-sm font-medium">Accounts</h2>
              <p className="mt-1 text-xs text-white/40">{users.length} registered users</p>
            </div>
            <Activity aria-hidden="true" className="text-emerald-200/60" size={17} />
          </div>
          {loading ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-white/45">
              <LoaderCircle aria-hidden="true" className="animate-spin" size={16} /> Loading accounts…
            </div>
          ) : error ? (
            <p className="p-5 text-sm text-rose-100/80" role="alert">{error}</p>
          ) : users.length === 0 ? (
            <p className="p-5 text-sm text-white/45">No accounts are registered.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wide text-white/35">
                  <tr>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Mobile</th>
                    <th className="px-4 py-3 font-medium">Organization / title</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-5 py-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-5 py-4 text-white/80">{user.name || "—"}</td>
                      <td className="px-4 py-4 text-white/60">{user.email ?? "—"}</td>
                      <td className="px-4 py-4 text-white/60">{user.mobile ?? "—"}</td>
                      <td className="px-4 py-4 text-white/60">{[user.organization, user.jobTitle].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full border px-2 py-1 text-[10px] ${user.role === "admin" ? "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100" : "border-white/[0.08] text-white/50"}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-white/45">{new Date(user.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
