import clsx from 'clsx'
import { Link2, Send, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { cancelRun, createRun, createThread } from '../../api/agent'
import { listCandidates, type CandidatePart } from '../../api/candidates'
import { acceptProposal, listProposals, rejectProposal, type ProposalRecord } from '../../api/proposals'
import { useAgentRunStream } from '../../hooks/useAgentRunStream'
import { getAccentTokens, resolveAccent } from '../../lib/accent'
import { NODE_VISUALS } from '../../lib/nodeVisuals'
import type { CrEntityNode } from '../../data/seedGraph'
import { CandidateCard } from '../Candidates/CandidateCard'
import { ProposalCard } from '../Proposals/ProposalCard'
import { SeedDetailPanel } from './SeedDetailPanel'

interface RightPanelProps {
  selectedNode: CrEntityNode | null
  detailRequested: number
  projectId?: string
  onResearchChanged?: () => void
}

// Detail Surface section order, ported from
// docs/design/canvas/huabu-node-presentation-and-links.md §6.
export function RightPanel({
  selectedNode,
  detailRequested,
  projectId,
  onResearchChanged,
}: RightPanelProps) {
  const [tab, setTab] = useState<'chat' | 'detail' | 'review'>('chat')

  useEffect(() => {
    if (detailRequested > 0) setTab('detail')
  }, [detailRequested])

  return (
    <div className="bg-surface border-edge-default flex h-full w-full flex-col border-l">
      <div className="border-edge-default flex border-b">
        {(['chat', 'review', 'detail'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'flex-1 px-3 py-2 text-[12.5px] font-medium capitalize',
              tab === t ? 'text-fg-default border-info border-b-2' : 'text-fg-subtle',
            )}
          >
            {t === 'chat' ? 'Agent' : t === 'review' ? 'Review' : 'Detail'}
          </button>
        ))}
      </div>

      {tab === 'chat' ? (
        <ChatTab node={selectedNode} projectId={projectId} />
      ) : tab === 'review' ? (
        <ReviewTab projectId={projectId} onResearchChanged={onResearchChanged} />
      ) : (
        <DetailTab node={selectedNode} />
      )}
    </div>
  )
}

function ChatTab({
  node,
  projectId,
}: {
  node: CrEntityNode | null
  projectId?: string
}) {
  const [candidates, setCandidates] = useState<CandidatePart[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [streamText, setStreamText] = useState('')
  const [sending, setSending] = useState(false)

  const refreshCandidates = useCallback(async (pid: string) => {
    const listed = await listCandidates(pid)
    setCandidates(listed.candidates)
  }, [])

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    refreshCandidates(projectId).catch((err: unknown) => {
      if (!cancelled) {
        setLoadError(err instanceof Error ? err.message : String(err))
      }
    })
    return () => {
      cancelled = true
    }
  }, [projectId, refreshCandidates])

  const onStreamEvent = useCallback(
    (type: string, payload: unknown) => {
      if (type === 'message.delta') {
        const rec = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
        const inner = rec.assistantMessageEvent
        const delta =
          inner && typeof inner === 'object' && 'delta' in inner
            ? String((inner as { delta?: unknown }).delta ?? '')
            : ''
        if (delta) setStreamText((prev) => prev + delta)
      }
      if (type === 'message.completed' || type === 'tool.completed' || type === 'run.completed') {
        if (projectId) void refreshCandidates(projectId)
      }
    },
    [projectId, refreshCandidates],
  )
  useAgentRunStream(runId, onStreamEvent)

  async function send() {
    if (!projectId || !prompt.trim() || sending) return
    setSending(true)
    setLoadError(null)
    setStreamText('')
    try {
      let tid = threadId
      if (!tid) {
        const created = await createThread(projectId)
        tid = created.threadId
        setThreadId(tid)
      }
      const run = await createRun(tid, prompt.trim())
      setRunId(run.runId)
      setPrompt('')
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

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
        {streamText ? (
          <p className="text-fg-muted mb-2 whitespace-pre-wrap">{streamText}</p>
        ) : null}
        {loadError ? <p className="text-danger mb-2">{loadError}</p> : null}
        {candidates.map((candidate) => (
          <div key={candidate.candidateId} className="mb-2">
            <CandidateCard candidate={candidate} />
          </div>
        ))}
      </div>
      <div className="border-edge-default border-t p-2">
        <div className="bg-bg-default border-edge-default flex items-end gap-1.5 rounded-lg border p-1.5">
          <textarea
            rows={2}
            placeholder="Ask the agent…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            className="text-fg-default placeholder:text-fg-subtle flex-1 resize-none bg-transparent px-1 text-[12.5px] outline-none"
          />
          {runId ? (
            <button
              type="button"
              onClick={() => {
                void cancelRun(runId).catch((err: unknown) => {
                  setLoadError(err instanceof Error ? err.message : String(err))
                })
              }}
              className="text-fg-muted h-7 shrink-0 px-1.5 text-[11px]"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            disabled={sending || !prompt.trim()}
            onClick={() => void send()}
            className="bg-info flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white disabled:opacity-50"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

function ReviewTab({
  projectId,
  onResearchChanged,
}: {
  projectId?: string
  onResearchChanged?: () => void
}) {
  const [proposals, setProposals] = useState<ProposalRecord[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = useCallback(async (pid: string) => {
    const listed = await listProposals(pid, 'pending')
    setProposals(listed.proposals)
  }, [])

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    refresh(projectId).catch((err: unknown) => {
      if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err))
    })
    return () => {
      cancelled = true
    }
  }, [projectId, refresh])

  async function onAccept(id: string) {
    setBusyId(id)
    setLoadError(null)
    try {
      await acceptProposal(id)
      if (projectId) await refresh(projectId)
      onResearchChanged?.()
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyId(null)
    }
  }

  async function onReject(id: string) {
    setBusyId(id)
    setLoadError(null)
    try {
      await rejectProposal(id)
      if (projectId) await refresh(projectId)
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 text-[12.5px]">
      <p className="text-fg-subtle mb-2 text-[11px]">
        Idea Meta Space — pending revisions stay off the canvas until you accept them.
      </p>
      {loadError ? <p className="text-danger mb-2">{loadError}</p> : null}
      {proposals.length === 0 ? (
        <p className="text-fg-subtle">No pending proposals.</p>
      ) : (
        proposals.map((proposal) => (
          <div key={proposal.id} className="mb-2">
            <ProposalCard
              proposal={proposal}
              busy={busyId === proposal.id}
              onAccept={(id) => void onAccept(id)}
              onReject={(id) => void onReject(id)}
            />
          </div>
        ))
      )}
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
