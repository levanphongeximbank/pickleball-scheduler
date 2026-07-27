/**
 * PROD-OPS-24H-01 — read-only fail-closed public catalog smoke.
 * Does not print secrets.
 */
const html = await fetch("https://pickvn.app/").then((r) => r.text());
const href = html.match(/\/assets\/supabaseClient-[^"']+\.js/);
if (!href) {
  console.log(JSON.stringify({ error: "CLIENT_BUNDLE_NOT_FOUND" }));
  process.exit(1);
}
const js = await fetch(`https://pickvn.app${href[0]}`).then((r) => r.text());
const base = js.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];
const key = js.match(
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/
)?.[0];
if (!base || !key) {
  console.log(JSON.stringify({ error: "SUPABASE_CONFIG_NOT_FOUND" }));
  process.exit(2);
}

async function call(body) {
  const res = await fetch(`${base}/rest/v1/rpc/public_catalog_list_clubs`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let message = null;
  try {
    message = JSON.parse(text).message || null;
  } catch {
    message = null;
  }
  return { status: res.status, message };
}

const invalidSort = await call({
  p_limit: 50,
  p_offset: 0,
  p_sort: "__invalid__",
});
const overLimit = await call({ p_limit: 999, p_offset: 0 });

console.log(
  JSON.stringify(
    {
      observedAtUtc: new Date().toISOString(),
      invalidSortHttp: invalidSort.status,
      invalidSortMessage: invalidSort.message,
      overLimitHttp: overLimit.status,
      overLimitMessage: overLimit.message,
      secretsPrinted: false,
    },
    null,
    2
  )
);
