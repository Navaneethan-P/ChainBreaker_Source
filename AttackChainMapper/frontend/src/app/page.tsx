"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DEMO_URL = "https://github.com/Navaneethan-P/Forge";

const FEATURES = [
  {
    icon: "1.",
    title: "SAST + Dependency Scan",
    desc: "Semgrep + pip-audit surface every weakness automatically",
  },
  {
    icon: "2.",
    title: "Code Graph Mapping",
    desc: "AST parser maps imports, routes & data flows into a live graph",
  },
  {
    icon: "3.",
    title: "Attack-Chain Reasoning",
    desc: "Automated analysis reasons out realistic exploit paths with confidence scoring",
  },
  {
    icon: "4.",
    title: "Instant Live Report",
    desc: "Auto-deployed shareable URL — zero extra clicks, zero paid APIs",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (url?: string) => {
    const target = url || repoUrl;
    if (!target.trim()) {
      setError("Please enter a GitHub repository URL.");
      return;
    }
    if (!target.startsWith("http")) {
      setError("URL must start with https://github.com/...");
      return;
    }
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <main className="min-h-screen hero-gradient scanline flex flex-col">
      {/* NAV */}
      <nav
        style={{
          background: "rgba(20,27,38,0.8)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(12px)",
        }}
        className="sticky top-0 z-50 px-8 py-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <span
            className="font-display text-lg font-bold"
            style={{ color: "var(--accent)" }}
          >
            Attack Chain Mapper
          </span>
          <span
            className="text-xs font-mono px-2 py-0.5 rounded"
            style={{
              background: "var(--accent-dim)",
              color: "var(--accent)",
              border: "1px solid var(--accent)",
            }}
          >
            ENTERPRISE EDITION
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm" style={{ color: "var(--text-muted)" }}>
          <a
            href="https://github.com/Navaneethan-P/Forge"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            GitHub →
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-3xl w-full text-center mb-12">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full text-xs font-mono"
            style={{ background: "var(--accent-dim)", border: "1px solid rgba(14,165,233,0.3)", color: "var(--accent)" }}>
            <span className="w-2 h-2 rounded-full bg-current pulse-dot" />
            100% Open-Source · Local Analysis · Zero Paid APIs
          </div>

          <h1
            className="font-display text-5xl md:text-6xl font-bold mb-6 leading-tight"
            style={{ color: "var(--text-primary)" }}
          >
            One click.{" "}
            <span style={{ color: "var(--accent)" }}>System traces</span>{" "}
            how weaknesses chain into a{" "}
            <span style={{ color: "var(--critical)" }}>real attack.</span>
          </h1>

          <p className="text-lg mb-4" style={{ color: "var(--text-muted)", lineHeight: 1.8 }}>
            Security scanners give you 40 flat CVEs. Attackers think in{" "}
            <strong style={{ color: "var(--text-primary)" }}>chains</strong> — one weakness
            opens the door to the next. Attack Chain Mapper runs an autonomous multi-agent
            pipeline: scan → map → reason → score → deploy. Ends in a live shareable report.
          </p>
        </div>

        {/* INPUT CARD */}
        <div
          className="w-full max-w-2xl rounded-2xl p-8"
          style={{
            background: "var(--bg-panel)",
            border: "1px solid var(--border)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          }}
        >
          <label
            htmlFor="repo-url"
            className="block text-sm font-mono mb-3"
            style={{ color: "var(--text-muted)" }}
          >
            GITHUB REPOSITORY URL
          </label>
          <div className="flex gap-3">
            <input
              id="repo-url"
              ref={inputRef}
              type="url"
              value={repoUrl}
              onChange={(e) => {
                setRepoUrl(e.target.value);
                setError("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="https://github.com/owner/repo"
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl font-mono text-sm input-glow transition-all"
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
              className="px-6 py-3 rounded-xl font-display font-semibold text-sm transition-all"
              style={{
                background: loading ? "var(--border)" : "var(--accent)",
                color: loading ? "var(--text-muted)" : "#000",
                cursor: loading ? "not-allowed" : "pointer",
                minWidth: "130px",
              }}
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Starting...
                </span>
              ) : (
                "Analyze"
              )}
            </button>
          </div>

          {error && (
            <p className="mt-3 text-sm font-mono" style={{ color: "var(--critical)" }}>
              {error}
            </p>
          )}

          {/* Demo shortcut */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Try demo repo:
            </span>
            <button
              id="demo-btn"
              onClick={() => {
                setRepoUrl(DEMO_URL);
                handleSubmit(DEMO_URL);
              }}
              className="text-xs font-mono transition-colors hover:opacity-80"
              style={{ color: "var(--accent)" }}
              disabled={loading}
            >
              {DEMO_URL} →
            </button>
          </div>
        </div>

        {/* FEATURES GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl w-full mt-16">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="rounded-xl p-5 chain-card-hover"
              style={{
                background: "var(--bg-panel)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <div
                className="font-display font-semibold text-sm mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                {f.title}
              </div>
              <div className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {f.desc}
              </div>
            </div>
          ))}
        </div>

        {/* PIPELINE FLOW VISUAL */}
        <div className="mt-16 w-full max-w-4xl">
          <h2
            className="font-display text-center text-sm font-semibold mb-6 tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            5-AGENT AUTONOMOUS PIPELINE
          </h2>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {[
              { label: "Scanner", icon: "", color: "var(--accent)" },
              { label: "Graph Builder", icon: "", color: "var(--accent)" },
              { label: "Attack-Path", icon: "", color: "var(--critical)" },
              { label: "Impact Scorer", icon: "", color: "var(--high)" },
              { label: "Report Deploy", icon: "", color: "var(--low)" },
            ].map((step, i, arr) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl"
                  style={{
                    background: "var(--bg-panel)",
                    border: `1px solid ${step.color}33`,
                    minWidth: "110px",
                  }}
                >
                  {step.icon && <span className="text-xl">{step.icon}</span>}
                  <span
                    className="text-xs font-mono font-semibold"
                    style={{ color: step.color }}
                  >
                    {step.label}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <span className="text-lg" style={{ color: "var(--text-muted)" }}>
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        className="text-center py-6 text-xs font-mono"
        style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}
      >
        Attack Chain Mapper ·{" "}
        <span style={{ color: "var(--accent)" }}>100% Open-Source</span> · Local Analysis Engine
      </footer>
    </main>
  );
}
