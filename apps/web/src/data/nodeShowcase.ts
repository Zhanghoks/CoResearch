import { createPresentation } from '../lib/entity'
import type { ResearchEntityKind, ResearchNodePresentation, SeedDetail } from '../lib/entity'

export interface ShowcaseItem {
  group: string
  kind: ResearchEntityKind
  data: ResearchNodePresentation
}

// Seed's product job: record what the user wants to explore right now, as a
// search anchor for Literature Landscape — not a Problem, not a Research
// Question, never a Method. See 2026-09-18 "Seed 节点定死" discussion.
const AGENT_HARNESS_SEED: SeedDetail = {
  rawInput: '我想研究 agent harness 自进化',
  focus: '基于执行经验的持续 Harness 演化',
  description: 'Agent 根据过去任务执行经验修改外部 Harness，并将这些修改跨任务持久化。',
  objects: ['Skills', 'Tools', 'Memory', 'Control Logic'],
  scopeIncluded: ['外部 Agent Harness', 'Experience-driven adaptation', 'Persistent state', 'Skills / Tools / Memory / Control Logic'],
  scopeExcluded: ['Foundation Model 权重训练', '纯 Prompt Optimization', '只在单次 Context 内发生的临时适应'],
  directionCount: 6,
  currentDirectionTitle: 'Credit & Attribution',
  revisions: [
    { revision: 2, focus: '基于执行经验的持续 Harness 演化', date: 'Sep 18' },
    { revision: 1, focus: 'Agent Harness 自动优化', date: 'Sep 18' },
  ],
  confirmedAt: 'Sep 18',
}

/** One sample per node type the canvas can currently render. */
export const NODE_SHOWCASE: ShowcaseItem[] = [
  {
    group: 'Idea',
    kind: 'seed',
    data: createPresentation(
      's-seed',
      'seed',
      'Agent Harness 自进化',
      AGENT_HARNESS_SEED.description,
      {
        status: 'confirmed',
        confirmed: true,
        sourceCount: 0,
        relationCounts: { incoming: 0, outgoing: AGENT_HARNESS_SEED.directionCount, unresolved: 0 },
        seedDetail: AGENT_HARNESS_SEED,
      },
    ),
  },
  {
    group: 'Idea',
    kind: 'direction',
    data: createPresentation(
      's-direction',
      'direction',
      'Attribution under uncertainty',
      '从 Seed 派生的候选方向，带着它自己的文献版图。',
      { status: 'confirmed', confirmed: true, sourceCount: 5, relationCounts: { incoming: 1, outgoing: 3, unresolved: 0 } },
    ),
  },
  {
    group: 'Idea',
    kind: 'phase',
    data: createPresentation(
      's-phase',
      'phase',
      'Step 2 · Research Landscape',
      '把一次探索切成阶段，阶段只承载顺序，不承载结论。',
      { status: 'active' },
    ),
  },
  {
    group: 'Idea',
    kind: 'focus',
    data: createPresentation(
      's-focus',
      'focus',
      'skill · tool · memory scope',
      '在方向内部划定范围，决定后续 Problem 能谈什么。',
      { status: 'confirmed', confirmed: true, relationCounts: { incoming: 1, outgoing: 1, unresolved: 0 } },
    ),
  },
  {
    group: 'Problem',
    kind: 'problem',
    data: createPresentation(
      's-problem',
      'problem',
      'History-dependent interaction attribution',
      '效应是否依赖此前的 Edit？scope: skill · tool · memory',
      { status: 'confirmed', confirmed: true, sourceCount: 4, relationCounts: { incoming: 1, outgoing: 1, unresolved: 2 } },
    ),
  },
  {
    group: 'Problem',
    kind: 'requirement',
    data: createPresentation(
      's-requirement',
      'requirement',
      'Must generalize across agent harnesses',
      '问题成立需要满足的约束，方法必须逐条对上。',
      { status: 'draft', relationCounts: { incoming: 0, outgoing: 1, unresolved: 1 } },
    ),
  },
  {
    group: 'Hypothesis',
    kind: 'hypothesis',
    data: createPresentation(
      's-hypothesis',
      'hypothesis',
      'H1 · Edit effects depend on prior state',
      '机制陈述 + falsification hook，颜色弱、文字强。',
      { status: 'selected', sourceCount: 2, relationCounts: { incoming: 2, outgoing: 2, unresolved: 1 } },
    ),
  },
  {
    group: 'Hypothesis',
    kind: 'prediction',
    data: createPresentation(
      's-prediction',
      'prediction',
      'P1 · Replay divergence correlates with error',
      '可独立连接的预测节点，能看出哪条没有被方法覆盖。',
      { status: 'defined', relationCounts: { incoming: 1, outgoing: 1, unresolved: 0 } },
    ),
  },
  {
    group: 'Hypothesis',
    kind: 'probe',
    data: createPresentation(
      's-probe',
      'probe',
      'Pilot: 20 sessions replay sweep',
      '低成本探针，先确认预测值得被正式评估。',
      { status: 'planned' },
    ),
  },
  {
    group: 'Method',
    kind: 'approach',
    data: createPresentation(
      's-approach',
      'approach',
      'Targeted Replay Estimation',
      '方法主张本身，不展开实现细节。',
      { status: 'proposed', relationCounts: { incoming: 1, outgoing: 2, unresolved: 1 } },
    ),
  },
  {
    group: 'Method',
    kind: 'component',
    data: createPresentation(
      's-component',
      'component',
      'Typed Edit Lineage',
      'records: edit · parent state · outcome · tests: P1 · P2 · role: core',
      { status: 'core', relationCounts: { incoming: 1, outgoing: 1, unresolved: 0 } },
    ),
  },
  {
    group: 'Method',
    kind: 'operation',
    data: createPresentation(
      's-operation',
      'operation',
      'Replay Executor',
      '组件落到可执行的操作：跑一段有界重放并比对状态。',
      { status: 'supporting' },
    ),
  },
  {
    group: 'Evidence',
    kind: 'work',
    data: createPresentation(
      's-work',
      'work',
      'Agentic Harness Engineering',
      '2026 · paper · component observability · ablation · edit prediction',
      { status: 'read', sourceCount: 1, relationCounts: { incoming: 0, outgoing: 2, unresolved: 0 } },
    ),
  },
  {
    group: 'Evidence',
    kind: 'fragment',
    data: createPresentation(
      's-fragment',
      'fragment',
      'Paper A · p.4 · §3.2',
      '“...effects compound across edits within the same session...”',
      { status: 'grounded', evidenceState: 'grounded', relationCounts: { incoming: 1, outgoing: 1, unresolved: 0 } },
    ),
  },
  {
    group: 'Evidence',
    kind: 'claim',
    data: createPresentation(
      's-claim',
      'claim',
      'Targeted replay estimates history-dependent interaction',
      'supports: Attribution Fidelity · evidence: planned',
      { status: 'primary', evidenceState: 'planned', stale: 'upstream_revision_changed' },
    ),
  },
  {
    group: 'Evaluation',
    kind: 'evaluation',
    data: createPresentation(
      's-evaluation',
      'evaluation',
      'Attribution Fidelity',
      '它要区分的是哪一条 claim，以及和谁比。',
      { status: 'primary', relationCounts: { incoming: 1, outgoing: 1, unresolved: 0 } },
    ),
  },
  {
    group: 'Evaluation',
    kind: 'baseline',
    data: createPresentation(
      's-baseline',
      'baseline',
      'Full Replay Oracle',
      '显示它排除掉的那个解释，而不是一个分数。',
      { status: 'reference' },
    ),
  },
  {
    group: 'Review',
    kind: 'review',
    data: createPresentation(
      's-review',
      'review',
      'Needs revision',
      '2 weak links · 1 freshness issue',
      { status: 'needs revision', displayState: 'blocked', relationCounts: { incoming: 0, outgoing: 2, unresolved: 2 } },
    ),
  },
  {
    group: 'Review',
    kind: 'question',
    data: createPresentation(
      's-question',
      'question',
      '这条 claim 的证据够支撑吗？',
      '绑定 Agent 的提问节点，运行时携带本次上下文快照。',
      { status: 'running' },
    ),
  },
]

export const SHOWCASE_GROUPS = ['全部', 'Idea', 'Problem', 'Hypothesis', 'Method', 'Evidence', 'Evaluation', 'Review']
