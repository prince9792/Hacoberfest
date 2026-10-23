"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Github,
  GitBranch,
  LoaderCircle,
  Mail,
  Phone,
} from "lucide-react";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/graphql")
  .replace(/\/graphql\/?$/, "");

type AuthFormProps = { mode: "login" | "register" };
type AuthApiResponse = { error?: string; challengeId?: string; role?: string };
type Channel = "email" | "phone";
const inputClass =
  "mt-2 h-11 w-full rounded-lg border border-white/[0.09] bg-[#0f1110] px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-emerald-300/35";

export function AuthForm({ mode }: AuthFormProps) {
  const [channel, setChannel] = useState<Channel>("email");
  const [destination, setDestination] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otpMode, setOtpMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("error");
    if (reason) setError("Provider sign-in was cancelled or could not be verified. Please try again.");
  }, []);

  function afterLogin(role?: string) {
    const requestedNext = new URLSearchParams(window.location.search).get("next");
    const next =
      requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
        ? requestedNext
        : role === "admin"
          ? "/admin"
          : "/dashboard";
    window.location.replace(next);
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${apiBaseUrl}/auth/${mode === "register" ? "register" : "login"}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          mobile: form.get("mobile"),
          password: form.get("password"),
          organization: form.get("organization"),
          jobTitle: form.get("jobTitle"),
        }),
      });
      const result = (await response.json()) as AuthApiResponse;
      if (!response.ok) throw new Error(result.error ?? "Authentication could not be completed.");
      afterLogin(result.role);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Authentication could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/auth/otp/${challengeId ? "verify" : "request"}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(challengeId ? { challengeId, code } : { channel, destination }),
      });
      const result = (await response.json()) as AuthApiResponse;
      if (!response.ok) throw new Error(result.error ?? "Authentication could not be completed.");
      if (!challengeId) {
        if (!result.challengeId) throw new Error("The API did not create a verification challenge.");
        setChallengeId(result.challengeId);
      } else {
        const response = await fetch(`${apiBaseUrl}/auth/me`, {
          credentials: "include",
          cache: "no-store",
        });
        const identity = (await response.json()) as { user?: { role?: string } };
        afterLogin(identity.user?.role);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Authentication could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  const providerHref = (provider: "github" | "gitlab") =>
    `${apiBaseUrl}/auth/oauth/${provider}/start`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0d0f0e] px-4 py-10 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/[0.09] bg-[#141615] p-6 shadow-2xl shadow-black/20 sm:p-8">
        <Link className="inline-flex items-center gap-2 text-xs text-white/45 transition hover:text-white" href="/">
          <ArrowLeft aria-hidden="true" size={14} />
          Back to Tool Doctor
        </Link>
        <div className="mt-7 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
            <Activity aria-hidden="true" size={19} />
          </span>
          <div>
            <p className="text-sm font-semibold">tool doctor</p>
            <p className="mt-0.5 text-[11px] text-white/40">Your repository monitoring workspace</p>
          </div>
        </div>
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">
          {mode === "register" ? "Create your account" : "Sign in to your account"}
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-white/45">
          {mode === "register"
            ? "Create a developer account to monitor your repositories."
            : "Administrators and developers sign in here with their email and password."}
        </p>

        {mode === "login" && (
          <div className="mt-6 grid grid-cols-2 gap-2">
            <a className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/[0.08] text-xs text-white/70 transition hover:bg-white/[0.05]" href={providerHref("github")}>
              <Github aria-hidden="true" size={14} /> GitHub
            </a>
            <a className="flex h-10 items-center justify-center gap-2 rounded-lg border border-white/[0.08] text-xs text-white/70 transition hover:bg-white/[0.05]" href={providerHref("gitlab")}>
              <GitBranch aria-hidden="true" size={14} /> GitLab
            </a>
          </div>
        )}

        {mode === "login" && otpMode ? (
          <form className="mt-6 space-y-3" onSubmit={(event) => void submitOtp(event)}>
            {!challengeId && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {(["email", "phone"] as const).map((item) => (
                    <button
                      className={`flex h-10 items-center justify-center gap-2 rounded-lg border text-xs transition ${channel === item ? "border-emerald-300/30 bg-emerald-300/[0.07] text-emerald-100" : "border-white/[0.08] text-white/55 hover:bg-white/[0.04]"}`}
                      key={item}
                      onClick={() => setChannel(item)}
                      type="button"
                    >
                      {item === "email" ? <Mail aria-hidden="true" size={14} /> : <Phone aria-hidden="true" size={14} />}
                      {item === "email" ? "Email" : "Phone"}
                    </button>
                  ))}
                </div>
                <label className="block text-xs text-white/55">
                  {channel === "email" ? "Email address" : "Mobile number"}
                  <input className={inputClass} onChange={(event) => setDestination(event.target.value)} placeholder={channel === "email" ? "you@example.com" : "+14155550123"} required type={channel === "email" ? "email" : "tel"} value={destination} />
                </label>
              </>
            )}
            {challengeId && (
              <label className="block text-xs text-white/55">
                Verification code sent to {destination}
                <input autoComplete="one-time-code" className={`${inputClass} text-center font-mono tracking-[0.35em]`} inputMode="numeric" maxLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} pattern="[0-9]{6}" required value={code} />
              </label>
            )}
            {error && <p className="rounded-lg border border-rose-300/15 bg-rose-300/[0.05] px-3 py-2 text-xs text-rose-100/85" role="alert">{error}</p>}
            <button className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 text-sm font-medium text-[#102018] disabled:opacity-60" disabled={busy || (challengeId ? code.length !== 6 : !destination.trim())} type="submit">
              {busy && <LoaderCircle aria-hidden="true" className="animate-spin" size={15} />}
              {challengeId ? "Verify and continue" : "Send one-time code"}
            </button>
            <button className="w-full py-2 text-xs text-white/45 hover:text-white" onClick={() => { setOtpMode(false); setChallengeId(null); setError(null); }} type="button">
              Use email and password instead
            </button>
          </form>
        ) : (
          <form className="mt-6 space-y-3" onSubmit={(event) => void submitPassword(event)}>
            {mode === "register" && (
              <>
                <label className="block text-xs text-white/55">
                  Full name
                  <input autoComplete="name" className={inputClass} maxLength={120} minLength={2} name="name" placeholder="Your name" required />
                </label>
              </>
            )}
            <label className="block text-xs text-white/55">
              Email address
              <input autoComplete="email" className={inputClass} name="email" placeholder="you@example.com" required type="email" />
            </label>
            {mode === "register" && (
              <>
                <label className="block text-xs text-white/55">
                  Mobile number
                  <input autoComplete="tel" className={inputClass} name="mobile" placeholder="+14155550123" required type="tel" />
                </label>
                <label className="block text-xs text-white/55">
                  Organization <span className="text-white/30">(optional)</span>
                  <input autoComplete="organization" className={inputClass} maxLength={160} name="organization" placeholder="Company or team" />
                </label>
                <label className="block text-xs text-white/55">
                  Job title <span className="text-white/30">(optional)</span>
                  <input autoComplete="organization-title" className={inputClass} maxLength={120} name="jobTitle" placeholder="Developer, maintainer…" />
                </label>
              </>
            )}
            <label className="block text-xs text-white/55">
              Password
              <input autoComplete={mode === "register" ? "new-password" : "current-password"} className={inputClass} minLength={12} name="password" placeholder={mode === "register" ? "At least 12 characters" : "Your password"} required type="password" />
              {mode === "register" && <span className="mt-1 block text-[10px] text-white/30">Use at least 12 characters.</span>}
            </label>
            {error && <p className="rounded-lg border border-rose-300/15 bg-rose-300/[0.05] px-3 py-2 text-xs text-rose-100/85" role="alert">{error}</p>}
            <button className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 text-sm font-medium text-[#102018] disabled:opacity-60" disabled={busy} type="submit">
              {busy && <LoaderCircle aria-hidden="true" className="animate-spin" size={15} />}
              {mode === "register" ? "Create account" : "Sign in"}
            </button>
            {mode === "login" && (
              <button className="w-full py-2 text-xs text-white/45 hover:text-white" onClick={() => { setOtpMode(true); setError(null); }} type="button">
                Sign in with a one-time code instead
              </button>
            )}
          </form>
        )}

        <p className="mt-6 text-center text-xs text-white/40">
          {mode === "register" ? "Already have an account?" : "New to Tool Doctor?"}{" "}
          <Link className="text-emerald-200 hover:underline" href={mode === "register" ? "/login" : "/register"}>
            {mode === "register" ? "Sign in" : "Create an account"}
          </Link>
        </p>
        <p className="mt-5 text-center text-[10px] leading-relaxed text-white/25">
          {mode === "register"
            ? "Your account is created with the standard developer role. Administrator access is assigned separately."
            : "Admin access is granted to the administrator account configured by the workspace owner."}
        </p>
      </section>
    </main>
  );
}
