import "server-only";
import { eq, isNull, type AnyColumn, type SQL } from "drizzle-orm";
import { AuthorizationError, type Viewer } from "./dal";

/**
 * Money spaces. The family's budget (Budget module access), or a member's private
 * money space ("My Budget"), which a parent turns on in Family → Manage.
 *
 * A private money space is seen ONLY by its owner: never by parents, never by other
 * members, never in search, reports, the dashboard or notifications. Every money
 * query filters with {@link ownerIs}: family views read rows with no owner; a private
 * space reads only its owner's rows.
 */
export type FinanceSpace = { kind: "family" } | { kind: "private"; memberId: string };

/** The space a page shows (?space=mine), or null when the viewer has no money access at all. */
export function financeSpace(viewer: Viewer, raw: unknown): FinanceSpace | null {
  const wantsMine = raw === "mine" || !viewer.can("budget");
  if (wantsMine) return viewer.member.privateFinance ? { kind: "private", memberId: viewer.member.id } : null;
  return { kind: "family" };
}

export const ownerOf = (space: FinanceSpace) => (space.kind === "private" ? space.memberId : null);
/** Query-string to stay in the same space. */
export const spaceQuery = (space: FinanceSpace) => (space.kind === "private" ? "space=mine" : "");
export const withFinanceSpace = (href: string, space: FinanceSpace) => {
  const q = spaceQuery(space);
  return q ? `${href}${href.includes("?") ? "&" : "?"}${q}` : href;
};

/** Row filter: the family's rows (owner null) or exactly this member's. */
export function ownerIs(column: AnyColumn, owner: string | null): SQL {
  return owner ? eq(column, owner) : isNull(column);
}

/** For actions: whose money is this form changing? Throws if the viewer may not. */
export function financeOwnerFor(viewer: Viewer, fd: FormData): string | null {
  if (fd.get("space") === "mine") {
    if (!viewer.member.privateFinance) throw new AuthorizationError("Your private money space isn't turned on. Ask a parent.");
    return viewer.member.id;
  }
  if (!viewer.can("budget", "edit")) throw new AuthorizationError("You can't change the family budget.");
  return null;
}

/** Can the viewer change money in this space? Private: always (it's theirs). Family: Budget edit. */
export const canEditFinance = (viewer: Viewer, space: FinanceSpace) => (space.kind === "private" ? true : viewer.can("budget", "edit"));
