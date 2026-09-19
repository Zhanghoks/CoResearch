import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SignJWT } from "jose";

import { verifyAccessToken } from "./verifyAccessToken.js";

const secret = new TextEncoder().encode(
  "test-jwt-secret-that-is-long-enough-for-hs256",
);
const issuer = "https://project.supabase.co/auth/v1";
const userId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const config = { secret, issuer };

async function token(
  claims: Record<string, unknown> = {},
  opts: { expiresIn?: string; signWith?: Uint8Array } = {},
): Promise<string> {
  return new SignJWT({ role: "authenticated", ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(issuer)
    .setAudience("authenticated")
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? "1h")
    .sign(opts.signWith ?? secret);
}

describe("verifyAccessToken", () => {
  it("returns the sub claim as the userId for a valid Supabase token", async () => {
    const ctx = await verifyAccessToken(await token(), config);
    assert.equal(ctx.userId, userId);
  });

  it("rejects a token with no sub rather than yielding a blank identity", async () => {
    // A blank userId would reach SET LOCAL app.current_user_id and make
    // every RLS predicate compare against ''::uuid — fail closed instead.
    const noSub = await new SignJWT({ role: "authenticated" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);

    await assert.rejects(() => verifyAccessToken(noSub, config));
  });

  it("rejects a token signed with the wrong secret", async () => {
    const forged = await token(
      {},
      { signWith: new TextEncoder().encode("a-different-secret-entirely!!") },
    );
    await assert.rejects(() => verifyAccessToken(forged, config));
  });

  it("rejects an expired token", async () => {
    const expired = await token({}, { expiresIn: "-1h" });
    await assert.rejects(() => verifyAccessToken(expired, config));
  });

  it("rejects a token issued by a different Supabase project", async () => {
    const otherProject = await new SignJWT({ role: "authenticated" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("https://someone-else.supabase.co/auth/v1")
      .setAudience("authenticated")
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);

    await assert.rejects(() => verifyAccessToken(otherProject, config));
  });
});
