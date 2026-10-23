"use client";

import { useEffect, useState } from "react";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/graphql")
  .replace(/\/graphql\/?$/, "");

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Finishing sign-in…");

  useEffect(() => {
    void fetch(`${apiBaseUrl}/auth/me`, { credentials: "include", cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("The provider sign-in could not be confirmed.");
        window.location.replace("/dashboard");
      })
      .catch(() => {
        setMessage("Sign-in could not be completed. Please try again.");
        window.setTimeout(() => window.location.replace("/login?error=oauth"), 1500);
      });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0d0f0e] px-4 text-sm text-white/60">
      <p role="status">{message}</p>
    </main>
  );
}
