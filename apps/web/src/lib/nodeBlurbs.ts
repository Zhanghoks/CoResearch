import type { ResearchEntityKind } from './entity'

// One-line role description per kind, ported from
// docs/design/canvas/huabu-node-presentation-and-links.md §4.
export const NODE_BLURBS: Record<ResearchEntityKind, string> = {
  seed: '记录用户当前想探索的研究区域和边界，作为后续文献地图的搜索锚点——不是 Problem，不是 Research Question，更不能提前写 Method。',
  direction: '从 Seed 派生的候选方向，带着它自己的文献版图。',
  phase: '把一次探索切成阶段，阶段只承载顺序，不承载结论。',
  focus: '在方向内部划定范围，决定后续 Problem 能谈什么。',
  problem: '用户决定要研究的具体问题；confirmed 后进入 Detail 只能编辑 draft，不能改结论。',
  requirement: '问题成立需要满足的约束，方法必须逐条对上。',
  hypothesis: '机制陈述 + falsification hook，颜色较弱、文字较强，强调可证伪性。',
  prediction: '独立可连接的预测节点，能看出哪一条没有被方法覆盖，不只是 Hypothesis 下的一个 bullet。',
  probe: '低成本的先导探针，用来在正式评估前确认一个预测值得投入。',
  work: '一篇论文或既有工作，只展示 Reader / Resolver 确认过的摘要，摘要生成失败时保留标题与来源链接。',
  fragment: '精确的引用片段，带定位信息（页码 / 章节）和它支持的 claim，不与整篇 Work 共用同一种卡片。',
  claim: '要证明的句子，区分 planned / partial / grounded 三种证据状态；Method proposal 不能因为放进 Idea Frame 就显示为事实。',
  question: '绑定 Agent 的提问节点，运行时携带当前上下文快照，双击直接打开对话。',
  approach: '方法主张本身，不展开实现细节。',
  component: '方法的一个职责单元，显示职责而不显示实现代码。',
  operation: '组件落到的可执行操作。',
  evaluation: '显示它要区分的 claim，以及和谁比较，不是一个孤立的分数。',
  baseline: '显示它排除掉的解释，而不是一个分数。',
  review: '列出阻塞项和未决评论，不能被折叠成普通 Note，否则用户会错过阻塞状态。',
}
