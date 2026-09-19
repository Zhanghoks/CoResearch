// Ported from Huabu-main/apps/web/src/config/api.ts (MIT, Microsoft).
//
// Adapted for SaaS: CoResearch's API is a separate service from the SPA
// origin, so `VITE_API_URL` carries a full origin in dev (Vite on 5173,
// API on 8787) rather than Huabu's same-origin default with a reverse
// proxy. The `/api` suffix stays in the paths, not the base, because the
// API contract (docs/spec/02-api-contract.md) spells endpoints as
// `/api/projects`.

export const API_CONFIG = {
  /**
   * Origin of the CoResearch API. Empty means same-origin, which is how
   * a production deployment behind one reverse proxy should run.
   */
  BASE_URL: import.meta.env.VITE_API_URL ?? 'http://localhost:8787',
} as const
