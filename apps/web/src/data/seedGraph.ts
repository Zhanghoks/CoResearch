import type { Edge, Node } from '@xyflow/react'

import type { AccentToken } from '../lib/accent'
import { buildRelationEdge } from '../lib/edgeVisual'
import { createPresentation as entity } from '../lib/entity'
import type {
  RelationStatus,
  ResearchNodePresentation,
  ResearchRelationType,
  SeedDetail,
} from '../lib/entity'
import type { PaperNodeData } from '../lib/paper'
import type { PaperNode as PaperNodeType } from '../components/Nodes/PaperNode'

export type CrEntityNode = Node<ResearchNodePresentation, 'crEntity'>
export type FrameNodeData = { label: string; accent: AccentToken } & Record<string, unknown>
export type FrameNode = Node<FrameNodeData, 'frame'>
export type PaperNode = PaperNodeType

const CARD_WIDTH = 260

const INTERACTION_EFFECTS_SEED: SeedDetail = {
  rawInput: '我想研究 agent 编辑操作之间会不会互相影响',
  focus: 'History-dependent interaction effects',
  description: 'Do edit effects depend on what happened before them in the same session?',
  objects: ['Edit ops', 'Session state', 'Prior context'],
  scopeIncluded: ['同一 session 内的 edit 序列', 'Prior-state dependent outcomes'],
  scopeExcluded: ['跨 session 的长期记忆', 'Model 权重层面的变化'],
  directionCount: 2,
  currentDirectionTitle: 'Attribution under uncertainty',
  revisions: [{ revision: 1, focus: 'History-dependent interaction effects', date: 'Sep 18' }],
  confirmedAt: 'Sep 18',
}

function paper(id: string, overrides: Partial<PaperNodeData> & Pick<PaperNodeData, 'title'>): PaperNodeData {
  return {
    paperId: id,
    authors: [],
    venue: '',
    year: new Date().getFullYear(),
    abstract: '',
    tags: [],
    readStatus: 'unread',
    accent: 'grey',
    ...overrides,
  }
}

const rawNodes: (CrEntityNode | FrameNode | PaperNode)[] = [
  {
    id: 'frame-1',
    type: 'frame',
    position: { x: 640, y: 20 },
    style: { width: 620, height: 460 },
    data: { label: 'Step 3–4 · Focus & Problem', accent: 'blue' },
  },
  {
    id: 'seed-1',
    type: 'crEntity',
    position: { x: 20, y: 200 },
    data: entity(
      'seed-1',
      'seed',
      'History-dependent interaction effects',
      'Do edit effects depend on what happened before them in the same session?',
      {
        status: 'confirmed',
        confirmed: true,
        sourceCount: 3,
        relationCounts: { incoming: 0, outgoing: 2, unresolved: 0 },
        seedDetail: INTERACTION_EFFECTS_SEED,
      },
    ),
  },
  {
    id: 'direction-1',
    type: 'crEntity',
    position: { x: 320, y: 60 },
    data: entity(
      'direction-1',
      'direction',
      'Attribution under uncertainty',
      'Estimate which prior edit caused a downstream effect.',
      { status: 'confirmed', confirmed: true, sourceCount: 5 },
    ),
  },
  {
    id: 'direction-2',
    type: 'crEntity',
    position: { x: 320, y: 340 },
    data: entity(
      'direction-2',
      'direction',
      'Replay-based estimation',
      'Use targeted replay instead of full session re-execution.',
      { status: 'draft', sourceCount: 2 },
    ),
  },
  {
    id: 'focus-1',
    type: 'crEntity',
    position: { x: 680, y: 60 },
    data: entity(
      'focus-1',
      'focus',
      'skill · tool · memory scope',
      'Restrict attribution to edits touching skill, tool, or memory state.',
      { status: 'confirmed', confirmed: true },
    ),
  },
  {
    id: 'problem-1',
    type: 'crEntity',
    position: { x: 680, y: 220 },
    data: entity(
      'problem-1',
      'problem',
      'History-dependent interaction attribution',
      '效应是否依赖此前的 Edit？scope: skill · tool · memory',
      {
        status: 'confirmed',
        confirmed: true,
        sourceCount: 4,
        relationCounts: { incoming: 1, outgoing: 1, unresolved: 2 },
      },
    ),
  },
  {
    id: 'requirement-1',
    type: 'crEntity',
    position: { x: 1000, y: 420 },
    data: entity(
      'requirement-1',
      'requirement',
      'Must generalize across agent harnesses',
      'Attribution method cannot assume a single harness implementation.',
      { status: 'draft' },
    ),
  },
  {
    id: 'hypothesis-1',
    type: 'crEntity',
    position: { x: 1340, y: 120 },
    data: entity(
      'hypothesis-1',
      'hypothesis',
      'H1 · Edit effects depend on prior state',
      'Edit effects depend on prior state.',
      { status: 'selected', sourceCount: 2, relationCounts: { incoming: 2, outgoing: 2, unresolved: 1 } },
    ),
  },
  {
    id: 'prediction-1',
    type: 'crEntity',
    position: { x: 1680, y: 20 },
    data: entity(
      'prediction-1',
      'prediction',
      'P1 · Replay divergence correlates with attribution error',
      'Higher replay divergence predicts higher attribution error.',
      { status: 'defined' },
    ),
  },
  {
    id: 'prediction-2',
    type: 'crEntity',
    position: { x: 1680, y: 200 },
    data: entity(
      'prediction-2',
      'prediction',
      'P2 · Null model shows no correlation',
      'A history-agnostic baseline shows no such correlation.',
      { status: 'defined' },
    ),
  },
  {
    id: 'approach-1',
    type: 'crEntity',
    position: { x: 1340, y: 400 },
    data: entity(
      'approach-1',
      'approach',
      'Targeted Replay Estimation',
      'Replay only the minimal edit window needed to isolate an effect.',
      { status: 'proposed', relationCounts: { incoming: 1, outgoing: 2, unresolved: 1 } },
    ),
  },
  {
    id: 'component-1',
    type: 'crEntity',
    position: { x: 1680, y: 380 },
    data: entity(
      'component-1',
      'component',
      'Typed Edit Lineage',
      'records: edit · parent state · outcome · role: core',
      { status: 'core' },
    ),
  },
  {
    id: 'operation-1',
    type: 'crEntity',
    position: { x: 1680, y: 570 },
    data: entity(
      'operation-1',
      'operation',
      'Replay Executor',
      'Runs a bounded replay window and diffs the resulting state.',
      { status: 'supporting' },
    ),
  },
  {
    id: 'evaluation-1',
    type: 'crEntity',
    position: { x: 2020, y: 120 },
    data: entity(
      'evaluation-1',
      'evaluation',
      'Attribution Fidelity',
      'Compares estimated vs. ground-truth attribution across sessions.',
      { status: 'primary' },
    ),
  },
  {
    id: 'baseline-1',
    type: 'crEntity',
    position: { x: 2020, y: 340 },
    data: entity(
      'baseline-1',
      'baseline',
      'Full Replay Oracle',
      'Exhaustive replay used only to generate ground truth, too slow for production.',
      { status: 'reference' },
    ),
  },
  {
    id: 'paper-1',
    type: 'paper',
    position: { x: 20, y: 460 },
    data: paper('paper-1', {
      title: 'Agentic Harness Engineering',
      authors: ['A. Chen', 'M. Okafor', 'R. Suzuki'],
      venue: 'arXiv',
      year: 2026,
      abstract:
        'We study how coding agents modify their own harness — skills, tools, and memory — over long sessions, and show that edit effects compound when the harness carries prior state forward.',
      tags: ['component observability', 'edit prediction'],
      readStatus: 'read',
      pageCount: 14,
      citedByCount: 3,
      accent: 'teal',
    }),
  },
  {
    id: 'paper-2',
    type: 'paper',
    position: { x: 20, y: 640 },
    data: paper('paper-2', {
      title: 'Targeted Replay Estimation: A Systematic Study',
      authors: ['J. Park', 'L. Andersson'],
      venue: 'NeurIPS Workshop',
      year: 2026,
      abstract:
        'A systematic comparison of bounded-window replay against full re-execution for isolating causal effects of individual edits in agent sessions.',
      tags: ['replay', 'attribution'],
      readStatus: 'reading',
      pageCount: 9,
      citedByCount: 0,
      accent: 'blue',
    }),
  },
  {
    id: 'fragment-1',
    type: 'crEntity',
    position: { x: 320, y: 600 },
    data: entity(
      'fragment-1',
      'fragment',
      'Paper A · p.4 · §3.2',
      '"...effects compound across edits within the same session..."',
      { status: 'grounded', evidenceState: 'grounded' },
    ),
  },
  {
    id: 'claim-1',
    type: 'crEntity',
    position: { x: 680, y: 600 },
    data: entity(
      'claim-1',
      'claim',
      'Targeted replay estimates history-dependent interaction',
      'supports: Attribution Fidelity · evidence: planned',
      { status: 'primary', evidenceState: 'planned', stale: 'upstream_revision_changed' },
    ),
  },
  {
    id: 'review-1',
    type: 'crEntity',
    position: { x: 1340, y: 600 },
    data: entity(
      'review-1',
      'review',
      'Needs revision',
      '2 weak links · 1 freshness issue',
      { status: 'needs revision', displayState: 'blocked' },
    ),
  },
]

const SPREAD_SCALE = 1

export const initialNodes: (CrEntityNode | FrameNode | PaperNode)[] = rawNodes.map((node) => {
  const position = { x: node.position.x * SPREAD_SCALE, y: node.position.y * SPREAD_SCALE }
  if (node.type === 'frame') {
    const style = node.style as { width: number; height: number }
    return {
      ...node,
      position,
      style: { width: style.width * SPREAD_SCALE, height: style.height * SPREAD_SCALE },
    }
  }
  return { ...node, position, style: { width: CARD_WIDTH } }
})

interface RelEdge {
  id: string
  source: string
  target: string
  type: ResearchRelationType
  status: RelationStatus
}

const relations: RelEdge[] = [
  { id: 'e1', source: 'seed-1', target: 'direction-1', type: 'motivates', status: 'confirmed' },
  { id: 'e2', source: 'seed-1', target: 'direction-2', type: 'motivates', status: 'visual' },
  { id: 'e3', source: 'direction-1', target: 'focus-1', type: 'contains', status: 'confirmed' },
  { id: 'e4', source: 'focus-1', target: 'problem-1', type: 'contains', status: 'confirmed' },
  { id: 'e5', source: 'problem-1', target: 'hypothesis-1', type: 'explains', status: 'confirmed' },
  { id: 'e6', source: 'requirement-1', target: 'approach-1', type: 'operationalizes', status: 'proposal' },
  { id: 'e7', source: 'hypothesis-1', target: 'prediction-1', type: 'tests', status: 'confirmed' },
  { id: 'e8', source: 'hypothesis-1', target: 'prediction-2', type: 'tests', status: 'confirmed' },
  { id: 'e9', source: 'approach-1', target: 'component-1', type: 'contains', status: 'visual' },
  { id: 'e10', source: 'approach-1', target: 'operation-1', type: 'contains', status: 'visual' },
  { id: 'e11', source: 'component-1', target: 'evaluation-1', type: 'evaluated_by', status: 'proposal' },
  { id: 'e12', source: 'evaluation-1', target: 'baseline-1', type: 'compares_against', status: 'confirmed' },
  { id: 'e13', source: 'paper-1', target: 'fragment-1', type: 'contains', status: 'visual' },
  { id: 'e14', source: 'fragment-1', target: 'claim-1', type: 'supports', status: 'confirmed' },
  { id: 'e15', source: 'claim-1', target: 'hypothesis-1', type: 'supports', status: 'stale' },
  { id: 'e16', source: 'review-1', target: 'approach-1', type: 'blocks', status: 'confirmed' },
  { id: 'e17', source: 'direction-2', target: 'hypothesis-1', type: 'motivates', status: 'proposal' },
  { id: 'e18', source: 'paper-2', target: 'approach-1', type: 'overlaps', status: 'proposal' },
]

export const seedRelations = relations
export const initialEdges: Edge[] = relations.map((r) =>
  buildRelationEdge(r.id, r.source, r.target, r.type, r.status),
)
