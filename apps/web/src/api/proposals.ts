// Track B proposals (docs/spec/02-api-contract.md §2). Reviewed in
// Idea Meta Space, never dropped onto the canvas.

import { apiFetch } from './_client'

import type {
  AcceptProposalResult,
  ProposalList,
  ProposalRecord,
} from '@coresearch/shared'

export type { AcceptProposalResult, ProposalRecord }

export function listProposals(
  projectId: string,
  status: 'pending' | 'accepted' | 'rejected' | 'superseded' = 'pending',
): Promise<ProposalList> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiFetch<ProposalList>(`/api/projects/${projectId}/proposals${query}`, {
    fallbackMessage: 'Failed to load proposals',
  })
}

export function acceptProposal(proposalId: string): Promise<AcceptProposalResult> {
  return apiFetch<AcceptProposalResult>(`/api/proposals/${proposalId}/accept`, {
    method: 'POST',
    json: {},
    fallbackMessage: 'Failed to accept proposal',
  })
}

export function rejectProposal(proposalId: string): Promise<ProposalRecord> {
  return apiFetch<ProposalRecord>(`/api/proposals/${proposalId}/reject`, {
    method: 'POST',
    json: {},
    fallbackMessage: 'Failed to reject proposal',
  })
}
