"use client";

import { useEffect, useRef } from "react";

interface LogEvent {
  type: string;
  stage: string;
  message: string;
}

interface StatusFeedProps {
  logs: LogEvent[];
  currentStage: string;
  isDone: boolean;
  isError: boolean;
}

const stageIcon: Record<string, string> = {
  cloning: "📥",
  scanning: "🔍",
  graphing: "🕸️",
  reasoning: "🧠",
  scoring: "📊",
  deploying: "🚀",
  done: "✅",
  error: "❌",
  log: "·",
  heartbeat: "·",
  status: "·",
};

export default function StatusFeed({ logs, currentStage, isDone, isError }: StatusFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div
      className="rounded-2xl flex flex-col"
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        height: "520px",
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center gap-2"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-sm">📡</span>
        <span className="font-display font-semibold text-sm">Live Pipeline Feed</span>
        {!isDone && !isError && (
          <span
            className="ml-auto flex items-center gap-1.5 text-xs font-mono"
            style={{ color: "var(--accent)" }}
          >
            <span className="w-2 h-2 rounded-full bg-current pulse-dot" />
            LIVE
          </span>
        )}
        {isDone && (
          <span className="ml-auto text-xs font-mono" style={{ color: "var(--low)" }}>
            ✓ DONE
          </span>
        )}
        {isError && (
          <span className="ml-auto text-xs font-mono" style={{ color: "var(--critical)" }}>
            ✗ ERROR
          </span>
        )}
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-xs">
        {logs.length === 0 ? (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--text-muted)" }}
          >
            <div className="text-center">
              <div className="text-3xl mb-3">⏳</div>
              <div>Waiting for pipeline to start...</div>
            </div>
          </div>
        ) : (
          logs.map((log, i) => {
            if (log.type === "heartbeat") return null;

            const isStageStart = log.type === "stage_start";
            const isStageEnd = log.type === "stage_done";
            const isError = log.type === "error";
            const isDone = log.type === "done";

            let color = "var(--text-muted)";
            if (isStageStart) color = "var(--accent)";
            if (isStageEnd) color = "var(--low)";
            if (isError) color = "var(--critical)";
            if (isDone) color = "var(--low)";

            return (
              <div
                key={i}
                className="flex items-start gap-2 py-0.5 fade-in-up"
                style={{ color }}
              >
                <span className="flex-shrink-0 mt-0.5">
                  {isStageStart
                    ? "▶"
                    : isStageEnd
                    ? "✓"
                    : isError
                    ? "✗"
                    : isDone
                    ? "🎉"
                    : "·"}
                </span>
                <span className="leading-relaxed break-words">{log.message}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
