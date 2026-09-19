// Ported from Huabu-main/apps/web/src/pages/WorkspaceLoadingScreen.tsx
// (MIT, Microsoft). Huabu waited on workspace bootstrap; CoResearch waits
// on the initial Supabase session resolving. Without this the app flashes
// the login page for an already-signed-in user.

import { Loader2 } from 'lucide-react'

export function AppLoadingScreen({ message = '加载中…' }: { message?: string }) {
  return (
    <div className="bg-bg-default text-fg-muted flex h-full w-full items-center justify-center gap-2 text-sm">
      <Loader2 className="size-4 animate-spin" />
      {message}
    </div>
  )
}
