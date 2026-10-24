import React, { useEffect, useRef, useState } from 'react';
import { ambientAudio } from '../services/audio';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

const videoUrl =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_104303_0c6d60b2-9353-408e-9449-585108a22fb5.mp4';
const posterUrl =
  'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/130837c4-0244-4f37-9c61-8d801d93fd29.jpg';

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const [soundOn, setSoundOn] = useState(false);
  const [audioUnavailable, setAudioUnavailable] = useState<string | null>(null);
  const navToggle = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const video = document.querySelector<HTMLVideoElement>('video.art');
    if (!video) return;

    const syncVideo = () => {
      if (query.matches) {
        video.pause();
      } else {
        const playback = video.play();
        if (playback) void playback.catch(() => {});
      }
    };

    syncVideo();
    if (query.addEventListener) {
      query.addEventListener('change', syncVideo);
      return () => query.removeEventListener('change', syncVideo);
    }
    query.addListener(syncVideo);
    return () => query.removeListener(syncVideo);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const lastEntrance = document.querySelector('#foot2');
    let finished = false;
    let timeout: number;

    const done = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      lastEntrance?.removeEventListener('animationend', done);
      root.classList.add('is-entered');
    };

    lastEntrance?.addEventListener('animationend', done);
    timeout = window.setTimeout(done, 4000);
    return () => {
      window.clearTimeout(timeout);
      lastEntrance?.removeEventListener('animationend', done);
    };
  }, []);

  const toggleSound = async () => {
    const res = await ambientAudio.toggle();
    setSoundOn(res.isPlaying);
    if (res.error) {
      setAudioUnavailable(res.error);
    } else {
      setAudioUnavailable(null);
    }
  };

  const closeMobileMenu = () => {
    if (navToggle.current) navToggle.current.checked = false;
  };

  const soundLabel = audioUnavailable
    ? 'Ambient sound unavailable'
    : soundOn
      ? 'Turn ambient sound off'
      : 'Turn ambient sound on';

  return (
    <div className="landing-page">
      <video
        aria-hidden="true"
        autoPlay
        className="art"
        loop
        muted
        playsInline
        poster={posterUrl}
        preload="auto"
        src={videoUrl}
      />
      <div aria-hidden="true" className="veil" />

      <header className="landing-bar">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          aria-label="Tool Doctor home"
          className="brand bg-transparent border-0 cursor-pointer p-0 text-left"
        >
          <svg aria-hidden="true" viewBox="0 0 23 17">
            <path d="M8.15 0.9 4.55 0.9 0.5 9.3 4.1 9.3Z" />
            <path d="M17 0 13.4 0 6.15 16.4 9.75 16.4Z" />
            <path d="M22.9 0 19.3 0 15 7.6 18.6 7.6Z" />
            <path d="m22.6 6.9-3.6 0-4.95 9.5h3.6Z" />
          </svg>
          <span id="word">TOOL DOCTOR</span>
        </button>

        <input
          aria-label="Toggle navigation"
          className="navtoggle"
          id="nav-open"
          ref={navToggle}
          type="checkbox"
        />
        <label aria-hidden="true" className="scrim" htmlFor="nav-open" />
        <div className="header-controls">
          <label aria-label="Menu" className="burger" htmlFor="nav-open">
            <svg aria-hidden="true" viewBox="0 0 22 14">
              <path className="b1" d="M1 1h20" />
              <path className="b2" d="M1 7h20" />
              <path className="b3" d="M1 13h20" />
            </svg>
          </label>
          <button
            type="button"
            aria-label={soundLabel}
            aria-pressed={soundOn}
            className="sound-toggle sound-toggle-mobile"
            onClick={() => void toggleSound()}
            title={audioUnavailable ?? soundLabel}
          >
            <span aria-hidden="true" className={`sound-indicator${soundOn ? ' is-playing' : ''}`}>
              <i />
              <i />
              <i />
            </span>
          </button>
        </div>

        <div className="navpanel">
          <nav aria-label="Main navigation" className="menu">
            <button
              type="button"
              onClick={() => {
                closeMobileMenu();
                onNavigate('/about');
              }}
              className="bg-transparent border-0 cursor-pointer text-left p-0"
            >
              <span id="about">About</span>
            </button>
            <button
              type="button"
              onClick={() => {
                closeMobileMenu();
                onNavigate('/dashboard');
              }}
              className="bg-transparent border-0 cursor-pointer text-left p-0"
            >
              <span id="product">Workshop</span>
            </button>
            <button
              type="button"
              onClick={() => {
                closeMobileMenu();
                onNavigate('/dashboard?section=integrations');
              }}
              className="bg-transparent border-0 cursor-pointer text-left p-0 flex items-center"
            >
              <span id="solutions">Solutions</span>
              <svg aria-hidden="true" className="caret" viewBox="0 0 9 6">
                <path d="m.7 1.1 3.8 3.5 3.8-3.5" />
              </svg>
            </button>
          </nav>

          <button
            type="button"
            className="login bg-transparent border-0 cursor-pointer text-left"
            onClick={() => {
              closeMobileMenu();
              onNavigate('/login');
            }}
          >
            <span id="login">Log in / Register</span>
            <svg aria-hidden="true" className="navarrow" viewBox="0 0 10 9">
              <path d="M0 4.5h9.1M5.4.9l3.8 3.6-3.8 3.6" />
            </svg>
          </button>

          <button
            type="button"
            className="pill bg-transparent cursor-pointer"
            onClick={() => {
              closeMobileMenu();
              onNavigate('/dashboard?section=integrations');
            }}
          >
            <span id="contact">Open Source Connect</span>
          </button>
        </div>
      </header>

      <main className="hero" id="about">
        <h1 className="title">
          <span id="h1a">Analyse, Monitor & Manage.</span>
          <span id="h1b">Repository health, in focus.</span>
        </h1>
        <p className="sub">
          <span id="sub1">Connect GitHub, GitLab, Bitbucket & Codeberg tools.</span>
          <span id="sub2">Real-time signal analysis & automated health triage.</span>
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            className="cta cursor-pointer border-0"
            onClick={() => {
              closeMobileMenu();
              onNavigate('/dashboard');
            }}
          >
            <span id="cta">Enter Workshop</span>
            <svg aria-hidden="true" className="arrow" viewBox="0 0 16 11">
              <path d="M0 5.5h14.6m-4.3-4.3 4.6 4.3-4.6 4.3" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/register')}
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/20 bg-white/10 text-xs text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer backdrop-blur-md"
          >
            <span>Create account</span>
          </button>
        </div>

        <ul aria-label="What you can do" className="feats" id="product">
          {[
            'Analyse repo health',
            'Continuous monitoring',
            'Multi-forge connection',
            'Findings lifecycle',
          ].map((feature, index) => (
            <li key={feature}>
              <svg aria-hidden="true" className="chev" viewBox="0 0 11 20">
                <path d="m1.15 1.15 8.45 8.85-8.45 8.85" />
              </svg>
              <span id={`f${index + 1}`}>{feature}</span>
            </li>
          ))}
        </ul>
        <span aria-hidden="true" className="rule" />
      </main>

      <footer className="landing-footer">
        <span id="foot1">Built for engineering teams who care about what they ship.</span>
        <span id="foot2">
          <button
            type="button"
            onClick={() => onNavigate('/about')}
            className="border-0 bg-transparent p-0 text-inherit underline decoration-white/30 underline-offset-4 cursor-pointer"
          >
            About Tool Doctor
          </button>
          {' · '}Hacktoberfest Project
        </span>
      </footer>

      <button
        type="button"
        aria-label={soundLabel}
        aria-pressed={soundOn}
        className="sound-toggle sound-toggle-desktop"
        onClick={() => void toggleSound()}
        title={audioUnavailable ?? soundLabel}
      >
        <span aria-hidden="true" className={`sound-indicator${soundOn ? ' is-playing' : ''}`}>
          <i />
          <i />
          <i />
        </span>
        <span>
          {audioUnavailable ? 'Sound unavailable' : soundOn ? 'Sound on' : 'Sound off'}
        </span>
      </button>

    </div>
  );
};
