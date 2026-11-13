import { test } from "node:test";
import assert from "node:assert/strict";
import { supabaseDriver } from "../src/lib/storage";

/** Minimal fake of Supabase Storage's REST API. */
function fakeSupabase() {
  const objects = new Map<string, { body: Buffer; type: string }>();
  let bucket = false;
  const calls: string[] = [];
  const fakeFetch = (async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    const h = new Headers(init.headers);
    calls.push(`${method} ${url.pathname}`);
    if (h.get("apikey") !== "sb_secret_test" || h.get("authorization") !== "Bearer sb_secret_test") return new Response("unauthorized", { status: 401 });
    const m = url.pathname.match(/^\/storage\/v1\/(.*)$/)!;
    const rest = m[1]!;
    if (rest === "bucket" && method === "POST") {
      const b = JSON.parse(String(init.body));
      assert.equal(b.public, false);
      if (bucket) return new Response('{"error":"Duplicate"}', { status: 409 });
      bucket = true;
      return new Response("{}", { status: 200 });
    }
    if (rest.startsWith("object/uploads") && method === "DELETE") {
      for (const p of JSON.parse(String(init.body)).prefixes) objects.delete(p);
      return new Response("[]");
    }
    if (rest.startsWith("object/authenticated/uploads/") && method === "GET") {
      const key = decodeURIComponent(rest.slice("object/authenticated/uploads/".length));
      const o = objects.get(key);
      return o ? new Response(new Uint8Array(o.body), { headers: { "content-type": o.type } }) : new Response('{"error":"not_found"}', { status: 400 });
    }
    if (rest.startsWith("object/uploads/") && method === "POST") {
      if (!bucket) return new Response('{"statusCode":"404","error":"Bucket not found","message":"Bucket not found"}', { status: 400 });
      const key = rest.slice("object/uploads/".length).split("/").map(decodeURIComponent).join("/");
      objects.set(key, { body: Buffer.from(init.body as Uint8Array), type: h.get("content-type") ?? "" });
      return new Response('{"Key":"x"}');
    }
    return new Response("?", { status: 418 });
  }) as typeof fetch;
  return { fetch: fakeFetch, objects, calls };
}

test("supabase driver: creates the bucket, uploads, downloads, deletes", async () => {
  const fake = fakeSupabase();
  const d = supabaseDriver({ url: "https://abc.supabase.co/", key: "sb_secret_test", fetch: fake.fetch });
  await d.put("fam-1/photo one.webp", Buffer.from("hello"), "image/webp");
  assert.deepEqual(fake.calls.slice(0, 3), ["POST /storage/v1/object/uploads/fam-1/photo%20one.webp", "POST /storage/v1/bucket", "POST /storage/v1/object/uploads/fam-1/photo%20one.webp"]);
  assert.equal(fake.objects.get("fam-1/photo one.webp")?.type, "image/webp");
  assert.equal((await d.get("fam-1/photo one.webp")).toString(), "hello");
  await d.put("fam-1/b.pdf", Buffer.from("pdf"), "application/pdf"); // bucket exists now: single call
  assert.equal(fake.calls.at(-1), "POST /storage/v1/object/uploads/fam-1/b.pdf");
  await d.remove("fam-1/photo one.webp");
  await assert.rejects(() => d.get("fam-1/photo one.webp"));
});

test("supabase driver: wrong key surfaces an error", async () => {
  const fake = fakeSupabase();
  const d = supabaseDriver({ url: "https://abc.supabase.co", key: "wrong", fetch: fake.fetch });
  await assert.rejects(() => d.put("k", Buffer.from("x"), "text/plain"), /401/);
});
