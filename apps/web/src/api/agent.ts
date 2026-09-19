// Agent thread / run / durable history (docs/spec/02-api-contract.md §4).

import { apiFetch } from './_client'

import type {
  AgentMessageList,
  CreatedRun,
  CreatedThread,
} from '@coresearch/shared'

export type { AgentMessageList, CreatedRun, CreatedThread }

export function createThread(projectId: string): Promise<CreatedThread> {
  return apiFetch<CreatedThread>(`/api/projects/${projectId}/threads`, {
    method: 'POST',
    json: {},
    fallbackMessage: 'Failed to create thread',
  })
}

export function createRun(threadId: string, prompt: string): Promise<CreatedRun> {
  return apiFetch<CreatedRun>(`/api/threads/${threadId}/runs`, {
    method: 'POST',
    json: { prompt },
    fallbackMessage: 'Failed to start run',
  })
}

export function listThreadMessages(threadId: string): Promise<AgentMessageList> {
  return apiFetch<AgentMessageList>(`/api/threads/${threadId}/messages`, {
    fallbackMessage: 'Failed to load messages',
  })
}

export function cancelRun(runId: string): Promise<{ runId: string; cancelRequested: boolean }> {
  return apiFetch(`/api/runs/${runId}/cancel`, {
    method: 'POST',
    json: {},
    fallbackMessage: 'Failed to cancel run',
  })
}
