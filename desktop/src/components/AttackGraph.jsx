import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

const SEVERITY_COLOR = {
  ERROR:   '#DC2626',
  WARNING: '#D97706',
  INFO:    '#0EA5E9',
  SAFE:    '#16A34A',
}

const NODE_FILL = {
  route:        '#EFF6FF',
  module:       '#F0F7FF',
  config:       '#FFF7ED',
  entry:        '#F0FDF4',
  dependencies: '#FDF4FF',
}

const NODE_STROKE = {
  route:        '#0EA5E9',
  module:       '#0284C7',
  config:       '#EA580C',
  entry:        '#16A34A',
  dependencies: '#9333EA',
}

const NODE_TYPE_LABEL = {
  route:        'ROUTE',
  module:       'MOD',
  config:       'CFG',
  entry:        'ENTRY',
  dependencies: 'DEP',
}

export default function AttackGraph({ nodes = [], edges = [], highlightIds = [], searchQuery = '', onNodeClick }) {
  const svgRef  = useRef(null)
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    if (!nodes.length) return

    const el  = svgRef.current
    const W   = el.clientWidth  || 800
    const H   = el.clientHeight || 480

    d3.select(el).selectAll('*').remove()

    const svg = d3.select(el)
      .attr('width', W)
      .attr('height', H)

    // ── Background ─────────────────────────────────────────────────────────────
    svg.append('rect')
      .attr('width', W)
      .attr('height', H)
      .attr('fill', '#FAFBFF')
      .attr('rx', 8)

    // ── Defs ───────────────────────────────────────────────────────────────────
    const defs = svg.append('defs')

    // Blue glow for attack nodes
    const blueGlow = defs.append('filter').attr('id', 'blue-glow')
      .attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%')
    blueGlow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur')
    const bm = blueGlow.append('feMerge')
    bm.append('feMergeNode').attr('in', 'coloredBlur')
    bm.append('feMergeNode').attr('in', 'SourceGraphic')

    // Red glow for attack nodes
    const redGlow = defs.append('filter').attr('id', 'red-glow')
      .attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%')
    redGlow.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur')
    const rm = redGlow.append('feMerge')
    rm.append('feMergeNode').attr('in', 'coloredBlur')
    rm.append('feMergeNode').attr('in', 'SourceGraphic')

    // Standard arrow marker (sky blue)
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#BAE6FD')

    // Red attack arrow marker
    defs.append('marker')
      .attr('id', 'attack-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22).attr('refY', 0)
      .attr('markerWidth', 7).attr('markerHeight', 7)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#EF4444')

    // ── CSS animations ─────────────────────────────────────────────────────────
    svg.append('style').text(`
      @keyframes dashFlowBlue {
        to { stroke-dashoffset: -24; }
      }
      @keyframes dashFlowRed {
        to { stroke-dashoffset: -16; }
      }
      @keyframes pulseNode {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
      .edge-normal {
        stroke-dasharray: 6 4;
        animation: dashFlowBlue 2s linear infinite;
      }
      .edge-attack {
        stroke-dasharray: 5 3;
        animation: dashFlowRed 0.9s linear infinite;
      }
      .node-pulse {
        animation: pulseNode 1.8s ease-in-out infinite;
      }
    `)

    // ── Build node/edge maps ───────────────────────────────────────────────────
    const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]))
    const highlightSet = new Set(highlightIds)

    const simNodes = nodes.map(n => ({ ...n }))
    const simLinks = edges
      .filter(e => nodeById[e.source] && nodeById[e.target])
      .map(e => ({ ...e, source: e.source, target: e.target }))

    // ── Force simulation ───────────────────────────────────────────────────────
    const simulation = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simLinks).id(d => d.id).distance(130).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-350))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(50))
      .stop()

    // Run synchronously for stable initial layout
    for (let i = 0; i < 200; i++) simulation.tick()

    // ── Zoom/pan ───────────────────────────────────────────────────────────────
    const g = svg.append('g')
    svg.call(
      d3.zoom()
        .scaleExtent([0.3, 3])
        .on('zoom', (event) => g.attr('transform', event.transform))
    )

    // ── Draw edges ────────────────────────────────────────────────────────────
    const edgeGroup = g.append('g').attr('class', 'edges')

    const sq = searchQuery.toLowerCase()

    simLinks.forEach((link) => {
      const isAttack = link.type === 'attack' || link.attack || link.vuln
      const isHtml   = link.type === 'html_link'
      const isAttackOrHtml = isAttack || isHtml

      const x1 = link.source.x, y1 = link.source.y
      const x2 = link.target.x, y2 = link.target.y

      // Determine if edge matches search
      const sourceMatches = link.source.id?.toLowerCase().includes(sq) || link.source.label?.toLowerCase().includes(sq)
      const targetMatches = link.target.id?.toLowerCase().includes(sq) || link.target.label?.toLowerCase().includes(sq)
      const isDimmed = sq && !sourceMatches && !targetMatches

      // Thread line
      const line = edgeGroup.append('line')
        .attr('x1', x1).attr('y1', y1)
        .attr('x2', x2).attr('y2', y2)
        .attr('stroke', isAttack ? '#EF4444' : isHtml ? '#93C5FD' : '#BAE6FD')
        .attr('stroke-width', isAttack ? 2.5 : 1.5)
        .attr('marker-end', `url(#${isAttack ? 'attack-arrow' : 'arrow'})`)
        .attr('class', isAttack ? 'edge-attack' : 'edge-normal')
        .attr('opacity', isDimmed ? 0.1 : (isAttack ? 0.9 : 0.6))

      // Traveling dot along the edge
      const dotColor = isAttack ? '#EF4444' : '#0EA5E9'
      const dotRadius = isAttack ? 4 : 3
      const dotDuration = isAttack ? '1.1s' : '2.2s'

      const dot = edgeGroup.append('circle')
        .attr('r', dotRadius)
        .attr('fill', dotColor)
        .attr('opacity', isDimmed ? 0.1 : 0.85)

      if (isAttack) {
        dot.attr('filter', 'url(#red-glow)')
      }

      // Animate the dot traveling along the edge
      const pathId = `path-${Math.random().toString(36).slice(2)}`
      const hiddenPath = edgeGroup.append('path')
        .attr('id', pathId)
        .attr('d', `M${x1},${y1} L${x2},${y2}`)
        .attr('fill', 'none')
        .attr('stroke', 'none')

      dot.append('animateMotion')
        .attr('dur', dotDuration)
        .attr('repeatCount', 'indefinite')
        .attr('calcMode', 'linear')
        .html(`<mpath href="#${pathId}"/>`)

      // Edge label if present
      if (link.label) {
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2
        edgeGroup.append('text')
          .attr('x', mx).attr('y', my - 5)
          .attr('text-anchor', 'middle')
          .attr('font-size', 9)
          .attr('font-family', 'JetBrains Mono, monospace')
          .attr('fill', '#94A3B8')
          .text(link.label)
      }
    })

    // ── Draw nodes ────────────────────────────────────────────────────────────
    const nodeGroup = g.append('g').attr('class', 'nodes')

    simNodes.forEach((node) => {
      const isHighlighted = highlightSet.has(node.id)
      const isCritical = node.severity === 'ERROR' || node.attack
      const nodeType = node.type || 'module'

      const nodeMatches = node.id?.toLowerCase().includes(sq) || node.label?.toLowerCase().includes(sq)
      const isDimmed = sq && !nodeMatches

      const fill   = NODE_FILL[nodeType]   || '#F8FAFF'
      const stroke = isCritical ? '#EF4444' : (NODE_STROKE[nodeType] || '#0EA5E9')

      const ng = nodeGroup.append('g')
        .attr('transform', `translate(${node.x},${node.y})`)
        .style('cursor', 'pointer')
        .attr('opacity', isDimmed ? 0.2 : 1)
        .on('click', () => {
          if (onNodeClick) onNodeClick(node)
        })

      // Outer pulse ring for highlighted nodes
      if (isHighlighted || isCritical) {
        ng.append('circle')
          .attr('r', 32)
          .attr('fill', isCritical ? 'rgba(239,68,68,0.08)' : 'rgba(14,165,233,0.08)')
          .attr('stroke', isCritical ? 'rgba(239,68,68,0.3)' : 'rgba(14,165,233,0.3)')
          .attr('stroke-width', 1)
          .attr('class', 'node-pulse')
      }

      // Main circle
      ng.append('circle')
        .attr('r', 24)
        .attr('fill', fill)
        .attr('stroke', stroke)
        .attr('stroke-width', isCritical ? 2.5 : 1.5)
        .attr('filter', isCritical ? 'url(#red-glow)' : isHighlighted ? 'url(#blue-glow)' : null)

      // Node type badge (small)
      ng.append('text')
        .attr('y', -2)
        .attr('text-anchor', 'middle')
        .attr('font-size', 8)
        .attr('font-weight', '700')
        .attr('font-family', 'JetBrains Mono, monospace')
        .attr('fill', stroke)
        .text(NODE_TYPE_LABEL[nodeType] || nodeType.slice(0, 3).toUpperCase())

      // Severity dot
      if (node.severity) {
        ng.append('circle')
          .attr('cx', 16)
          .attr('cy', -16)
          .attr('r', 5)
          .attr('fill', SEVERITY_COLOR[node.severity] || '#94A3B8')
      }

      // Node label below
      const labelText = (node.label || node.id || '').length > 14
        ? (node.label || node.id).slice(0, 14) + '…'
        : (node.label || node.id || '')

      ng.append('text')
        .attr('y', 38)
        .attr('text-anchor', 'middle')
        .attr('font-size', 10)
        .attr('font-family', 'Inter, sans-serif')
        .attr('fill', '#334155')
        .attr('font-weight', isHighlighted ? '600' : '400')
        .text(labelText)

      // ── Drag ───────────────────────────────────────────────────────────────
      ng.call(
        d3.drag()
          .on('start', (event) => {
            node.fx = event.x
            node.fy = event.y
          })
          .on('drag', (event) => {
            node.x = event.x
            node.y = event.y
            ng.attr('transform', `translate(${node.x},${node.y})`)
            // Re-draw edges
            edgeGroup.selectAll('line')
              .each(function(d) {
                if (!d) return
                if (d.source?.id === node.id) d3.select(this).attr('x1', node.x).attr('y1', node.y)
                if (d.target?.id === node.id) d3.select(this).attr('x2', node.x).attr('y2', node.y)
              })
          })
          .on('end', () => {
            node.fx = null
            node.fy = null
          })
      )

      // ── Tooltip ────────────────────────────────────────────────────────────
      ng.on('mouseenter', (event) => {
        setTooltip({
          x: event.clientX,
          y: event.clientY,
          node,
        })
      }).on('mouseleave', () => setTooltip(null))
    })

  }, [nodes, edges, highlightIds])

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        ref={svgRef}
        style={{
          width: '100%',
          height: 480,
          display: 'block',
          background: '#FAFBFF',
          borderRadius: 'var(--radius-lg)',
        }}
      />

      {/* Legend */}
      <div style={{
        position: 'absolute', top: 12, left: 12,
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid var(--surface-border)',
        borderRadius: 'var(--radius-md)',
        padding: '8px 12px',
        display: 'flex', flexDirection: 'column', gap: 5,
        backdropFilter: 'blur(4px)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
          Legend
        </div>
        {[
          { color: '#BAE6FD', label: 'Data flow' },
          { color: '#EF4444', label: 'Attack path' },
          { color: '#0EA5E9', label: 'Highlighted node' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 20, height: 2, background: color, borderRadius: 1 }} />
            <span style={{ fontSize: 10, color: '#334155' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x + 12,
          top: tooltip.y - 10,
          background: '#0F172A',
          color: '#E2E8F0',
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: 11,
          fontFamily: 'JetBrains Mono, monospace',
          maxWidth: 260,
          pointerEvents: 'none',
          zIndex: 1000,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{tooltip.node.label || tooltip.node.id}</div>
          {tooltip.node.type     && <div style={{ color: '#94A3B8' }}>type: {tooltip.node.type}</div>}
          {tooltip.node.severity && <div style={{ color: SEVERITY_COLOR[tooltip.node.severity] || '#fff' }}>severity: {tooltip.node.severity}</div>}
          {tooltip.node.file_path && <div style={{ color: '#94A3B8' }}>file: {tooltip.node.file_path}</div>}
        </div>
      )}
    </div>
  )
}
