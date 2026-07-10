"use client";

interface Step {
  node: string;
  weakness: string;
  action: string;
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
  Critical: "#FF3B5C",
  High: "#FFA630",
  Low: "#3DDC97",
};

const IMPACT_BG: Record<string, string> = {
  Critical: "rgba(255, 59, 92, 0.08)",
  High: "rgba(255, 166, 48, 0.08)",
  Low: "rgba(61, 220, 151, 0.08)",
};

const IMPACT_ICONS: Record<string, string> = {
  Critical: "CRITICAL",
  High: "HIGH",
  Low: "LOW",
};

export default function ChainCards({ chains }: Props) {
  // Sort by impact: Critical > High > Low
  const sorted = [...chains].sort((a, b) => {
    const order = { Critical: 0, High: 1, Low: 2 };
    return (order[a.impact] ?? 3) - (order[b.impact] ?? 3);
  });

  return (
    <div className="space-y-4">
      {sorted.map((chain, i) => {
        const color = IMPACT_COLORS[chain.impact] || "#8B98A9";
        const bg = IMPACT_BG[chain.impact] || "var(--bg-panel)";
        const confidencePct = Math.round((chain.confidence || 0.5) * 100);

        return (
          <div
            key={chain.id ?? i}
            id={`chain-card-${i}`}
            className="rounded-xl chain-card-hover"
            style={{
              background: bg,
              border: `1px solid ${color}30`,
              padding: "1.25rem",
            }}
          >
            {/* Header */}
            <div className="flex items-start gap-3 mb-3 flex-wrap">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold"
                    style={{
                      background: `${color}20`,
                      color,
                      border: `1px solid ${color}50`,
                    }}
                  >
                    {chain.impact}
                  </span>
                  <span
                    className="text-xs font-mono"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Confidence: {confidencePct}%
                  </span>
                </div>
                <h3
                  className="font-display font-semibold text-base"
                  style={{ color: "var(--text-primary)" }}
                >
                  {chain.title}
                </h3>
              </div>
            </div>

            {/* Explanation */}
            {chain.explanation && (
              <p
                className="text-sm mb-4 leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {chain.explanation}
              </p>
            )}

            {/* Steps */}
            {chain.steps && chain.steps.length > 0 && (
              <div className="space-y-2">
                <div
                  className="text-xs font-mono mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  ATTACK PATH
                </div>
                {chain.steps.map((step, si) => (
                  <div key={si} className="flex items-start gap-3">
                    {/* Step number */}
                    <div
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold"
                      style={{
                        background: `${color}20`,
                        color,
                        border: `1px solid ${color}50`,
                      }}
                    >
                      {si + 1}
                    </div>

                    {/* Step content */}
                    <div
                      className="flex-1 rounded-lg p-3 text-xs"
                      style={{
                        background: "rgba(11,15,23,0.6)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div
                        className="font-mono mb-1"
                        style={{ color: "var(--accent)" }}
                      >
                        {step.node}
                      </div>
                      <div
                        className="font-semibold mb-1"
                        style={{ color }}
                      >
                        {step.weakness}
                      </div>
                      <div style={{ color: "var(--text-muted)" }}>
                        → {step.action}
                      </div>
                    </div>

                    {/* Arrow to next */}
                    {si < chain.steps.length - 1 && (
                      <div
                        className="absolute ml-9 mt-8 text-xs"
                        style={{ color: "var(--text-muted)" }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Node IDs */}
            {chain.node_ids && chain.node_ids.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {chain.node_ids.map((nid, ni) => (
                  <span
                    key={ni}
                    className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{
                      background: "var(--bg-primary)",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {nid.replace("file:", "")}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
