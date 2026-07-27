/**
 * PROD-OPS-24H-01 — read-only public catalog RPC smoke.
 * Extracts public anon key from Production SPA bundle; prints counts/names only.
 * Does not print secrets. Does not mutate data.
 */
const html = await fetch("https://pickvn.app/").then((r) => r.text());
const indexMatch = html.match(/\/assets\/index-[^"']+\.js/);
if (!indexMatch) {
  console.log(JSON.stringify({ error: "INDEX_BUNDLE_NOT_FOUND" }));
  process.exit(1);
}
const clientHref = html.match(/\/assets\/supabaseClient-[^"']+\.js/);
const clientUrl = clientHref
  ? `https://pickvn.app${clientHref[0]}`
  : `https://pickvn.app${indexMatch[0]}`;
const clientJs = await fetch(clientUrl).then((r) => r.text());
const urlMatch = clientJs.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
const keyMatch = clientJs.match(
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/
);
if (!urlMatch || !keyMatch) {
  console.log(
    JSON.stringify({
      error: "SUPABASE_CONFIG_NOT_FOUND",
      indexBundle: indexMatch[0],
      clientUrl,
      hostFound: Boolean(urlMatch),
      anonPresent: Boolean(keyMatch),
    })
  );
  process.exit(2);
}

const base = urlMatch[0];
const key = keyMatch[0];

async function rpc(name, body) {
  const res = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { parseError: true, length: text.length };
  }
  return { status: res.status, data };
}

function normalizeRows(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.rows)) return data.rows;
  return null;
}

const clubs = await rpc("public_catalog_list_clubs", {
  p_limit: 50,
  p_offset: 0,
});
const courts = await rpc("public_catalog_list_courts", {
  p_limit: 50,
  p_offset: 0,
});
const clubsRows = normalizeRows(clubs.data);
const courtsRows = normalizeRows(courts.data);

const blob = JSON.stringify(clubs.data) + JSON.stringify(courts.data);
const sensitive = [
  "email",
  "phone",
  "owner_id",
  "tenant_id",
  "service_role",
  "password",
  "created_by",
  "internal_note",
  "billing",
  "stripe",
];
const privacyFieldScan = Object.fromEntries(
  sensitive.map((s) => {
    const re = new RegExp(`"${s}"\\s*:`, "i");
    return [s, re.test(blob) ? "HIT" : "ABSENT"];
  })
);

console.log(
  JSON.stringify(
    {
      observedAtUtc: new Date().toISOString(),
      indexBundle: indexMatch[0],
      supabaseHost: urlMatch[0].replace("https://", ""),
      anonKeyPresent: true,
      anonKeyPrinted: false,
      clubsHttp: clubs.status,
      courtsHttp: courts.status,
      clubsCount: clubsRows ? clubsRows.length : "NON_ARRAY",
      courtsCount: courtsRows ? courtsRows.length : "NON_ARRAY",
      clubNames: (clubsRows || [])
        .map((r) => r.display_name || r.name || r.slug)
        .filter(Boolean),
      courtNames: (courtsRows || [])
        .map((r) => r.display_name || r.name)
        .filter(Boolean),
      clubsSampleKeys:
        clubsRows && clubsRows[0] ? Object.keys(clubsRows[0]).sort() : [],
      courtsSampleKeys:
        courtsRows && courtsRows[0] ? Object.keys(courtsRows[0]).sort() : [],
      privacyFieldScan,
      clubsError:
        clubs.status >= 400
          ? typeof clubs.data === "object"
            ? clubs.data.message || clubs.data.code || "HTTP_ERROR"
            : "HTTP_ERROR"
          : null,
      courtsError:
        courts.status >= 400
          ? typeof courts.data === "object"
            ? courts.data.message || courts.data.code || "HTTP_ERROR"
            : "HTTP_ERROR"
          : null,
    },
    null,
    2
  )
);
