import { ChevronDown, ListIndentDecrease, ListIndentIncrease, MessageSquare, Redo2, Undo2 } from 'lucide-react'

interface HeaderProps {
  title: string
  isLeftCollapsed: boolean
  isRightCollapsed: boolean
  onToggleLeft: () => void
  onToggleRight: () => void
  onGoHome: () => void
}

export function Header({
  title,
  isLeftCollapsed,
  isRightCollapsed,
  onToggleLeft,
  onToggleRight,
  onGoHome,
}: HeaderProps) {
  return (
    <header className="bg-surface border-edge-default flex h-12 items-center gap-1 border-b px-2">
      <button
        onClick={onToggleLeft}
        className="hover:bg-hover flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        title={isLeftCollapsed ? 'Show layers' : 'Collapse layers'}
      >
        {isLeftCollapsed ? <ListIndentIncrease size={16} /> : <ListIndentDecrease size={16} />}
      </button>

      <button
        onClick={onGoHome}
        title="返回首页"
        className="bg-info flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white"
      >
        CR
      </button>

      <button onClick={onGoHome} className="hover:bg-hover text-fg-muted rounded-md px-1.5 py-1 text-sm">
        首页
      </button>
      <span className="text-fg-subtle">/</span>

      <button className="hover:bg-hover flex min-w-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium">
        <span className="truncate">{title}</span>
        <ChevronDown size={14} className="text-fg-subtle shrink-0" />
      </button>

      <div className="ml-1 flex items-center gap-0.5">
        <button className="hover:bg-hover flex h-7 w-7 items-center justify-center rounded-md" title="Undo">
          <Undo2 size={15} />
        </button>
        <button className="hover:bg-hover flex h-7 w-7 items-center justify-center rounded-md" title="Redo">
          <Redo2 size={15} />
        </button>
      </div>

      <div className="flex-1" />

      <button
        onClick={onToggleRight}
        className="hover:bg-hover flex h-7 items-center gap-1.5 rounded-md px-2 text-sm"
        title={isRightCollapsed ? 'Show chat' : 'Collapse chat'}
      >
        <MessageSquare size={15} />
        Agent
      </button>
    </header>
  )
}
