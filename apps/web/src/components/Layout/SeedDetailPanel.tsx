import { Sprout } from 'lucide-react'

import { getAccentTokens, resolveAccent } from '../../lib/accent'
import type { ResearchNodePresentation, SeedDetail } from '../../lib/entity'

/**
 * Seed's Detail surface — deliberately not the generic Statement / Evidence /
 * Relations / Review layout every other node type gets. Seed only answers
 * five questions (raw input, current focus, in-scope objects, boundary,
 * confirmation) and never shows Gap / Novelty / Hypothesis / Method: showing
 * those here would mean the system silently did Step 2–4 for the user.
 * See 2026-09-18 "Seed 节点定死" discussion for the full rationale.
 */
export function SeedDetailPanel({ node }: { node: { data: ResearchNodePresentation } }) {
  const seed = node.data.seedDetail as SeedDetail
  const accentColor = resolveAccent('green')
  const accentTokens = accentColor ? getAccentTokens(accentColor) : null
  const currentRevision = seed.revisions[0]
  const hasLandscape = seed.directionCount > 0

  return (
    <div className="flex-1 overflow-y-auto p-3 text-[12.5px]">
      {/* Identity */}
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          style={{ background: accentTokens?.bg, color: accentTokens?.fg }}
        >
          <Sprout size={16} />
        </div>
        <div className="min-w-0">
          <div className="text-fg-subtle text-[10px] font-semibold tracking-wide uppercase">
            SEED · REV {currentRevision.revision}
          </div>
          <div className="text-fg-default truncate text-[13px] font-medium">{node.data.title}</div>
          <div className="text-fg-subtle text-[11px]">
            {node.data.confirmed ? '已确认' : '草稿'}
            {seed.confirmedAt && ` · ${seed.confirmedAt} 更新`}
          </div>
        </div>
      </div>

      <Section title="原始输入">
        <p className="text-fg-muted italic">“{seed.rawInput}”</p>
      </Section>

      <Section title="当前聚焦">
        <p className="text-fg-default font-medium">{seed.focus}</p>
        <p className="text-fg-muted mt-1">{seed.description}</p>
      </Section>

      <Section title="核心对象">
        <div className="flex flex-wrap gap-1.5">
          {seed.objects.map((obj) => (
            <span key={obj} className="bg-hover text-fg-default rounded-full px-2.5 py-1 text-[11.5px]">
              {obj}
            </span>
          ))}
        </div>
      </Section>

      <Section title="当前边界">
        <div className="text-fg-subtle mb-1 text-[10.5px] font-semibold">包含</div>
        <ul className="text-fg-muted mb-2 list-disc space-y-0.5 pl-4">
          {seed.scopeIncluded.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="text-fg-subtle mb-1 text-[10.5px] font-semibold">暂不包含</div>
        <ul className="text-fg-muted list-disc space-y-0.5 pl-4">
          {seed.scopeExcluded.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>

      <Section title="研究进展">
        {hasLandscape ? (
          <p className="text-fg-muted">
            已形成 {seed.directionCount} 个研究方向
            {seed.currentDirectionTitle && (
              <>
                <br />
                当前深入：{seed.currentDirectionTitle}
              </>
            )}
          </p>
        ) : (
          <p className="text-fg-subtle">尚未生成研究地图</p>
        )}
      </Section>

      <Section title="版本历史">
        <div className="space-y-1.5">
          {seed.revisions.map((rev) => (
            <div key={rev.revision} className="flex items-baseline gap-2">
              <span className={rev === currentRevision ? 'text-fg-default font-medium' : 'text-fg-subtle'}>
                REV {rev.revision}
                {rev === currentRevision && ' · 当前'}
              </span>
              <span className="text-fg-muted truncate">{rev.focus}</span>
              <span className="text-fg-subtle ml-auto shrink-0">{rev.date}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="确认">
        {node.data.confirmed ? (
          <span className="text-success">✓ 用户已确认</span>
        ) : (
          <span className="text-fg-subtle">尚未确认</span>
        )}
        <p className="text-fg-subtle mt-1">暂无待处理修改</p>
      </Section>

      <Section title="操作">
        <div className="flex flex-wrap gap-1.5">
          <ActionButton>编辑 Seed</ActionButton>
          {!node.data.confirmed ? (
            <ActionButton primary>确认 Seed</ActionButton>
          ) : hasLandscape ? (
            <ActionButton>刷新研究地图</ActionButton>
          ) : (
            <ActionButton primary>开始探索文献</ActionButton>
          )}
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-edge-default mb-3 border-t pt-2.5">
      <div className="text-fg-subtle mb-1 text-[10.5px] font-semibold tracking-wide uppercase">{title}</div>
      {children}
    </div>
  )
}

function ActionButton({ children, primary }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <button
      className={
        primary
          ? 'bg-info rounded-md px-2.5 py-1 text-[11.5px] font-medium text-white'
          : 'bg-hover text-fg-default rounded-md px-2.5 py-1 text-[11.5px] font-medium'
      }
    >
      {children}
    </button>
  )
}
