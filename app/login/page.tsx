"use client";
import { useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      window.location.assign("/");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sign in.");
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-card">
        <a className="brand" href="/">
          <img src="/logo.svg" alt="" width="40" height="40" />
          <span className="brand-name">
            SA <em>Studio</em>
          </span>
        </a>
        <div className="login-intro">
          <LockKeyhole size={20} />
          <h1>Your next iteration starts here.</h1>
          <p>
            Enter your team’s studio password to review designs, compare
            versions, and keep the handoff moving.
          </p>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="password">Studio password</label>
          <input
            id="password"
            autoFocus
            autoComplete="current-password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Signing in…" : "Enter studio"}
            <ArrowRight size={16} />
          </button>
        </form>
        <small>One shared workspace for your product team.</small>
      </section>
    </main>
  );
}
