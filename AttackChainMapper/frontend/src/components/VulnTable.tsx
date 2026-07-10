"use client";

import { useState, useMemo } from "react";

interface Finding {
  id?: number;
  source: string;
  rule_id: string;
  severity: string;
  file_path: string;
  line_start: number;
  message: string;
}

interface Props {
  findings: Finding[];
}

type FilterKey = "all" | "critical" | "semgrep" | "pip-audit" | "npm-audit";

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  ERROR: { bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
  WARNING: { bg: "rgba(249,115,22,0.15)", text: "#f97316" },
  INFO: { bg: "rgba(14,165,233,0.12)", text: "#0ea5e9" },
};

const SOURCE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  semgrep: { bg: "rgba(14,165,233,0.10)", text: "#0ea5e9", border: "rgba(14,165,233,0.35)" },
  "pip-audit": { bg: "rgba(168,85,247,0.10)", text: "#a855f7", border: "rgba(168,85,247,0.35)" },
  "npm-audit": { bg: "rgba(249,115,22,0.10)", text: "#f97316", border: "rgba(249,115,22,0.35)" },
};

type SortKey = "source" | "severity" | "file_path" | "line_start";

export default function VulnTable({ findings }: Props) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortBy, setSortBy] = useState<SortKey>("severity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const severityOrder: Record<string, number> = { ERROR: 2, WARNING: 1, INFO: 0 };

  const filtered = useMemo(() => {
    let items = [...findings];
    if (filter === "critical") {
      items = items.filter((f) => f.severity === "ERROR");
    } else if (filter !== "all") {
      items = items.filter((f) => f.source === filter);
    }

    items.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "severity") {
        cmp = (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0);
      } else if (sortBy === "line_start") {
        cmp = a.line_start - b.line_start;
      } else {
        cmp = (a[sortBy] ?? "").localeCompare(b[sortBy] ?? "");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return items;
  }, [findings, filter, sortBy, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  const counts = useMemo(() => ({
    all: findings.length,
    critical: findings.filter((f) => f.severity === "ERROR").length,
    semgrep: findings.filter((f) => f.source === "semgrep").length,
    pipAudit: findings.filter((f) => f.source === "pip-audit").length,
    npmAudit: findings.filter((f) => f.source === "npm-audit").length,
  }), [findings]);

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span style={{ opacity: sortBy === col ? 1 : 0.3, fontSize: "10px", marginLeft: "4px" }}>
      {sortBy === col ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  const FilterBtn = ({
    k,
    label,
    count,
  }: {
    k: FilterKey;
    label: string;
    count: number;
  }) => (
    <button
      id={`vuln-filter-${k}`}
      onClick={() => setFilter(k)}
      style={{
        padding: "4px 12px",
        borderRadius: "20px",
        fontSize: "11px",
        fontFamily: "JetBrains Mono, monospace",
        cursor: "pointer",
        border: `1px solid ${filter === k ? "var(--accent)" : "var(--border)"}`,
        background: filter === k ? "var(--accent-dim)" : "transparent",
        color: filter === k ? "var(--accent)" : "var(--text-muted)",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        whiteSpace: "nowrap" as const,
      }}
    >
      {label}
      <span
        style={{
          background: filter === k ? "var(--accent)" : "var(--border)",
          color: filter === k ? "#000" : "var(--text-muted)",
          borderRadius: "10px",
          padding: "0 6px",
          fontSize: "10px",
          fontWeight: 700,
        }}
      >
        {count}
      </span>
    </button>
  );

  if (findings.length === 0) {
    return (
      <div
        style={{
          padding: "3rem",
          textAlign: "center",
          color: "var(--text-muted)",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "13px",
        }}
      >
        No vulnerability findings yet. Run an analysis to see results here.
      </div>
    );
  }

  return (
    <div>
      {/* Summary count bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        {[
          { label: "Total Findings", val: counts.all, color: "var(--text-primary)" },
          { label: "Critical / High", val: counts.critical, color: "var(--critical)" },
          { label: "Semgrep SAST", val: counts.semgrep, color: "var(--accent)" },
          { label: "pip-audit", val: counts.pipAudit, color: "#a855f7" },
          { label: "npm audit", val: counts.npmAudit, color: "var(--high)" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "12px 16px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "Space Grotesk, sans-serif",
                fontSize: "22px",
                fontWeight: 700,
                color: s.color,
              }}
            >
              {s.val}
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "16px",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
          FILTER:
        </span>
        <FilterBtn k="all" label="All" count={counts.all} />
        <FilterBtn k="critical" label="Critical" count={counts.critical} />
        <FilterBtn k="semgrep" label="Semgrep" count={counts.semgrep} />
        <FilterBtn k="pip-audit" label="pip-audit" count={counts.pipAudit} />
        <FilterBtn k="npm-audit" label="npm audit" count={counts.npmAudit} />
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid var(--border)" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "12px",
          }}
        >
          <thead>
            <tr style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
              {[
                { key: "source" as SortKey, label: "Source" },
                { key: "severity" as SortKey, label: "Severity" },
                { key: "file_path" as SortKey, label: "File" },
                { key: "line_start" as SortKey, label: "Line" },
              ].map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{
                    padding: "10px 14px",
                    textAlign: "left",
                    color: "var(--text-muted)",
                    fontFamily: "JetBrains Mono, monospace",
                    fontWeight: 600,
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap" as const,
                    letterSpacing: "0.05em",
                    fontSize: "10px",
                  }}
                >
                  {col.label.toUpperCase()}
                  <SortIcon col={col.key} />
                </th>
              ))}
              <th
                style={{
                  padding: "10px 14px",
                  textAlign: "left",
                  color: "var(--text-muted)",
                  fontFamily: "JetBrains Mono, monospace",
                  fontWeight: 600,
                  fontSize: "10px",
                  letterSpacing: "0.05em",
                }}
              >
                DESCRIPTION
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f, i) => {
              const sevStyle = SEVERITY_COLORS[f.severity] || SEVERITY_COLORS.INFO;
              const srcStyle = SOURCE_COLORS[f.source] || SOURCE_COLORS.semgrep;
              return (
                <tr
                  key={f.id ?? i}
                  id={`vuln-row-${i}`}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: i % 2 === 0 ? "var(--bg-panel)" : "var(--bg-primary)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--bg-card)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      i % 2 === 0 ? "var(--bg-panel)" : "var(--bg-primary)";
                  }}
                >
                  <td style={{ padding: "10px 14px" }}>
                    <span
                      style={{
                        background: srcStyle.bg,
                        color: srcStyle.text,
                        border: `1px solid ${srcStyle.border}`,
                        borderRadius: "6px",
                        padding: "2px 8px",
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: "10px",
                        fontWeight: 600,
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      {f.source}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span
                      style={{
                        background: sevStyle.bg,
                        color: sevStyle.text,
                        borderRadius: "4px",
                        padding: "2px 8px",
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: "10px",
                        fontWeight: 700,
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      {f.severity}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      fontFamily: "JetBrains Mono, monospace",
                      color: "var(--accent)",
                      maxWidth: "220px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap" as const,
                    }}
                    title={f.file_path}
                  >
                    {f.file_path}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      fontFamily: "JetBrains Mono, monospace",
                      color: "var(--text-muted)",
                      textAlign: "center",
                    }}
                  >
                    {f.line_start > 0 ? f.line_start : "—"}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      color: "var(--text-muted)",
                      maxWidth: "360px",
                    }}
                  >
                    {f.message}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              color: "var(--text-muted)",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "12px",
            }}
          >
            No findings match the selected filter.
          </div>
        )}
      </div>

      <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
        Showing {filtered.length} of {findings.length} findings
      </div>
    </div>
  );
}
