"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const videoUrl =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_104303_0c6d60b2-9353-408e-9449-585108a22fb5.mp4";
const posterUrl =
  "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/130837c4-0244-4f37-9c61-8d801d93fd29.jpg";

const dashboardLinks = [
  { label: "About", href: "#about" },
  { label: "Product", href: "/dashboard" },
  { label: "Solutions", href: "/dashboard?section=integrations" }
];

function SoundToggle({
  soundOn,
  audioUnavailable,
  onToggle,
  mobile = false
}: {
  soundOn: boolean;
  audioUnavailable: string | null;
  onToggle: () => void;
  mobile?: boolean;
}) {
  const label = audioUnavailable
    ? "Ambient sound unavailable"
    : soundOn
      ? "Turn ambient sound off"
      : "Turn ambient sound on";

  return (
    <button
      aria-label={label}
      aria-pressed={soundOn}
      className={`sound-toggle${mobile ? " sound-toggle-mobile" : " sound-toggle-desktop"}`}
      onClick={onToggle}
      title={audioUnavailable ?? label}
      type="button"
    >
      <span aria-hidden="true" className={`sound-indicator${soundOn ? " is-playing" : ""}`}>
        <i />
        <i />
        <i />
      </span>
      <span className={mobile ? "sr-only" : undefined}>
        {audioUnavailable ? "Sound unavailable" : soundOn ? "Sound on" : "Sound off"}
      </span>
    </button>
  );
}

export function LandingPage() {
  const [soundOn, setSoundOn] = useState(false);
  const [audioUnavailable, setAudioUnavailable] = useState<string | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const navToggle = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const video = document.querySelector<HTMLVideoElement>("video.art");
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
      query.addEventListener("change", syncVideo);
      return () => query.removeEventListener("change", syncVideo);
    }
    query.addListener(syncVideo);
    return () => query.removeListener(syncVideo);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const lastEntrance = document.querySelector("#foot2");
    let finished = false;
    let timeout: number;

    const done = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      lastEntrance?.removeEventListener("animationend", done);
      root.classList.add("is-entered");
    };

    lastEntrance?.addEventListener("animationend", done);
    timeout = window.setTimeout(done, 4000);
    return () => {
      window.clearTimeout(timeout);
      lastEntrance?.removeEventListener("animationend", done);
    };
  }, []);

  useEffect(
    () => () => {
      if (audioContext.current && audioContext.current.state !== "closed") {
        void audioContext.current.close();
      }
    },
    []
  );

  const toggleSound = async () => {
    if (soundOn) {
      const context = audioContext.current;
      audioContext.current = null;
      setSoundOn(false);
      if (context && context.state !== "closed") await context.close();
      return;
    }

    if (!("AudioContext" in window)) {
      setAudioUnavailable("This browser does not support ambient audio.");
      return;
    }

    let context: AudioContext | null = null;
    try {
      const activeContext = new window.AudioContext();
      context = activeContext;
      await activeContext.resume();
      if (activeContext.state !== "running") {
        throw new Error("The browser did not allow audio playback. Try pressing the sound button again.");
      }

      const compressor = activeContext.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-18, activeContext.currentTime);
      compressor.knee.setValueAtTime(12, activeContext.currentTime);
      compressor.ratio.setValueAtTime(4, activeContext.currentTime);
      compressor.attack.setValueAtTime(0.01, activeContext.currentTime);
      compressor.release.setValueAtTime(0.2, activeContext.currentTime);

      const master = activeContext.createGain();
      master.gain.setValueAtTime(0, activeContext.currentTime);
      master.gain.linearRampToValueAtTime(0.32, activeContext.currentTime + 0.5);
      master.connect(compressor);
      compressor.connect(activeContext.destination);

      [
        { frequency: 110, volume: 0.5 },
        { frequency: 164.81, volume: 0.32 },
        { frequency: 220, volume: 0.22 },
        { frequency: 329.63, volume: 0.14 },
        { frequency: 440, volume: 0.08 }
      ].forEach(({ frequency, volume }) => {
        const oscillator = activeContext.createOscillator();
        const voice = activeContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        voice.gain.value = volume;
        oscillator.connect(voice);
        voice.connect(master);
        oscillator.start();
      });

      audioContext.current = activeContext;
      setAudioUnavailable(null);
      setSoundOn(true);
    } catch (error) {
      if (context && context.state !== "closed") void context.close();
      setAudioUnavailable(
        error instanceof Error ? error.message : "Ambient sound could not be started."
      );
    }
  };

  const closeMobileMenu = () => {
    if (navToggle.current) navToggle.current.checked = false;
  };

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
        <Link aria-label="Tool Doctor home" className="brand" href="/">
          <svg aria-hidden="true" viewBox="0 0 23 17">
            <path d="M8.15 0.9 4.55 0.9 0.5 9.3 4.1 9.3Z" />
            <path d="M17 0 13.4 0 6.15 16.4 9.75 16.4Z" />
            <path d="M22.9 0 19.3 0 15 7.6 18.6 7.6Z" />
            <path d="m22.6 6.9-3.6 0-4.95 9.5h3.6Z" />
          </svg>
          <span id="word">TOOL DOCTOR</span>
        </Link>

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
          <SoundToggle
            audioUnavailable={audioUnavailable}
            mobile
            onToggle={() => void toggleSound()}
            soundOn={soundOn}
          />
        </div>

        <div className="navpanel">
          <nav aria-label="Main navigation" className="menu">
            {dashboardLinks.map(({ href, label }) => (
              <Link href={href} key={label} onClick={closeMobileMenu}>
                <span>{label}</span>
                {label === "Solutions" && (
                  <svg aria-hidden="true" className="caret" viewBox="0 0 9 6">
                    <path d="m.7 1.1 3.8 3.5 3.8-3.5" />
                  </svg>
                )}
              </Link>
            ))}
          </nav>
          <Link className="login" href="/login" onClick={closeMobileMenu}>
            <span>Sign in</span>
            <svg aria-hidden="true" className="navarrow" viewBox="0 0 10 9">
              <path d="M0 4.5h9.1M5.4.9l3.8 3.6-3.8 3.6" />
            </svg>
          </Link>
          <Link className="pill" href="/dashboard?section=integrations" onClick={closeMobileMenu}>
            <span>Explore integrations</span>
          </Link>
        </div>
      </header>

      <main className="hero" id="about">
        <h1 className="title">
          <span id="h1a">Repository health, in focus.</span>
          <span id="h1b">Know what needs attention.</span>
        </h1>
        <p className="sub">
          <span id="sub1">A calmer way to understand your repositories</span>
          <span id="sub2">and keep your team moving.</span>
        </p>
        <Link className="cta" href="/dashboard" onClick={closeMobileMenu}>
          <span id="cta">Explore your workspace</span>
          <svg aria-hidden="true" className="arrow" viewBox="0 0 16 11">
            <path d="M0 5.5h14.6m-4.3-4.3 4.6 4.3-4.6 4.3" />
          </svg>
        </Link>
        <ul aria-label="What you can do" className="feats" id="product">
          {[
            "Repository overview",
            "Signals at a glance",
            "Public GitHub import",
            "A clearer roadmap"
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
        <span id="foot1">Built for teams who care about what they ship.</span>
        <span id="foot2">Tool Doctor · Hacktoberfest</span>
      </footer>

      <SoundToggle
        audioUnavailable={audioUnavailable}
        onToggle={() => void toggleSound()}
        soundOn={soundOn}
      />
    </div>
  );
}
