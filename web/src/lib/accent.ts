// Ported from Huabu packages/shared/src/types/canvas/color.ts
// One token drives a node's border, fill tint and text tint together.
export const ACCENT_PALETTE = [
  { token: 'white', name: 'White', value: '#ffffff' },
  { token: 'grey', name: 'Grey', value: '#A8A29E' },
  { token: 'teal', name: 'Teal', value: '#388388' },
  { token: 'blue', name: 'Blue', value: '#4ABFBD' },
  { token: 'green', name: 'Green', value: '#8AB77D' },
  { token: 'amber', name: 'Yellow', value: '#E9C46A' },
  { token: 'orange', name: 'Orange', value: '#F4A261' },
  { token: 'red', name: 'Red', value: '#E76F51' },
  { token: 'purple', name: 'Purple', value: '#9B8AC4' },
] as const

export type AccentToken = (typeof ACCENT_PALETTE)[number]['token']

const ACCENT_BY_TOKEN = Object.fromEntries(
  ACCENT_PALETTE.map((c) => [c.token, c.value]),
) as Record<AccentToken, string>

export function resolveAccent(token: AccentToken | null | undefined): string | null {
  if (!token) return null
  return ACCENT_BY_TOKEN[token] ?? null
}

const ACCENT_FG_MIX = 60
const ACCENT_BG_MIX = 10
const ACCENT_SOFT_MIX = 4
const ACCENT_BORDER_MIX = 75
const ACCENT_DIVIDER_MIX = 25
const WHITE_RE = /^\s*(white|#fff|#ffffff)\s*$/i

export interface AccentTokens {
  fg: string
  bg: string
  border: string
  divider: string
  softBg: string
}

export function getAccentTokens(accent: string): AccentTokens {
  const fg = WHITE_RE.test(accent)
    ? 'var(--fg-default)'
    : `color-mix(in srgb, ${accent} ${ACCENT_FG_MIX}%, var(--fg-default))`
  return {
    fg,
    bg: `color-mix(in srgb, ${accent} ${ACCENT_BG_MIX}%, var(--bg-surface))`,
    border: `color-mix(in srgb, ${accent} ${ACCENT_BORDER_MIX}%, transparent)`,
    divider: `color-mix(in srgb, ${accent} ${ACCENT_DIVIDER_MIX}%, transparent)`,
    softBg: `color-mix(in srgb, ${accent} ${ACCENT_SOFT_MIX}%, transparent)`,
  }
}
