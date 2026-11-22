import { eq } from "drizzle-orm";
import { db } from "@/db";
import { families } from "@/db/schema";
import { getBrand } from "@/lib/billing";
import { MEMBER_COLORS, isHexColor, type MemberColor } from "@/lib/colors";

/**
 * Per-family install manifest: when a family adds the app to a phone's home
 * screen it's named after them ("Vanderbilt Family"). The family id in the
 * URL is an unguessable UUID; only the name and colour are returned.
 */
export async function GET(req: Request) {
  const brand = await getBrand();
  const id = new URL(req.url).searchParams.get("f") ?? "";
  const [fam] = /^[0-9a-f-]{36}$/i.test(id) ? await db.select({ name: families.name, theme: families.theme }).from(families).where(eq(families.id, id)) : [];
  const name = fam ? `${fam.name} Family` : brand;
  const accent = fam?.theme?.accent;
  const theme = accent ? (isHexColor(accent) ? accent : (MEMBER_COLORS[accent as MemberColor]?.solid ?? "#2d0f26")) : "#2d0f26";
  const manifest = {
    id: "/",
    name,
    short_name: fam ? fam.name.slice(0, 12) : brand.slice(0, 12),
    description: `${name}: calendar, chores, lists and more.`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f6f3ef",
    theme_color: theme,
    categories: ["lifestyle", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Calendar", url: "/calendar" },
      { name: "Chores", url: "/house/chores" },
      { name: "Shopping list", url: "/shopping" },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "private, max-age=300" } });
}
