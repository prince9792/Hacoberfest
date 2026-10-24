import React from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, GitBranch, Shield } from 'lucide-react';

interface AboutPageProps {
  onNavigate: (path: string) => void;
}

const focusAreas = [
  {
    title: 'Inspect',
    description:
      'Review repository availability, documentation, CI, release activity, and other available project signals.',
  },
  {
    title: 'Understand',
    description:
      'See findings with their evidence and timestamps. Missing data should be treated as unknown, not automatically as a failure.',
  },
  {
    title: 'Maintain',
    description:
      'Organize findings and follow-up work so maintainers can focus attention where it is useful.',
  },
];

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => (
  <main className="relative min-h-screen overflow-hidden bg-[#030712] px-5 py-8 text-white sm:px-8 sm:py-12">
    <div className="app-atmosphere" aria-hidden="true">
      <div className="veil-overlay" />
    </div>

    <div className="relative z-10 mx-auto max-w-4xl">
      <button
        type="button"
        onClick={() => onNavigate('/')}
        className="inline-flex items-center gap-2 border-0 bg-transparent p-0 text-sm text-white/60 transition hover:text-white"
      >
        <ArrowLeft aria-hidden="true" size={16} />
        Back to home
      </button>

      <header className="mt-12 max-w-3xl sm:mt-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
          About Tool Doctor
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
          Open-source project health, with evidence.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
          Tool Doctor helps maintainers review repository health signals, understand
          potential maintenance risks, and coordinate follow-up across code-hosting
          platforms. Findings are meant to inform people, not replace their judgment.
        </p>
      </header>

      <section aria-labelledby="about-focus" className="mt-12">
        <h2 id="about-focus" className="text-lg font-semibold">
          What it helps you do
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {focusAreas.map((area, index) => (
            <article
              key={area.title}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur"
            >
              <span className="text-xs font-semibold text-emerald-300">
                0{index + 1}
              </span>
              <h3 className="mt-3 text-base font-semibold">{area.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/55">{area.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="about-platforms" className="mt-12 grid gap-6 sm:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 id="about-platforms" className="flex items-center gap-2 font-semibold">
            <GitBranch aria-hidden="true" className="text-emerald-300" size={18} />
            Provider-neutral direction
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/55">
            The project is designed around provider adapters, so repository data can be
            normalized while each host’s capabilities and permissions remain explicit.
            Current integrations are a prototype and do not provide universal coverage.
          </p>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Shield aria-hidden="true" className="text-emerald-300" size={18} />
            Honest about its current state
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/55">
            The Flask API currently provides a health endpoint and an adapter contract.
            The dashboard still uses browser storage; authentication and persistent
            server-side data are not yet connected. Do not use real credentials in this
            prototype.
          </p>
        </article>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onNavigate('/register')}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-200"
        >
          Create an account
          <ArrowRight aria-hidden="true" size={16} />
        </button>
        <button
          type="button"
          onClick={() => onNavigate('/login')}
          className="rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10"
        >
          Sign in
        </button>
      </div>

      <p className="mt-10 border-t border-white/10 pt-5 text-xs text-white/35">
        Tool Doctor · Open-source maintenance project
      </p>
    </div>
  </main>
);
