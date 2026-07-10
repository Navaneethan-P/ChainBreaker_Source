"use client";

import { useEffect, useRef } from "react";

interface GraphNode {
  id: string;
  label: string;
  type: string;
  severity: string;
  finding_count: number;
  routes?: string[];
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphEdge {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  label: string;
}

interface AttackChain {
  node_ids: string[];
  impact: string;
}

interface Props {
  graph: { nodes: GraphNode[]; edges: GraphEdge[] } | null;
  chains: AttackChain[];
}

export default function AttackGraph({ graph, chains }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<any>(null);

  useEffect(() => {
    if (!graph || !graph.nodes.length || !svgRef.current) return;

    // Dynamically import D3 (client-only)
    import("d3").then((d3) => {
      const svg = d3.select(svgRef.current!);
      svg.selectAll("*").remove();

      const container = svgRef.current!.parentElement!;
      const width = container.clientWidth;
      const height = container.clientHeight || 380;

      // Collect active node IDs from all chains
      const activeNodeIds = new Set<string>();
      chains.forEach((c) => (c.node_ids || []).forEach((id) => activeNodeIds.add(id)));

      // Build node & edge copies (D3 mutates them)
      const nodes: GraphNode[] = graph.nodes.map((n) => ({ ...n }));
      const edgeMap = new Map(nodes.map((n) => [n.id, n]));

      const edges = graph.edges
        .map((e) => ({
          ...e,
          source: edgeMap.get(typeof e.source === "string" ? e.source : (e.source as GraphNode).id) || e.source,
          target: edgeMap.get(typeof e.target === "string" ? e.target : (e.target as GraphNode).id) || e.target,
        }))
        .filter((e) => e.source && e.target);

      svg.attr("width", width).attr("height", height);

      const g = svg.append("g");

      // Zoom
      svg.call(
        d3.zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.3, 3])
          .on("zoom", (event) => g.attr("transform", event.transform))
      );

      // Arrow marker
      svg
        .append("defs")
        .append("marker")
        .attr("id", "arrow")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 20)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#2A3644");

      // Edges
      const link = g
        .selectAll("line")
        .data(edges)
        .enter()
        .append("line")
        .attr("stroke", (e: any) => {
          const srcId = typeof e.source === "object" ? e.source.id : e.source;
          const tgtId = typeof e.target === "object" ? e.target.id : e.target;
          return activeNodeIds.has(srcId) && activeNodeIds.has(tgtId)
            ? "#00D9FF"
            : "#2A3644";
        })
        .attr("stroke-width", (e: any) => {
          const srcId = typeof e.source === "object" ? e.source.id : e.source;
          const tgtId = typeof e.target === "object" ? e.target.id : e.target;
          return activeNodeIds.has(srcId) && activeNodeIds.has(tgtId) ? 2 : 1.5;
        })
        .attr("stroke-opacity", (e: any) => {
          const srcId = typeof e.source === "object" ? e.source.id : e.source;
          const tgtId = typeof e.target === "object" ? e.target.id : e.target;
          return activeNodeIds.has(srcId) && activeNodeIds.has(tgtId) ? 0.9 : 0.4;
        })
        .attr("marker-end", "url(#arrow)");

      // Node groups
      const nodeG = g
        .selectAll(".node-g")
        .data(nodes)
        .enter()
        .append("g")
        .attr("class", "node-g")
        .style("cursor", "pointer")
        .call(
          d3
            .drag<SVGGElement, GraphNode>()
            .on("start", (event, d) => {
              if (!event.active) simulation.alphaTarget(0.3).restart();
              d.fx = d.x;
              d.fy = d.y;
            })
            .on("drag", (event, d) => {
              d.fx = event.x;
              d.fy = event.y;
            })
            .on("end", (event, d) => {
              if (!event.active) simulation.alphaTarget(0);
              d.fx = null;
              d.fy = null;
            })
        );

      // Circles
      nodeG
        .append("circle")
        .attr("r", (d) => (activeNodeIds.has(d.id) ? 14 : 9))
        .attr("fill", (d) => {
          if (!activeNodeIds.has(d.id)) return "#1E2A3A";
          if (d.severity === "ERROR") return "#FF3B5C";
          if (d.severity === "WARNING") return "#FFA630";
          return "#00D9FF";
        })
        .attr("stroke", (d) => (activeNodeIds.has(d.id) ? "#fff" : "#2A3644"))
        .attr("stroke-width", (d) => (activeNodeIds.has(d.id) ? 2 : 1));

      // Pulse ring on active nodes
      nodeG
        .filter((d) => activeNodeIds.has(d.id))
        .append("circle")
        .attr("r", 18)
        .attr("fill", "none")
        .attr("stroke", (d) => {
          if (d.severity === "ERROR") return "#FF3B5C";
          if (d.severity === "WARNING") return "#FFA630";
          return "#00D9FF";
        })
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.4)
        .attr("class", "pulse-ring");

      // Labels
      nodeG
        .append("text")
        .attr("dy", "2.2em")
        .attr("text-anchor", "middle")
        .attr("font-family", "JetBrains Mono, monospace")
        .attr("font-size", "9")
        .attr("fill", "#8B98A9")
        .text((d) => d.label.split("/").pop()?.substring(0, 18) || "");

      // Simulation
      const simulation = d3
        .forceSimulation(nodes as any)
        .force("link", d3.forceLink(edges as any).id((d: any) => d.id).distance(130))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide(30));

      simulationRef.current = simulation;

      simulation.on("tick", () => {
        link
          .attr("x1", (d: any) => d.source.x)
          .attr("y1", (d: any) => d.source.y)
          .attr("x2", (d: any) => d.target.x)
          .attr("y2", (d: any) => d.target.y);

        nodeG.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
      });

      // Stop sim after settle
      setTimeout(() => simulation.alphaTarget(0), 3000);
    });

    return () => {
      simulationRef.current?.stop();
    };
  }, [graph, chains]);

  if (!graph || !graph.nodes.length) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--text-muted)" }}
      >
        <div className="text-center">
          <div className="text-sm">Graph will appear as the pipeline runs...</div>
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mt-4"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
        </div>
      </div>
    );
  }

  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      style={{ background: "transparent" }}
    />
  );
}
