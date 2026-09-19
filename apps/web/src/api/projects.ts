// Project endpoints (docs/spec/02-api-contract.md §1).
// Shape follows Huabu-main/apps/web/src/api/canvas.ts: one named function
// per endpoint over the shared `apiFetch`, no fetch calls in components.
//
// The request/response types come from @coresearch/shared so the API and
// this client cannot drift apart.

import { apiFetch } from './_client'

import type { CreatedProject, ProjectSummary } from '@coresearch/shared'

export type { CreatedProject, ProjectSummary }

export function listProjects(): Promise<ProjectSummary[]> {
  return apiFetch<ProjectSummary[]>('/api/projects', {
    fallbackMessage: 'Failed to load projects',
  })
}

export function createProject(title: string): Promise<CreatedProject> {
  return apiFetch<CreatedProject>('/api/projects', {
    method: 'POST',
    json: { title },
    fallbackMessage: 'Failed to create project',
  })
}
