import type { AccentToken } from './accent'

// Ported from Huabu's `PdfNodeData` (packages/shared/src/types/canvas/node.ts)
// + `PreviewCard`'s cover/info-area contract — but each CoResearch canvas
// node is one paper (a whole Work), not one PDF file. `coverUrl` stays
// optional and image-less papers fall back to icon + title only, exactly
// like PDFNode.tsx does when `coverImage` never resolves.
export type PaperReadStatus = 'unread' | 'reading' | 'read'

export interface PaperNodeData extends Record<string, unknown> {
  paperId: string
  title: string
  authors: string[]
  venue: string
  year: number
  /** Absent → PreviewCard-style icon+title fallback, no placeholder graphic. */
  coverUrl?: string
  abstract: string
  tags: string[]
  readStatus: PaperReadStatus
  pageCount?: number
  citedByCount?: number
  accent: AccentToken
}
