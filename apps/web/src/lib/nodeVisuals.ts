import {
  AlertCircle,
  BarChart3,
  Cog,
  Compass,
  Crosshair,
  FileText,
  FlaskConical,
  HelpCircle,
  Layers,
  ListChecks,
  MessageSquareWarning,
  Puzzle,
  Quote,
  Route,
  Scale,
  ScrollText,
  Search,
  Sprout,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'

import type { AccentToken } from './accent'
import type { ResearchEntityKind } from './entity'

interface NodeVisual {
  icon: LucideIcon
  accent: AccentToken
  typeLabel: string
}

// Kind -> {icon, accent, label}, per node-presentation.md §4/§5 category grouping.
export const NODE_VISUALS: Record<ResearchEntityKind, NodeVisual> = {
  seed: { icon: Sprout, accent: 'green', typeLabel: 'SEED' },
  direction: { icon: Compass, accent: 'teal', typeLabel: 'DIRECTION' },
  phase: { icon: Layers, accent: 'grey', typeLabel: 'PHASE' },
  focus: { icon: Crosshair, accent: 'blue', typeLabel: 'FOCUS' },
  problem: { icon: AlertCircle, accent: 'orange', typeLabel: 'PROBLEM' },
  claim: { icon: Quote, accent: 'purple', typeLabel: 'CLAIM' },
  hypothesis: { icon: FlaskConical, accent: 'purple', typeLabel: 'HYPOTHESIS' },
  prediction: { icon: TrendingUp, accent: 'blue', typeLabel: 'PREDICTION' },
  work: { icon: FileText, accent: 'grey', typeLabel: 'WORK' },
  fragment: { icon: ScrollText, accent: 'grey', typeLabel: 'EVIDENCE' },
  question: { icon: HelpCircle, accent: 'amber', typeLabel: 'QUESTION' },
  probe: { icon: Search, accent: 'teal', typeLabel: 'PROBE' },
  requirement: { icon: ListChecks, accent: 'orange', typeLabel: 'REQUIREMENT' },
  approach: { icon: Route, accent: 'teal', typeLabel: 'APPROACH' },
  operation: { icon: Cog, accent: 'blue', typeLabel: 'OPERATION' },
  component: { icon: Puzzle, accent: 'blue', typeLabel: 'METHOD COMPONENT' },
  evaluation: { icon: BarChart3, accent: 'green', typeLabel: 'EVALUATION' },
  baseline: { icon: Scale, accent: 'grey', typeLabel: 'BASELINE' },
  review: { icon: MessageSquareWarning, accent: 'red', typeLabel: 'REVIEW' },
}
