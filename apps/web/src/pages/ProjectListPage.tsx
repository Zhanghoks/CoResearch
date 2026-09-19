// Ported from Huabu-main/apps/web/src/pages/CanvasListPage.tsx (MIT,
// Microsoft): fetch-on-mount into local state, create-and-navigate, an
// explicit empty state, `<Link>` per row.
//
// The unit differs. Huabu listed Canvases inside one local Workspace;
// CoResearch lists Projects, and each Project owns exactly one primary
// Canvas in V1 (ADR 0003), so a row links straight to `/canvas/:canvasId`
// and there is no canvas picker in between. Huabu's export/delete/import
// actions are not ported — no ticket has specified them for SaaS yet.

import { useCallback, useEffect, useState } from 'react'
import { Loader2, LogOut, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { ApiError } from '../api/_client'
import { createProject, listProjects, type ProjectSummary } from '../api/projects'
import { AppLoadingScreen } from './AppLoadingScreen'
import { useSessionStore, useUserEmail } from '../store/sessionStore'

export default function ProjectListPage() {
  const navigate = useNavigate()
  const email = useUserEmail()
  const signOut = useSessionStore((s) => s.signOut)
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const fetchProjects = useCallback(async () => {
    try {
      setProjects(await listProjects())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    void fetchProjects()
  }, [fetchProjects])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setIsCreating(true)
    setError(null)
    try {
      // One request creates the project, the owner membership and the
      // primary canvas (ADR 0003), so we can navigate straight in.
      const created = await createProject(trimmed)
      setTitle('')
      void navigate(`/canvas/${created.canvasId}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="bg-bg-default text-fg-default h-full w-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">我的研究项目</h1>
            {email && <p className="text-fg-muted mt-1 text-sm">{email}</p>}
          </div>
          <button
            onClick={() => void signOut()}
            className="text-fg-muted hover:text-fg-default flex items-center gap-1.5 text-sm"
          >
            <LogOut className="size-4" />
            退出
          </button>
        </header>

        <form onSubmit={handleCreate} className="mt-8 flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="新研究项目的名称"
            className="border-border-default bg-bg-subtle focus:border-fg-default min-w-0 flex-1 rounded-md border px-3 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={isCreating || !title.trim()}
            className="bg-fg-default text-bg-default flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-60"
          >
            {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            创建
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-8">
          {projects === null ? (
            <AppLoadingScreen message="加载项目…" />
          ) : projects.length === 0 ? (
            <p className="text-fg-muted text-sm">还没有项目。创建第一个，画布会自动建好。</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {projects.map((project) => (
                <li key={project.id}>
                  <Link
                    to={project.canvasId ? `/canvas/${project.canvasId}` : '#'}
                    className="border-border-default hover:bg-bg-subtle block rounded-lg border px-4 py-3"
                  >
                    <div className="text-sm font-medium">{project.title}</div>
                    <div className="text-fg-muted mt-0.5 text-xs">
                      {new Date(project.createdAt).toLocaleString()}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link
          to="/prototype"
          className="text-fg-muted hover:text-fg-default mt-10 inline-block text-xs underline underline-offset-4"
        >
          查看节点与画布原型
        </Link>
      </div>
    </div>
  )
}
