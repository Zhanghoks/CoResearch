import clsx from 'clsx'
import { Link2, Send, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

import { getAccentTokens, resolveAccent } from '../../lib/accent'
import { NODE_VISUALS } from '../../lib/nodeVisuals'
import type { CrEntityNode } from '../../data/seedGraph'
import { SeedDetailPanel } from './SeedDetailPanel'

interface RightPanelProps {
  selectedNode: CrEntityNode | null
  detailRequested: number
}

// Detail Surface section order, ported from
// docs/design/canvas/huabu-node-presentation-and-links.md §6.
export function RightPanel({ selectedNode, detailRequested }: RightPanelProps) {
  const [tab, setTab] = useState<'chat' | 'detail'>('chat')

  useEffect(() => {
    if (detailRequested > 0) setTab('detail')
  }, [detailRequested])

  return (
    <div className="bg-surface border-edge-default flex h-full w-full flex-col border-l">
      <div className="border-edge-default flex border-b">
        {(['chat', 'detail'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'flex-1 px-3 py-2 text-[12.5px] font-medium capitalize',
              tab === t ? 'text-fg-default border-info border-b-2' : 'text-fg-subtle',
            )}
          >
            {t === 'chat' ? 'Agent' : 'Detail'}
          </button>
        ))}
      </div>

      {tab === 'chat' ? <ChatTab node={selectedNode} /> : <DetailTab node={selectedNode} />}
    </div>
  )
}

function ChatTab({ node }: { node: CrEntityNode | null }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 overflow-y-auto p-3 text-[12.5px]">
        <div className="bg-ai-bg text-fg-default mb-2 rounded-lg p-2.5">
          <div className="text-ai mb-1 flex items-center gap-1 text-[11px] font-medium">
            <Sparkles size={12} /> Agent
          </div>
          {node
            ? `Selected "${node.data.title}". Ask me to expand, connect, or draft a hypothesis from this ${node.data.entityKind}.`
            : 'Select a node on the canvas to bring it into context, or ask a question about the research space.'}
        </div>
      </div>
      <div className="border-edge-default border-t p-2">
        <div className="bg-bg-default border-edge-default flex items-end gap-1.5 rounded-lg border p-1.5">
          <textarea
            rows={2}
            placeholder="Ask the agent…"
            className="text-fg-default placeholder:text-fg-subtle flex-1 resize-none bg-transparent px-1 text-[12.5px] outline-none"
          />
          <button className="bg-info flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white">
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailTab({ node }: { node: CrEntityNode | null }) {
  if (!node) {
    return <div className="text-fg-subtle p-4 text-[12.5px]">Double-click a node to open its detail surface.</div>
  }

  // Seed's job is narrower than every other node (§ "Seed 节点定死"), so it
  // gets its own Detail surface instead of the generic Statement / Evidence
  // / Relations / Review layout below.
  if (node.data.entityKind === 'seed' && node.data.seedDetail) {
    return <SeedDetailPanel node={node} />
  }

  const visual = NODE_VISUALS[node.data.entityKind]
  const Icon = visual.icon
  const accentColor = resolveAccent(visual.accent)
  const accentTokens = accentColor ? getAccentTokens(accentColor) : null

  return (
    <div className="flex-1 overflow-y-auto p-3 text-[12.5px]">
      {/* 1. Identity */}
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          style={{ background: accentTokens?.bg, color: accentTokens?.fg }}
        >
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <div className="text-fg-subtle text-[10px] font-semibold tracking-wide uppercase">
            {visual.typeLabel} · rev {node.data.entityRef.refRevision}
          </div>
          <div className="text-fg-default truncate text-[13px] font-medium">{node.data.title}</div>
        </div>
      </div>

      <Section title="Statement">
        <p className="text-fg-muted">{node.data.summary}</p>
      </Section>

      <Section title="Evidence">
        <div className="text-fg-muted flex items-center gap-3">
          <span>sources: {node.data.sourceCount}</span>
          {node.data.evidenceState && <span>evidence: {node.data.evidenceState}</span>}
        </div>
      </Section>

      <Section title="Relations">
        <div className="text-fg-muted flex items-center gap-2">
          <Link2 size={12} />
          {node.data.relationCounts.incoming} incoming · {node.data.relationCounts.outgoing} outgoing
          {node.data.relationCounts.unresolved > 0 && (
            <span className="text-warning">· {node.data.relationCounts.unresolved} unresolved</span>
          )}
        </div>
      </Section>

      <Section title="Review">
        {node.data.stale ? (
          <span className="text-warning">stale: {node.data.stale}</span>
        ) : (
          <span className="text-fg-subtle">No open review comments.</span>
        )}
      </Section>

      <Section title="Actions">
        <div className="flex flex-wrap gap-1.5">
          <ActionButton>Edit draft</ActionButton>
          <ActionButton>Connect</ActionButton>
          {!node.data.confirmed && <ActionButton primary>Confirm</ActionButton>}
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
      className={clsx(
        'rounded-md px-2.5 py-1 text-[11.5px] font-medium',
        primary ? 'bg-info text-white' : 'bg-hover text-fg-default',
      )}
    >
      {children}
    </button>
  )
}
