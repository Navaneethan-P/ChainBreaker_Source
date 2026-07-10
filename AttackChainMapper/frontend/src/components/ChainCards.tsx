"use client";

import { useState } from "react";

interface Step {
  node: string;
  weakness: string;
  action: string;
  fix?: string;
}

interface Chain {
  id?: number;
  chain_index?: number;
  title: string;
  steps: Step[];
  impact: string;
  confidence: number;
  explanation: string;
  node_ids: string[];
}

interface Props {
  chains: Chain[];
}

const IMPACT_COLORS: Record<string, string> = {
  Critical: "var(--critical)",
  High:     "var(--high)",
  Low:      "var(--low)",
};

const IMPACT_BG: Record<string, string> = {
  Critical: "rgba(239, 68, 68, 0.07)",
  High:     "rgba(249, 115, 22, 0.07)",
  Low:      "rgba(16, 185, 129, 0.07)",
};

const IMPACT_BORDER: Record<string, string> = {
  Critical: "rgba(239, 68, 68, 0.25)",
  High:     "rgba(249, 115, 22, 0.25)",
  Low:      "rgba(16, 185, 129, 0.25)",
};

export default function ChainCards({ chains }: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const sorted = [...chains].sort((a, b) => {
    const order: Record<string, number> = { Critical: 0, High: 1, Low: 2 };
    return (order[a.impact] ?? 3) - (order[b.impact] ?? 3);
  });

  const toggle = (i: number) =>
    setExpanded(prev => ({ ...prev, [i]: !prev[i] }));

  return (
    <div className="space-y-4">
      {sorted.map((chain, i) => {
        const color  = IMPACT_COLORS[chain.impact] || "var(--text-muted)";
        const bg     = IMPACT_BG[chain.impact]     || "var(--bg-panel)";
        const border = IMPACT_BORDER[chain.impact]  || "var(--border)";
        const confidencePct = Math.round((chain.confidence || 0.5) * 100);
        const isExpanded = expanded[i] ?? true;

        return (
          <div
            key={chain.id ?? i}
            id={`chain-card-${i}`}
            className="rounded-xl chain-card-hover"
            style={{ background: bg, border: `1px solid ${border}`, padding: "1.25rem" }}
          >
            {/* ── Header ─────────────────────────────────── */}
            <div
              className="flex items-start justify-between gap-3 cursor-pointer"
              onClick={() => toggle(i)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  {/* Impact badge */}
                  <span
                    className="badge"
                    style={{
                      background: `${IMPACT_COLORS[chain.impact]}22`,
                      color,
                      border: `1px solid ${border}`,
                    }}
                  >
                    {chain.impact}
                  </span>

                  {/* Confidence badge */}
                  <span
                    className="badge"
                    style={{
                      background: "var(--bg-card)",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border-bright)",
                    }}
                  >
                    {confidencePct}% confidence
                  </span>

                  {/* Step count */}
                  <span
                    className="badge"
                    style={{
                      background: "var(--accent-dim)",
                      color: "var(--accent)",
                      border: "1px solid var(--accent)",
                    }}
                  >
                    {chain.steps?.length ?? 0} steps
                  </span>
                </div>

                <h3
                  className="font-display font-semibold text-base leading-snug"
                  style={{ color: "var(--text-primary)" }}
                >
                  {chain.title}
                </h3>
              </div>

              {/* Expand toggle */}
              <button
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-bright)",
                  color: "var(--text-muted)",
                  transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                }}
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* ── Body (collapsible) ──────────────────────── */}
            {isExpanded && (
              <div className="mt-3 space-y-3">
                {/* Explanation */}
                {chain.explanation && (
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {chain.explanation}
                  </p>
                )}

                {/* Attack Path Steps */}
                {chain.steps && chain.steps.length > 0 && (
                  <div>
                    <div
                      className="text-xs font-mono font-semibold mb-2 tracking-wider"
                      style={{ color: "var(--text-muted)" }}
                    >
                      ATTACK PATH
                    </div>

                    <div className="space-y-2">
                      {chain.steps.map((step, si) => (
                        <div key={si} className="flex items-start gap-3">
                          {/* Step number */}
                          <div
                            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold mt-0.5"
                            style={{
                              background: `${IMPACT_COLORS[chain.impact]}20`,
                              color,
                              border: `1px solid ${border}`,
                            }}
                          >
                            {si + 1}
                          </div>

                          {/* Step content */}
                          <div className="flex-1">
                            <div
                              className="rounded-lg p-3 text-xs space-y-1.5"
                              style={{
                                background: "var(--bg-card)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              {/* Node */}
                              <div
                                className="font-mono"
                                style={{ color: "var(--accent)", fontSize: "0.68rem" }}
                              >
                                {step.node}
                              </div>

                              {/* Weakness */}
                              <div
                                className="font-semibold"
                                style={{ color }}
                              >
                                {step.weakness}
                              </div>

                              {/* Action */}
                              <div style={{ color: "var(--text-secondary)" }}>
                                → {step.action}
                              </div>
                            </div>

                            {/* Fix suggestion */}
                            {step.fix && (
                              <div className="fix-badge">
                                <span
                                  className="font-mono font-semibold mr-1"
                                  style={{ color: "var(--low)", fontSize: "0.65rem" }}
                                >
                                  FIX:
                                </span>
                                {step.fix}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Affected nodes */}
                {chain.node_ids && chain.node_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {chain.node_ids.map((nid, ni) => (
                      <span
                        key={ni}
                        className="font-mono"
                        style={{
                          fontSize: "0.65rem",
                          padding: "0.1rem 0.45rem",
                          background: "var(--bg-primary)",
                          color: "var(--text-muted)",
                          border: "1px solid var(--border)",
                          borderRadius: "0.25rem",
                        }}
                      >
                        {nid.replace("file:", "")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
