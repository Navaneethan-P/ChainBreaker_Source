"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import StatusFeed from "@/components/StatusFeed";
import AttackGraph from "@/components/AttackGraph";
import ChainCards from "@/components/ChainCards";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Stage =
  | "pending"
  | "cloning"
  | "scanning"
  | "graphing"
  | "reasoning"
  | "scoring"
  | "deploying"
  | "done"
  | "error";

interface LogEvent {
  type: string;
  stage: string;
  message: string;
  run_id?: number;
  count?: number;
  graph?: any;
  chains?: any[];
  report_url?: string;
}

const STAGES: { key: Stage; label: string; icon: string }[] = [
  { key: "cloning", label: "Clone Repo", icon: "" },
  { key: "scanning", label: "Scan Vulns", icon: "" },
  { key: "graphing", label: "Build Graph", icon: "" },
  { key: "reasoning", label: "Analysis", icon: "" },
  { key: "scoring", label: "Score Impact", icon: "" },
  { key: "deploying", label: "Deploy Report", icon: "" },
];

export default function ResultsPage() {
  const params = useParams();
  const runId = params?.id as string;

  const [currentStage, setCurrentStage] = useState<Stage>("pending");
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [graph, setGraph] = useState<any>(null);
  const [chains, setChains] = useState<any[]>([]);
  const [reportUrl, setReportUrl] = useState<string>("");
  const [repoUrl, setRepoUrl] = useState<string>("");
  const [findingCount, setFindingCount] = useState<number>(0);
  const [isDone, setIsDone] = useState(false);
  const [isError, setIsError] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!runId) return;

    // Fetch initial run info
    fetch(`${API_URL}/api/runs/${runId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.run) setRepoUrl(data.run.repo_url);
        if (data.graph) setGraph(data.graph);
        if (data.chains?.length) setChains(data.chains);
        if (data.run?.report_url) setReportUrl(data.run.report_url);
        if (data.run?.status === "done") setIsDone(true);
        if (data.run?.status === "error") setIsError(true);
        setFindingCount(data.findings?.length || 0);
      })
      .catch(() => {});

    // SSE stream
    const es = new EventSource(`${API_URL}/api/stream/${runId}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const evt: LogEvent = JSON.parse(event.data);

        if (evt.type === "heartbeat") return;

        setLogs((prev) => [...prev, evt]);

        if (evt.stage && evt.stage !== "heartbeat") {
          setCurrentStage(evt.stage as Stage);
        }

        if (evt.graph) setGraph(evt.graph);
        if (evt.chains) setChains(evt.chains);
        if (evt.count && evt.stage === "scanning") setFindingCount(evt.count);
        if (evt.report_url) setReportUrl(evt.report_url);

        if (evt.type === "done") {
          setIsDone(true);
          es.close();
        }
        if (evt.type === "error") {
          setIsError(true);
          es.close();
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [runId]);

  const stageIndex = STAGES.findIndex((s) => s.key === currentStage);

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* TOP NAV */}
      <nav
        className="sticky top-0 z-50 px-6 py-4 flex items-center justify-between"
        style={{
          background: "rgba(20,27,38,0.9)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(12px)",
        }}
      >
        <a href="/" className="flex items-center gap-2">
          <span className="font-display font-bold text-sm" style={{ color: "var(--accent)" }}>
            Attack Chain Mapper
          </span>
        </a>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            Run #{runId}
          </span>
          {isDone && (
            <span
              className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: "rgba(61,220,151,0.15)", color: "var(--low)", border: "1px solid var(--low)" }}
            >
              ✓ COMPLETE
            </span>
          )}
          {isError && (
            <span
              className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: "rgba(255,59,92,0.15)", color: "var(--critical)", border: "1px solid var(--critical)" }}
            >
              ✗ ERROR
            </span>
          )}
        </div>
      </nav>

      <div className="px-6 py-8 max-w-7xl mx-auto">
        {/* Repo URL banner */}
        {repoUrl && (
          <div
            className="mb-6 px-4 py-3 rounded-xl text-sm font-mono"
            style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            Analyzing:{" "}
            <a href={repoUrl} target="_blank" rel="noopener noreferrer"
              style={{ color: "var(--accent)" }} className="hover:underline">
              {repoUrl}
            </a>
          </div>
        )}

        {/* STAGE PROGRESS BAR */}
        <div
          className="mb-8 p-5 rounded-2xl"
          style={{ background: "var(--bg-panel)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {STAGES.map((stage, i) => {
              const isCurrent = stage.key === currentStage && !isDone && !isError;
              const isDoneStage = (isDone && true) || i < stageIndex;
              const isPast = i < stageIndex;

              return (
                <div key={stage.key} className="flex items-center gap-1 flex-shrink-0">
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition-all ${
                      isCurrent ? "stage-active" : ""
                    }`}
                    style={{
                      background: isCurrent
                        ? "var(--accent-dim)"
                        : isPast || isDone
                        ? "rgba(61,220,151,0.1)"
                        : "var(--bg-primary)",
                      border: `1px solid ${
                        isCurrent
                          ? "var(--accent)"
                          : isPast || isDone
                          ? "var(--low)"
                          : "var(--border)"
                      }`,
                      color: isCurrent
                        ? "var(--accent)"
                        : isPast || isDone
                        ? "var(--low)"
                        : "var(--text-muted)",
                    }}
                  >
                    {isCurrent && (
                      <span className="w-2 h-2 rounded-full bg-current pulse-dot" />
                    )}
                    {(isPast || isDone) && !isCurrent && <span>✓</span>}
                    {stage.icon && <span>{stage.icon}</span>}
                    <span>{stage.label}</span>
                  </div>
                  {i < STAGES.length - 1 && (
                    <span style={{ color: "var(--border)" }} className="text-sm">
                      →
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* STATS ROW — show after done */}
        {isDone && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 fade-in-up">
            {[
              { label: "Critical Chains", value: chains.filter((c) => c.impact === "Critical").length, color: "var(--critical)" },
              { label: "High Chains", value: chains.filter((c) => c.impact === "High").length, color: "var(--high)" },
              { label: "Total Chains", value: chains.length, color: "var(--accent)" },
              { label: "Vulnerabilities", value: findingCount, color: "var(--low)" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="p-5 rounded-xl text-center"
                style={{ background: "var(--bg-panel)", border: "1px solid var(--border)" }}
              >
                <div className="font-display text-3xl font-bold" style={{ color: stat.color }}>
                  {stat.value}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Status feed */}
          <div className="lg:col-span-1">
            <StatusFeed logs={logs} currentStage={currentStage} isDone={isDone} isError={isError} />
          </div>

          {/* RIGHT: Graph + Chains */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Attack Graph */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "var(--bg-panel)", border: "1px solid var(--border)" }}
            >
              <div
                className="px-5 py-4 flex items-center gap-2"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <span className="font-display font-semibold text-sm">Attack Graph</span>
                {graph?.nodes?.length > 0 && (
                  <span className="text-xs font-mono ml-auto" style={{ color: "var(--text-muted)" }}>
                    {graph.nodes.length} nodes · {graph.edges?.length || 0} edges
                  </span>
                )}
              </div>
              <div style={{ height: "380px" }}>
                <AttackGraph graph={graph} chains={chains} />
              </div>
            </div>

            {/* Attack Chains */}
            {chains.length > 0 && (
              <div className="fade-in-up">
                <div
                  className="flex items-center gap-2 mb-4"
                >
                  <span
                    className="w-1 h-5 rounded"
                    style={{ background: "var(--accent)" }}
                  />
                  <span className="font-display font-semibold">
                    Attack Chains — Ranked by Impact
                  </span>
                </div>
                <ChainCards chains={chains} />
              </div>
            )}

            {/* Report URL */}
            {reportUrl && isDone && (
              <div
                className="p-5 rounded-xl fade-in-up"
                style={{
                  background: "rgba(61,220,151,0.08)",
                  border: "1px solid var(--low)",
                }}
              >
                <div className="font-display font-semibold mb-2" style={{ color: "var(--low)" }}>
                  Live Report Deployed!
                </div>
                <a
                  id="report-url-link"
                  href={reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-mono break-all hover:underline"
                  style={{ color: "var(--accent)" }}
                >
                  {reportUrl}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
