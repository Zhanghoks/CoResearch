import clsx from 'clsx'
import { useState } from 'react'

import { getAccentTokens, resolveAccent } from '../../lib/accent'
import type { ResearchEntityKind } from '../../lib/entity'
import { NODE_VISUALS } from '../../lib/nodeVisuals'
import type { CrEntityNode } from '../../data/seedGraph'

const GROUPS: { label: string; kinds: ResearchEntityKind[] }[] = [
  { label: 'Idea', kinds: ['seed', 'direction', 'phase', 'focus'] },
  { label: 'Problem', kinds: ['problem', 'requirement'] },
  { label: 'Hypothesis', kinds: ['hypothesis', 'prediction'] },
  { label: 'Method', kinds: ['approach', 'operation', 'component'] },
  { label: 'Evidence', kinds: ['work', 'fragment', 'claim'] },
  { label: 'Evaluation', kinds: ['evaluation', 'baseline'] },
  { label: 'Review', kinds: ['review', 'question', 'probe'] },
]

interface LeftPanelProps {
  nodes: CrEntityNode[]
  selectedNodeId: string | null
  onSelect: (id: string) => void
}

export function LeftPanel({ nodes, selectedNodeId, onSelect }: LeftPanelProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')

  const filtered = nodes.filter((n) =>
    n.data.title.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="bg-surface border-edge-default flex h-full w-full flex-col border-r">
      <div className="border-edge-default border-b p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nodes…"
          className="bg-bg-default border-edge-default text-fg-default placeholder:text-fg-subtle w-full rounded-md border px-2 py-1.5 text-[12px] outline-none focus:border-info"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        {GROUPS.map((group) => {
          const items = filtered.filter((n) => group.kinds.includes(n.data.entityKind))
          if (items.length === 0) return null
          const isCollapsed = collapsedGroups.has(group.label)
          return (
            <div key={group.label} className="mb-1">
              <button
                onClick={() =>
                  setCollapsedGroups((prev) => {
                    const next = new Set(prev)
                    next.has(group.label) ? next.delete(group.label) : next.add(group.label)
                    return next
                  })
                }
                className="text-fg-subtle hover:text-fg-default flex w-full items-center gap-1 px-1.5 py-1 text-[11px] font-semibold tracking-wide uppercase"
              >
                <span className={clsx('transition-transform', isCollapsed && '-rotate-90')}>▾</span>
                {group.label}
                <span className="text-fg-subtle ml-auto font-normal normal-case">{items.length}</span>
              </button>
              {!isCollapsed &&
                items.map((node) => {
                  const visual = NODE_VISUALS[node.data.entityKind]
                  const Icon = visual.icon
                  const accentColor = resolveAccent(visual.accent)
                  const accentTokens = accentColor ? getAccentTokens(accentColor) : null
                  const selected = node.id === selectedNodeId
                  return (
                    <button
                      key={node.id}
                      onClick={() => onSelect(node.id)}
                      className={clsx(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px]',
                        selected ? 'bg-info-bg' : 'hover:bg-hover',
                      )}
                    >
                      <Icon size={13} className="shrink-0" style={{ color: accentTokens?.fg }} />
                      <span className="text-fg-default min-w-0 flex-1 truncate">{node.data.title}</span>
                      {node.data.confirmed && <span className="bg-success h-1.5 w-1.5 shrink-0 rounded-full" />}
                      {node.data.stale && <span className="bg-warning h-1.5 w-1.5 shrink-0 rounded-full" />}
                    </button>
                  )
                })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
