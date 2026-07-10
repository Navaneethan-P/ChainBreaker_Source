"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEMO_URL = "https://github.com/Navaneethan-P/Forge";

const FEATURES = [
  {
    label: "01",
    title: "SAST + Dependency Scan",
    desc: "Semgrep surfaces code-level weaknesses. pip-audit and npm audit detect vulnerable Python and Node.js packages — running in parallel for speed.",
  },
  {
    label: "02",
    title: "Multi-Language Code Graph",
    desc: "AST parser maps Python imports and JS/TS require() calls, routes and data flows into a live force-directed graph.",
  },
  {
    label: "03",
    title: "Attack-Chain Reasoning",
    desc: "Local LLM (Qwen2.5-Coder) reasons out realistic exploit paths with a confidence-check loop — not a fixed script.",
  },
  {
    label: "04",
    title: "Fix Suggestions Per Step",
    desc: "Every attack step includes a concrete, actionable fix — parameterized queries, env vars, auth guards — not generic advice.",
  },
];

const PIPELINE = [
  { label: "Scanner",       color: "var(--accent)" },
  { label: "Graph Builder", color: "var(--accent)" },
  { label: "Attack-Path",   color: "var(--critical)" },
  { label: "Impact Scorer", color: "var(--high)" },
  { label: "Report",        color: "var(--low)" },
];

export default function HomePage() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (url?: string) => {
    const target = (url || repoUrl).trim();
    if (!target) { setError("Please enter a GitHub repository URL."); return; }
    if (!target.startsWith("http")) { setError("URL must start with https://github.com/..."); return; }

    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_url: target }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to start analysis");
      }
      const data = await res.json();
      router.push(`/results/${data.run_id}`);
    } catch (err: any) {
      setError(err.message || "Connection error — is the backend running?");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen hero-gradient scanline flex flex-col">
      {/* ── NAV ──────────────────────────────────────────────── */}
      <nav className="nav-glass sticky top-0 z-50 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="font-display text-lg font-bold"
            style={{ color: "var(--accent)" }}
          >
            Attack Chain Mapper
          </span>
          <span
            className="badge badge-semgrep hidden sm:inline-flex"
            style={{ fontSize: "0.65rem" }}
          >
            Python + Node
          </span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://github.com/Navaneethan-P/Forge"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm transition-colors hidden sm:block"
            style={{ color: "var(--text-muted)" }}
          >
            GitHub →
          </a>
          <ThemeToggle />
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-3xl w-full text-center mb-10">
          {/* Live badge */}
          <div
            className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full text-xs font-mono"
            style={{
              background: "var(--accent-dim)",
              border: "1px solid var(--accent)",
              color: "var(--accent)",
            }}
          >
            <span className="w-2 h-2 rounded-full bg-current pulse-dot" />
            100% Open-Source · Local Analysis · Zero Paid APIs
          </div>

          <h1
            className="font-display text-5xl md:text-6xl font-bold mb-5 leading-tight"
            style={{ color: "var(--text-primary)" }}
          >
            One click.{" "}
            <span style={{ color: "var(--accent)" }}>System traces</span>{" "}
            how weaknesses chain into a{" "}
            <span style={{ color: "var(--critical)" }}>real attack.</span>
          </h1>

          <p
            className="text-base md:text-lg mb-2 leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Security scanners give you 40 flat CVEs. Attackers think in{" "}
            <strong style={{ color: "var(--text-primary)" }}>chains</strong> — one weakness
            opens the door to the next. Attack Chain Mapper runs an autonomous 5-agent pipeline
            across Python and Node.js code, with concrete fix suggestions for every step.
          </p>
        </div>

        {/* ── INPUT CARD ────────────────────────────────────── */}
        <div className="w-full max-w-2xl rounded-2xl p-6 md:p-8 mb-10 glass-panel">
          <label
            htmlFor="repo-url"
            className="block text-xs font-mono font-semibold mb-2 tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            GITHUB REPOSITORY URL
          </label>

          <div className="flex gap-2">
            <input
              id="repo-url"
              ref={inputRef}
              type="url"
              value={repoUrl}
              onChange={e => { setRepoUrl(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              placeholder="https://github.com/owner/repo"
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl font-mono text-sm input-glow"
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border-bright)",
                color: "var(--text-primary)",
              }}
            />
            <button
              id="analyze-btn"
              onClick={() => handleSubmit()}
              disabled={loading}
              className="btn-primary px-5 py-3 rounded-xl text-sm whitespace-nowrap"
              style={{ minWidth: "120px" }}
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Starting...
                </span>
              ) : (
                "Analyze"
              )}
            </button>
          </div>

          {error && (
            <p className="mt-2 text-xs font-mono" style={{ color: "var(--critical)" }}>
              {error}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Try demo repo:
            </span>
            <button
              id="demo-btn"
              onClick={() => { setRepoUrl(DEMO_URL); handleSubmit(DEMO_URL); }}
              className="text-xs font-mono transition-opacity hover:opacity-70"
              style={{ color: "var(--accent)" }}
              disabled={loading}
            >
              {DEMO_URL} →
            </button>
          </div>
        </div>

        {/* ── FEATURE GRID ──────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl w-full mb-12">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="rounded-xl p-5 chain-card-hover glass-card"
            >
              <div
                className="font-mono text-xs font-bold mb-3"
                style={{ color: "var(--accent)" }}
              >
                {f.label}
              </div>
              <div
                className="font-display font-semibold text-sm mb-1.5"
                style={{ color: "var(--text-primary)" }}
              >
                {f.title}
              </div>
              <div
                className="text-xs leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {f.desc}
              </div>
            </div>
          ))}
        </div>

        {/* ── PIPELINE FLOW ─────────────────────────────────── */}
        <div className="w-full max-w-4xl">
          <h2
            className="font-display text-center text-xs font-semibold mb-5 tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            5-AGENT AUTONOMOUS PIPELINE
          </h2>
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {PIPELINE.map((step, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div
                  className="px-3 py-2 rounded-lg text-xs font-mono font-semibold"
                  style={{
                    background: `${step.color}18`,
                    border: `1px solid ${step.color}40`,
                    color: step.color,
                  }}
                >
                  {step.label}
                </div>
                {i < PIPELINE.length - 1 && (
                  <span style={{ color: "var(--border-bright)", fontSize: "0.8rem" }}>→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer
        className="text-center py-5 text-xs font-mono"
        style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}
      >
        Attack Chain Mapper ·{" "}
        <span style={{ color: "var(--accent)" }}>100% Open-Source</span> ·
        Local Analysis Engine · MIT License
      </footer>
    </main>
  );
}
