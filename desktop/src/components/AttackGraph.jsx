import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

const SEVERITY_COLOR = {
  ERROR:   '#ef4444',
  WARNING: '#f59e0b',
  INFO:    '#3b82f6',
  SAFE:    '#22c55e',
}

const NODE_TYPE_ICON = {
  route:        '⬡',
  module:       '⬢',
  config:       '⚙',
  entry:        '▶',
  dependencies: '📦',
}

export default function AttackGraph({ nodes = [], edges = [], highlightIds = [] }) {
  const svgRef     = useRef(null)
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    if (!nodes.length) return

    const el = svgRef.current
    const W  = el.clientWidth  || 800
    const H  = el.clientHeight || 480

    d3.select(el).selectAll('*').remove()

    const svg = d3.select(el)
      .attr('width', W)
      .attr('height', H)

    // ── Defs: Glow filter + animated attack marker ──────────────────────
    const defs = svg.append('defs')

    // Red glow filter for attack nodes
    const glowFilter = defs.append('filter')
      .attr('id', 'red-glow')
      .attr('x', '-50%').attr('y', '-50%')
      .attr('width', '200%').attr('height', '200%')
    glowFilter.append('feGaussianBlur')
      .attr('stdDeviation', '4').attr('result', 'coloredBlur')
    const glowMerge = glowFilter.append('feMerge')
    glowMerge.append('feMergeNode').attr('in', 'coloredBlur')
    glowMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Standard grey arrow marker
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#374151')

    // Red attack arrow marker
    defs.append('marker')
      .attr('id', 'attack-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20).attr('refY', 0)
      .attr('markerWidth', 7).attr('markerHeight', 7)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#ef4444')

    // ── Add CSS animations via <style> ──────────────────────────────────
    svg.append('style').text(`
      @keyframes pulse-node {
        0%   { r: 14px; opacity: 1; }
        50%  { r: 20px; opacity: 0.5; }
        100% { r: 14px; opacity: 1; }
      }
      @keyframes dash-flow {
        to { stroke-dashoffset: -40; }
      }
      .attack-node-pulse {
        animation: pulse-node 1.2s ease-in-out infinite;
      }
      .attack-edge-flow {
        stroke-dasharray: 10 6;
        animation: dash-flow 0.6s linear infinite;
      }
    `)

    const g = svg.append('g')

    svg.call(
      d3.zoom()
        .scaleExtent([0.2, 4])
        .on('zoom', (e) => g.attr('transform', e.transform))
    )

    const linkData = edges.map(e => ({
      source: nodes.find(n => n.id === e.source),
      target: nodes.find(n => n.id === e.target),
      label:  e.label || '',
      id:     e.id || '',
    })).filter(e => e.source && e.target)

    // Identify attack edges (both endpoints in highlightIds)
    const isAttackEdge = (e) =>
      highlightIds.includes(e.source?.id || e.source) &&
      highlightIds.includes(e.target?.id || e.target)

    const sim = d3.forceSimulation(nodes)
      .force('link',      d3.forceLink(linkData).id(d => d.id).distance(140))
      .force('charge',    d3.forceManyBody().strength(-320))
      .force('center',    d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(46))

    // ── Render normal (grey) edges ──────────────────────────────────────
    const normalLinks = linkData.filter(e => !isAttackEdge(e))
    const attackLinks = linkData.filter(e => isAttackEdge(e))

    g.append('g').selectAll('line')
      .data(normalLinks)
      .join('line')
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 1.2)
      .attr('marker-end', 'url(#arrow)')
      .attr('class', 'normal-edge')

    // ── Render attack (red pulsing) edges ───────────────────────────────
    const attackEdgeGroup = g.append('g')
    attackEdgeGroup.selectAll('line')
      .data(attackLinks)
      .join('line')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 3)
      .attr('stroke-opacity', 0.9)
      .attr('marker-end', 'url(#attack-arrow)')
      .attr('class', 'attack-edge-flow')

    // ── Edge labels ─────────────────────────────────────────────────────
    const linkLabel = g.append('g').selectAll('text')
      .data(linkData)
      .join('text')
      .attr('font-family', 'monospace')
      .attr('font-size', 8)
      .attr('fill', '#6b7280')
      .attr('text-anchor', 'middle')
      .text(d => d.label)

    // ── Nodes ───────────────────────────────────────────────────────────
    const node = g.append('g').selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(
        d3.drag()
          .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
          .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y })
          .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
      )
      .on('mouseenter', (e, d) => setTooltip({ x: e.clientX, y: e.clientY, node: d }))
      .on('mouseleave', () => setTooltip(null))

    const isAttackNode = (d) => highlightIds.includes(d.id)
    const isVulnNode   = (d) => d.severity === 'ERROR' || d.severity === 'WARNING'

    // Outer glow ring for attack nodes
    node.filter(d => isAttackNode(d))
      .append('circle')
      .attr('r', 22)
      .attr('fill', 'none')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.35)
      .attr('filter', 'url(#red-glow)')
      .attr('class', 'attack-node-pulse')

    // Main circle
    node.append('circle')
      .attr('r', d => isAttackNode(d) ? 15 : isVulnNode(d) ? 12 : 9)
      .attr('fill', d => {
        if (isAttackNode(d)) return '#1a0000'
        if (isVulnNode(d))   return '#1f0f00'
        return '#111827'
      })
      .attr('stroke', d => {
        if (isAttackNode(d)) return '#ef4444'
        if (isVulnNode(d))   return SEVERITY_COLOR[d.severity] || '#374151'
        return '#374151'
      })
      .attr('stroke-width', d => isAttackNode(d) ? 2.5 : isVulnNode(d) ? 1.5 : 1)
      .attr('filter', d => isAttackNode(d) ? 'url(#red-glow)' : 'none')

    // Node type icon
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', d => isAttackNode(d) ? 10 : 8)
      .attr('fill', d => isAttackNode(d) ? '#ef4444' : '#9ca3af')
      .text(d => NODE_TYPE_ICON[d.type] || '◆')

    // File name label
    node.append('text')
      .attr('dy', d => isAttackNode(d) ? 30 : 24)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'monospace')
      .attr('font-size', d => isAttackNode(d) ? 10 : 8)
      .attr('fill', d => isAttackNode(d) ? '#fca5a5' : '#6b7280')
      .attr('font-weight', d => isAttackNode(d) ? 'bold' : 'normal')
      .text(d => {
        const parts = d.label.split('/')
        return parts[parts.length - 1]
      })

    // Severity dot for non-attack vulnerable nodes
    node.filter(d => !isAttackNode(d) && isVulnNode(d))
      .append('circle')
      .attr('r', 4)
      .attr('cx', 9)
      .attr('cy', -9)
      .attr('fill', d => SEVERITY_COLOR[d.severity])
      .attr('stroke', '#111827')
      .attr('stroke-width', 1)

    // ── Simulation tick ─────────────────────────────────────────────────
    const allLinks = g.selectAll('line')

    sim.on('tick', () => {
      allLinks
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y)

      linkLabel
        .attr('x', d => (d.source.x + d.target.x) / 2)
        .attr('y', d => (d.source.y + d.target.y) / 2 - 5)

      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    return () => sim.stop()
  }, [nodes, edges, highlightIds])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#060a10' }}>
      <svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12,
        display: 'flex', gap: 12, alignItems: 'center',
        background: 'rgba(6,10,16,0.8)', border: '1px solid #1f2937',
        borderRadius: 6, padding: '6px 10px',
      }}>
        {[
          { color: '#ef4444', label: 'Attack Path' },
          { color: '#f59e0b', label: 'Vulnerable' },
          { color: '#374151', label: 'Clean' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {label}
            </span>
          </div>
        ))}
        <div style={{ width: 1, height: 14, background: '#1f2937' }} />
        <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#6b7280' }}>
          Scroll: zoom · Drag: pan/move
        </span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          top: tooltip.y + 14,
          left: tooltip.x + 14,
          background: '#0d1117',
          border: `1px solid ${highlightIds.includes(tooltip.node.id) ? '#ef4444' : '#1f2937'}`,
          borderRadius: 8,
          padding: '10px 14px',
          pointerEvents: 'none',
          zIndex: 1000,
          maxWidth: 280,
          boxShadow: highlightIds.includes(tooltip.node.id)
            ? '0 0 20px rgba(239,68,68,0.3)'
            : '0 4px 20px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#e5e7eb', marginBottom: 4 }}>
            {tooltip.node.label}
          </div>
          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {tooltip.node.type} · {tooltip.node.ecosystem || 'unknown'}
          </div>
          {tooltip.node.finding_count > 0 && (
            <div style={{ fontSize: 10, color: '#f87171', marginBottom: 4 }}>
              {tooltip.node.finding_count} finding{tooltip.node.finding_count !== 1 ? 's' : ''}
            </div>
          )}
          {tooltip.node.severity && tooltip.node.severity !== 'SAFE' && (
            <div style={{
              display: 'inline-block',
              fontSize: 9, fontFamily: 'monospace',
              background: tooltip.node.severity === 'ERROR' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
              color: SEVERITY_COLOR[tooltip.node.severity],
              border: `1px solid ${SEVERITY_COLOR[tooltip.node.severity]}40`,
              borderRadius: 4, padding: '2px 6px',
            }}>
              {tooltip.node.severity}
            </div>
          )}
          {highlightIds.includes(tooltip.node.id) && (
            <div style={{
              marginTop: 6, fontSize: 9, fontFamily: 'monospace',
              color: '#ef4444', letterSpacing: '0.05em',
            }}>
              ● ACTIVE IN ATTACK CHAIN
            </div>
          )}
        </div>
      )}
    </div>
  )
}
