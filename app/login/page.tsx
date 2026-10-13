"use client";
import { useState } from "react";
import {
  ArrowRight,
  LockKeyhole,
  Eye,
  EyeOff,
  Layers,
  Columns2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      <section className="login-card" aria-labelledby="login-heading">
        <a className="brand" href="/">
          <img src="/logo.svg" alt="" width="40" height="40" />
          <span className="brand-name">
            SA <em>Studio</em>
          </span>
        </a>
        <div className="login-intro">
          <div className="login-badge">
            <LockKeyhole size={15} aria-hidden="true" />
            <span>Team Workspace</span>
          </div>
          <h1 id="login-heading">Your next iteration starts here.</h1>
          <p>
            Enter your team’s studio password to review designs, compare
            versions, and keep the developer handoff moving.
          </p>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="password">Studio password</label>
          <div className="password-field">
            <input
              id="password"
              autoFocus
              autoComplete="current-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter shared team password…"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? (
                <EyeOff size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
            </button>
          </div>
          {error && (
            <p className="form-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}
          <button
            className="primary login-submit"
            type="submit"
            disabled={busy}
          >
            <span>{busy ? "Signing in…" : "Enter studio"}</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </form>
        <div className="login-features" aria-label="Studio capabilities">
          <span>
            <Layers size={13} aria-hidden="true" /> Versioned HTML
          </span>
          <span>
            <Columns2 size={13} aria-hidden="true" /> Side-by-side diffs
          </span>
          <span>
            <CheckCircle2 size={13} aria-hidden="true" /> Dev handoff
          </span>
        </div>
        <small>One shared workspace for your product team.</small>
      </section>
    </main>
  );
}
