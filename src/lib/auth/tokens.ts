import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authTokens } from "@/db/schema";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const LIFETIME = { reset: 60 * 60 * 1000, verify: 3 * 86_400_000 } as const;

/** A new one-time link token (only its hash is stored). Earlier unused tokens of the same kind stop working. */
export async function issueToken(userId: string, kind: "reset" | "verify", email?: string) {
  await db.update(authTokens).set({ usedAt: new Date() }).where(and(eq(authTokens.userId, userId), eq(authTokens.kind, kind), isNull(authTokens.usedAt)));
  const token = randomBytes(32).toString("base64url");
  await db.insert(authTokens).values({ userId, kind, tokenHash: hash(token), email: email ?? null, expiresAt: new Date(Date.now() + LIFETIME[kind]) });
  return token;
}

/** Look up a valid (unused, unexpired) token without using it. */
export async function findToken(token: string, kind: "reset" | "verify") {
  if (!token || token.length > 200) return null;
  const [row] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, hash(token)), eq(authTokens.kind, kind), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())));
  return row ?? null;
}

/** Use a token once. Returns the row if it was still valid. */
export async function consumeToken(token: string, kind: "reset" | "verify") {
  const row = await findToken(token, kind);
  if (!row) return null;
  const [used] = await db.update(authTokens).set({ usedAt: new Date() }).where(and(eq(authTokens.id, row.id), isNull(authTokens.usedAt))).returning();
  return used ?? null;
}
