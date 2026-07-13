import { vercelCurlRequest } from "./phase15-vercel-curl-proxy.mjs";

const base = process.argv[2];
const home = vercelCurlRequest("/", { deployment: base, skipCache: true });
const paths = [...home.body.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
const uniq = [...new Set(paths)];
const found = { ref: false, supabase: false, core: false, chunks: uniq.length };
for (const p of uniq) {
  const c = vercelCurlRequest(p, { deployment: base, skipCache: true });
  const b = c.body || "";
  if (b.includes("qyewbxjsiiyufanzcjcq")) found.ref = true;
  if (b.includes("supabase.co")) found.supabase = true;
  if (b.includes("default_shadow") || b.includes("canonical-adapter") || b.includes("competition-core")) {
    found.core = true;
  }
}
console.log(JSON.stringify(found, null, 2));
