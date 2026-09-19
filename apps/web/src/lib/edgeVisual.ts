import type { Connection, Edge, MarkerType } from '@xyflow/react'

import type { RelationStatus, ResearchRelationType } from './entity'

// Edge visual matrix, ported from
// docs/design/canvas/huabu-node-presentation-and-links.md §10.
const CHALLENGE_TYPES = new Set<ResearchRelationType>(['challenges', 'blocks'])

interface EdgeVisual {
  stroke: string
  strokeDasharray?: string
  markerEnd?: { type: MarkerType; color: string }
}

export function relationEdgeVisual(
  type: ResearchRelationType,
  status: RelationStatus,
): EdgeVisual {
  if (status === 'stale') {
    return { stroke: 'var(--warning)', strokeDasharray: '4 4' }
  }
  if (status === 'visual') {
    return { stroke: 'var(--fg-subtle)', strokeDasharray: '2 3' }
  }
  if (status === 'proposal') {
    return { stroke: 'var(--ai)', strokeDasharray: '6 4', markerEnd: { type: 'arrowclosed' as MarkerType, color: 'var(--ai)' } }
  }
  // confirmed
  if (CHALLENGE_TYPES.has(type)) {
    return { stroke: 'var(--danger)', markerEnd: { type: 'arrowclosed' as MarkerType, color: 'var(--danger)' } }
  }
  return { stroke: 'var(--success)', markerEnd: { type: 'arrowclosed' as MarkerType, color: 'var(--success)' } }
}

export function buildRelationEdge(
  id: string,
  source: string,
  target: string,
  type: ResearchRelationType,
  status: RelationStatus,
): Edge {
  const visual = relationEdgeVisual(type, status)
  return {
    id,
    source,
    target,
    label: status === 'visual' ? undefined : type.replace(/_/g, ' '),
    labelStyle: { fill: 'var(--fg-muted)', fontSize: 10 },
    labelBgStyle: { fill: 'var(--bg-surface)' },
    style: {
      stroke: visual.stroke,
      strokeWidth: status === 'confirmed' ? 2 : 1.5,
      strokeDasharray: visual.strokeDasharray,
    },
    markerEnd: visual.markerEnd,
    type: 'smoothstep',
    data: { relationType: type, relationStatus: status },
  }
}

/**
 * A connection dragged on the canvas without going through the Relation
 * Picker. Per docs/design/canvas/huabu-node-presentation-and-links.md §7.1
 * and §14: "用户创建 visual 连线应当快捷" — layout-only, no research
 * semantics, so it gets the neutral dotted style and no relation label.
 */
export function buildVisualEdge(connection: Connection): Edge {
  const visual = relationEdgeVisual('contains', 'visual')
  return {
    id: `visual-${connection.source}-${connection.target}-${Date.now()}`,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle,
    targetHandle: connection.targetHandle,
    style: { stroke: visual.stroke, strokeWidth: 1.5, strokeDasharray: visual.strokeDasharray },
    type: 'smoothstep',
    data: { relationType: null, relationStatus: 'visual' },
  }
}
