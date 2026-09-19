import clsx from 'clsx'
import {
  ArrowUp,
  Blocks,
  BookOpen,
  Compass,
  FlaskConical,
  FolderClosed,
  GitBranch,
  Home,
  Layers,
  LayoutGrid,
  Library,
  MessageSquareText,
  MousePointerClick,
  PanelLeft,
  Plus,
  Route,
  ScrollText,
  Share2,
  Sparkles,
  Sprout,
  Zap,
} from 'lucide-react'
import { useState } from 'react'

import { NODE_SHOWCASE, SHOWCASE_GROUPS, type ShowcaseItem } from '../../data/nodeShowcase'
import { getAccentTokens, resolveAccent, type AccentToken } from '../../lib/accent'
import type { ResearchEntityKind } from '../../lib/entity'
import { NODE_VISUALS } from '../../lib/nodeVisuals'
import { useResizableWidth } from '../../lib/useResizableWidth'
import { ResizeHandle } from '../Layout/ResizeHandle'
import { EntityCard } from '../Nodes/EntityCard'

export interface OpenProjectIntent {
  title?: string
  /** Canvas node to select, centre and open in the detail panel. */
  focusNodeId?: string | null
}

type OpenProject = (intent?: OpenProjectIntent) => void

const CURRENT_PROJECT_TITLE = '交互效应归因'

interface HomePageProps {
  onOpenProject: OpenProject
  /** Open the standalone, full-page introduction for one node type. */
  onViewNode: (kind: ResearchEntityKind) => void
}

export function HomePage({ onOpenProject, onViewNode }: HomePageProps) {
  return (
    <div className="bg-bg-default text-fg-default flex h-full w-full">
      <Sidebar onOpenProject={onOpenProject} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Hero onOpenProject={onOpenProject} />
        <HowItWorks />
        <NodeGallery onOpenProject={onOpenProject} onViewNode={onViewNode} />
      </main>
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* Sidebar                                                           */
/* ---------------------------------------------------------------- */

const NAV_ITEMS = [
  { icon: Home, label: '首页', active: true },
  { icon: FolderClosed, label: '项目', active: false },
  { icon: Blocks, label: '节点与技能', active: false },
  { icon: Library, label: '文献库', active: false },
]

const RECENT = ['交互效应归因', 'Agent Harness 综述', '未命名研究', '未命名研究', '未命名研究']

const SIDEBAR_MIN = 220
const SIDEBAR_MAX = 420
const SIDEBAR_DEFAULT = 280

function Sidebar({ onOpenProject }: { onOpenProject: OpenProject }) {
  const { width, isResizing, handleProps } = useResizableWidth({
    defaultWidth: SIDEBAR_DEFAULT,
    min: SIDEBAR_MIN,
    max: SIDEBAR_MAX,
  })

  return (
    <aside
      style={{ width }}
      className={clsx(
        'bg-surface border-edge-default relative flex shrink-0 flex-col border-r px-3 py-4',
        !isResizing && 'transition-[width] duration-100',
      )}
    >
      <div className="mb-5 flex items-center justify-between px-1">
        <div className="bg-info flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white">
          CR
        </div>
        <button className="hover:bg-hover text-fg-muted flex h-8 w-8 items-center justify-center rounded-lg">
          <PanelLeft size={17} />
        </button>
      </div>

      <button
        onClick={() => onOpenProject()}
        className="border-edge-default hover:bg-hover mb-5 flex h-11 w-full items-center gap-2 rounded-xl border px-3 text-[13.5px]"
      >
        <Plus size={16} />
        新建研究
      </button>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            className={clsx(
              'flex h-10 items-center gap-2.5 rounded-xl px-3 text-[13.5px]',
              active ? 'bg-hover text-fg-default' : 'text-fg-muted hover:bg-hover',
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      <div className="text-fg-subtle mt-7 mb-2 px-3 text-[12px]">最近项目</div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {RECENT.map((name, i) => (
          <button
            key={i}
            onClick={() => onOpenProject({ title: name })}
            className="text-fg-muted hover:bg-hover hover:text-fg-default flex h-9 items-center truncate rounded-xl px-3 text-left text-[13.5px]"
          >
            {name}
          </button>
        ))}
      </div>

      <div className="border-edge-default mt-3 flex items-center gap-2 border-t px-2 pt-3">
        <div className="bg-inverse text-fg-inverse flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold">
          Z
        </div>
        <span className="flex-1 truncate text-[13.5px]">Hoks Zhang</span>
        <span className="text-fg-muted flex items-center gap-1 text-[12.5px]">
          <Zap size={13} />
          70
        </span>
      </div>

      <ResizeHandle side="right" isResizing={isResizing} {...handleProps} />
    </aside>
  )
}

/* ---------------------------------------------------------------- */
/* Hero — prompt composer                                            */
/* ---------------------------------------------------------------- */

const QUICK_ACTIONS = [
  { icon: Compass, label: '文献地图' },
  { icon: Sprout, label: '问题形成' },
  { icon: FlaskConical, label: '假设设计' },
  { icon: Route, label: '方法设计' },
  { icon: Sparkles, label: '评估设计' },
]

function Hero({ onOpenProject }: { onOpenProject: OpenProject }) {
  const [value, setValue] = useState('')

  return (
    <div className="mx-auto w-full max-w-[900px] px-8 pt-14 pb-10">
      <h1 className="mb-7 text-center text-[26px] font-medium">你想研究什么？</h1>

      <div className="border-edge-default bg-surface focus-within:border-fg-subtle rounded-2xl border p-4 transition-colors">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          placeholder="给 CoResearch 一个想法，它会帮你形成方向、问题、假设与方法"
          className="text-fg-default placeholder:text-fg-subtle w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none"
        />
        <div className="mt-2 flex items-center">
          <button className="hover:bg-hover text-fg-muted flex h-8 w-8 items-center justify-center rounded-lg">
            <Plus size={17} />
          </button>
          <div className="flex-1" />
          <button className="hover:bg-hover text-fg-muted flex h-8 w-8 items-center justify-center rounded-lg">
            <Layers size={16} />
          </button>
          <button
            onClick={() => value.trim() && onOpenProject({ title: value.trim() })}
            className={clsx(
              'ml-1 flex h-8 w-8 items-center justify-center rounded-full transition-colors',
              value ? 'bg-inverse text-fg-inverse' : 'bg-hover text-fg-subtle',
            )}
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <span className="text-fg-subtle text-[13px]">CoResearch 帮你做：</span>
        {QUICK_ACTIONS.map(({ icon: Icon, label }) => (
          <button
            key={label}
            className="border-edge-default bg-surface hover:bg-hover flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px]"
          >
            <Icon size={14} className="text-fg-muted" />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* How it works — a four-step walkthrough of the product loop        */
/* ---------------------------------------------------------------- */

interface HowStep {
  icon: typeof MessageSquareText
  accent: AccentToken
  title: string
  body: string
}

const HOW_STEPS: HowStep[] = [
  {
    icon: MessageSquareText,
    accent: 'purple',
    title: '1 · 提出想法',
    body: '在上方输入一个研究方向，或直接点下面任意节点卡片——两者都会打开画布并开始生成。',
  },
  {
    icon: LayoutGrid,
    accent: 'blue',
    title: '2 · 认识节点',
    body: '每种卡片对应研究里的一个概念：Seed、Problem、Hypothesis、Method…… 颜色和状态标签（confirmed / stale / blocked）随时可辨。',
  },
  {
    icon: MousePointerClick,
    accent: 'green',
    title: '3 · 在画布上操作',
    body: '单击选中、双击打开右侧 Detail 查看完整正文与关系；拖动节点只改布局，不改变研究结论。',
  },
  {
    icon: GitBranch,
    accent: 'orange',
    title: '4 · 建立关系 + 追问 Agent',
    body: '从节点边缘拖出连线，标注 supports / challenges 等关系；右侧 Agent 面板可基于当前选中节点继续追问。',
  },
]

function HowItWorks() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-8 pb-10">
      <div className="border-edge-default bg-surface rounded-2xl border p-5">
        <div className="mb-4 flex items-center gap-2">
          <Compass size={15} className="text-fg-muted" />
          <span className="text-[13px] font-medium">怎么用 CoResearch</span>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {HOW_STEPS.map((step) => {
            const Icon = step.icon
            const tokens = accentTokensOf(step.accent)
            return (
              <div key={step.title} className="flex gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: tokens.bg, color: tokens.fg }}
                >
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium">{step.title}</div>
                  <div className="text-fg-muted mt-1 text-[12.5px] leading-relaxed">{step.body}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* Node gallery — every node type the canvas renders today           */
/* ---------------------------------------------------------------- */

const SOURCE_TABS = [
  { icon: Blocks, label: '节点' },
  { icon: Share2, label: '关系' },
  { icon: BookOpen, label: '文献' },
  { icon: ScrollText, label: '我的素材' },
]

function NodeGallery({
  onOpenProject,
  onViewNode,
}: {
  onOpenProject: OpenProject
  onViewNode: (kind: ResearchEntityKind) => void
}) {
  const [source, setSource] = useState('节点')
  const [group, setGroup] = useState('全部')

  const items = group === '全部' ? NODE_SHOWCASE : NODE_SHOWCASE.filter((item) => item.group === group)

  return (
    <div className="mx-auto w-full max-w-[1600px] px-8 pb-16">
      <div className="flex items-center gap-1">
        {SOURCE_TABS.map(({ icon: Icon, label }) => (
          <button
            key={label}
            onClick={() => setSource(label)}
            className={clsx(
              'flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px]',
              source === label ? 'bg-hover text-fg-default' : 'text-fg-muted hover:bg-hover',
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
        <button className="hover:bg-hover text-fg-muted flex h-9 w-9 items-center justify-center rounded-xl">
          <Plus size={15} />
        </button>
      </div>

      <div className="border-edge-default mt-2 flex items-center gap-5 border-b">
        {SHOWCASE_GROUPS.map((label) => (
          <button
            key={label}
            onClick={() => setGroup(label)}
            className={clsx(
              '-mb-px border-b-2 pb-2.5 text-[13.5px]',
              group === label
                ? 'border-fg-default text-fg-default'
                : 'text-fg-muted hover:text-fg-default border-transparent',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {group === '全部' && <FeatureBanner onOpenProject={onOpenProject} />}
        {items.map((item) => (
          <NodeTile key={item.kind} item={item} onOpen={() => onViewNode(item.kind)} />
        ))}
      </div>
    </div>
  )
}

function NodeTile({ item, onOpen }: { item: ShowcaseItem; onOpen: () => void }) {
  const visual = NODE_VISUALS[item.kind]

  return (
    <div className="flex flex-col">
      <button
        onClick={onOpen}
        className="border-edge-default bg-surface hover:border-fg-subtle flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border p-5 transition-colors"
        style={{
          backgroundImage: 'radial-gradient(var(--canvas-grid) 0.8px, transparent 0.8px)',
          backgroundSize: '14px 14px',
        }}
      >
        <div className="w-[240px]">
          <EntityCard data={item.data} lod="preview" />
        </div>
      </button>
      <div className="mt-2.5 flex items-center gap-2 px-0.5">
        <span className="text-[13.5px]">{visual.typeLabel.toLowerCase()}</span>
        <span className="text-fg-subtle text-[12px]">{item.group}</span>
      </div>
    </div>
  )
}

function FeatureBanner({ onOpenProject }: { onOpenProject: OpenProject }) {
  const avatarKinds: ResearchEntityKind[] = ['seed', 'problem', 'hypothesis', 'approach', 'evaluation', 'claim']

  return (
    <button
      onClick={() => onOpenProject({ title: CURRENT_PROJECT_TITLE })}
      className="border-edge-default bg-surface relative flex aspect-[4/3] flex-col overflow-hidden rounded-2xl border p-5 text-left"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--ai) 20%, transparent) 0%, transparent 62%)',
        }}
      />
      <div className="relative flex h-full flex-col">
        <div
          className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: 'var(--ai-bg)', color: 'var(--ai)' }}
        >
          <Sparkles size={18} />
        </div>
        <div className="text-[17px] leading-snug font-medium">
          Huabu 节点体系，
          <br />
          {NODE_SHOWCASE.length} 种研究节点 ›
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {avatarKinds.map((kind) => {
            const visual = NODE_VISUALS[kind]
            const Icon = visual.icon
            const tokens = accentTokensOf(visual.accent)
            return (
              <span
                key={kind}
                className="flex h-9 w-9 items-center justify-center rounded-full border"
                style={{ background: tokens.bg, borderColor: tokens.border, color: tokens.fg }}
              >
                <Icon size={15} />
              </span>
            )
          })}
          <span className="border-edge-default text-fg-subtle flex h-9 w-9 items-center justify-center rounded-full border border-dashed">
            <Plus size={14} />
          </span>
        </div>

        <div className="text-fg-subtle mt-auto text-[12px]">同一套所有权与 staleness 规则 · Step 1–8</div>
      </div>
    </button>
  )
}

function accentTokensOf(accent: AccentToken) {
  return getAccentTokens(resolveAccent(accent) ?? '#A8A29E')
}
