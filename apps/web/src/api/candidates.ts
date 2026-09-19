// Candidate list / fixture / accept (docs/spec/02-api-contract.md §2).

import { apiFetch } from './_client'

import type {
  AcceptCandidateResult,
  CandidateList,
  CandidatePart,
} from '@coresearch/shared'

export type { AcceptCandidateResult, CandidatePart }

export function listCandidates(projectId: string): Promise<CandidateList> {
  return apiFetch<CandidateList>(`/api/projects/${projectId}/candidates`, {
    fallbackMessage: 'Failed to load candidates',
  })
}

export function createFixtureCandidate(projectId: string): Promise<CandidatePart> {
  return apiFetch<CandidatePart>(`/api/projects/${projectId}/candidates/fixture`, {
    method: 'POST',
    json: {},
    fallbackMessage: 'Failed to create fixture candidate',
  })
}

export function acceptCandidate(
  projectId: string,
  candidateId: string,
  canvasId: string,
  position: { x: number; y: number },
  parentNodeId?: string,
): Promise<AcceptCandidateResult> {
  return apiFetch<AcceptCandidateResult>(
    `/api/projects/${projectId}/candidates/${candidateId}/accept`,
    {
      method: 'POST',
      json: { canvasId, placement: { parentNodeId, position } },
      fallbackMessage: 'Failed to accept candidate',
    },
  )
}
