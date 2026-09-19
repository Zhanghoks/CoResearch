// Supabase access-token verification.
//
// docs/spec/02-api-contract.md §0: the browser talks to Supabase Auth
// directly and sends us the resulting JWT as `Authorization: Bearer <jwt>`.
// This module turns that token into the `RequestContext.userId` that
// `withRequestContext` feeds to `SET LOCAL app.current_user_id` — so a
// forged or unverified token here is a direct RLS bypass. Verify, never decode.

import { jwtVerify } from "jose";

export type AuthConfig = {
  /** HS256 shared secret (Supabase "JWT secret"). */
  secret: Uint8Array;
  /** Expected `iss`, e.g. https://<ref>.supabase.co/auth/v1 */
  issuer: string;
};

export type VerifiedCaller = {
  userId: string;
};

export async function verifyAccessToken(
  token: string,
  config: AuthConfig,
): Promise<VerifiedCaller> {
  const { payload } = await jwtVerify(token, config.secret, {
    issuer: config.issuer,
    audience: "authenticated",
  });

  if (typeof payload.sub !== "string" || payload.sub === "") {
    throw new Error("access token has no sub claim");
  }

  return { userId: payload.sub };
}
