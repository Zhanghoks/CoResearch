// Project endpoints (docs/spec/02-api-contract.md §1).
// Shape follows Huabu-main/apps/web/src/api/canvas.ts: one named function
// per endpoint over the shared `apiFetch`, no fetch calls in components.

import { apiFetch } from './_client'

export interface ProjectSummary {
  id: string
  title: string
  /** ADR 0003: the project's single primary canvas in V1. */
  canvasId: string | null
  createdAt: string
}

export interface CreatedProject {
  projectId: string
  canvasId: string
}

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
