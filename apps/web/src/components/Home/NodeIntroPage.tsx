import { ArrowLeft, Link2 } from 'lucide-react'

import { NODE_SHOWCASE } from '../../data/nodeShowcase'
import { getAccentTokens, resolveAccent } from '../../lib/accent'
import type { ResearchEntityKind } from '../../lib/entity'
import { NODE_BLURBS } from '../../lib/nodeBlurbs'
import { NODE_VISUALS } from '../../lib/nodeVisuals'
import { SeedDetailPanel } from '../Layout/SeedDetailPanel'
import { EntityCard } from '../Nodes/EntityCard'

interface NodeIntroPageProps {
  kind: ResearchEntityKind
  onBack: () => void
  onViewInCanvas: () => void
}

/**
 * Standalone, full-page introduction for one node type — what it means, how
 * it reads on the canvas, and (for kinds that have a fully specified data
 * model, currently only Seed) every field's role. Reached from a home
 * gallery tile; distinct from the project canvas's Detail surface, which is
 * a cramped sidebar meant for working, not learning.
 */
export function NodeIntroPage({ kind, onBack, onViewInCanvas }: NodeIntroPageProps) {
  const item = NODE_SHOWCASE.find((i) => i.kind === kind)
  if (!item) return null

  const visual = NODE_VISUALS[kind]
  const Icon = visual.icon
  const accentColor = resolveAccent(visual.accent)
  const accentTokens = accentColor ? getAccentTokens(accentColor) : null
  const isSeed = kind === 'seed' && item.data.seedDetail

  return (
    <div className="bg-bg-default text-fg-default h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-[960px] px-8 py-10">
        <button
          onClick={onBack}
          className="text-fg-muted hover:text-fg-default mb-6 flex items-center gap-1.5 text-[13px]"
        >
          <ArrowLeft size={15} />
          返回首页
        </button>

        <div className="mb-8 flex items-start gap-5">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: accentTokens?.bg, color: accentTokens?.fg }}
          >
            <Icon size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-fg-subtle text-[11px] font-semibold tracking-wide uppercase">
              {visual.typeLabel} · {item.group}
            </div>
            <h1 className="mt-0.5 text-[22px] font-medium">{item.data.title}</h1>
            <p className="text-fg-muted mt-2 max-w-[62ch] text-[13.5px] leading-relaxed">{NODE_BLURBS[kind]}</p>
          </div>
          <button
            onClick={onViewInCanvas}
            className="bg-inverse text-fg-inverse flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium"
          >
            <Link2 size={14} />
            在画布中查看
          </button>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
          {/* Canvas preview — exactly what this node renders as, at real size. */}
          <div>
            <div className="text-fg-subtle mb-2 text-[11px] font-semibold tracking-wide uppercase">画布上的样子</div>
            <div
              className="border-edge-default rounded-2xl border p-5"
              style={{
                backgroundImage: 'radial-gradient(var(--canvas-grid) 0.8px, transparent 0.8px)',
                backgroundSize: '14px 14px',
              }}
            >
              <div className="h-[184px] w-full">
                <EntityCard data={item.data} lod="preview" />
              </div>
            </div>
          </div>

          {/* Full spec — rich for Seed (only node "定死" so far), generic elsewhere. */}
          <div className="border-edge-default bg-surface rounded-2xl border">
            {isSeed ? (
              <SeedDetailPanel node={item} />
            ) : (
              <GenericIntroBody data={item.data} accentColor={accentColor} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function GenericIntroBody({
  data,
  accentColor,
}: {
  data: (typeof NODE_SHOWCASE)[number]['data']
  accentColor: string | null
}) {
  const tokens = accentColor ? getAccentTokens(accentColor) : null

  return (
    <div className="p-5 text-[12.5px]">
      <Section title="Summary">
        <p className="text-fg-muted">{data.summary}</p>
      </Section>

      <Section title="Status">
        <div className="flex items-center gap-2">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={{ background: tokens?.softBg, color: tokens?.fg }}
          >
            {data.status}
          </span>
          {data.confirmed && <span className="text-success text-[11px]">confirmed</span>}
          {data.stale && <span className="text-warning text-[11px]">stale: {data.stale}</span>}
        </div>
      </Section>

      <Section title="Relations">
        <p className="text-fg-muted">
          {data.relationCounts.incoming} incoming · {data.relationCounts.outgoing} outgoing
          {data.relationCounts.unresolved > 0 && (
            <span className="text-warning"> · {data.relationCounts.unresolved} unresolved</span>
          )}
        </p>
      </Section>

      <Section title="这个卡片会怎么变化">
        <p className="text-fg-muted">
          按屏幕宽度做语义缩放：≥180px 显示完整预览，90–180px 收进 compact（仅标题与状态），
          &lt;90px 收进 mark（只剩类型图标）。缩放跨越临界点时连接端口同步过渡，避免连线突然跳位。
        </p>
      </Section>

      <div className="border-edge-default text-fg-subtle border-t px-0 pt-2.5 text-[11.5px]">
        这个节点类型的完整字段说明尚未定稿——目前只有 Seed 完成了逐字段的产品定义。
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 px-0 pb-3">
      <div className="text-fg-subtle mb-1 text-[10.5px] font-semibold tracking-wide uppercase">{title}</div>
      {children}
    </div>
  )
}
