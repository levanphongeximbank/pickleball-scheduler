/**
 * AI V5.2 Staging smoke — schema + CE-1/CE-2 + AI-2 + checklist.
 * Requires .env.local: VITE_SUPABASE_URL (staging ref), STAGING_SUPABASE_SERVICE_ROLE_KEY
 *   hoặc SUPABASE_SERVICE_ROLE_KEY khi URL trỏ staging.
 */
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const SMOKE_TENANT = "__smoke_ai_v52_staging__";
const SMOKE_CLUB = "__smoke_club_staging__";

let passed = 0;
let failed = 0;

function ok(id, msg) {
  passed += 1;
  console.log(`✅ ${id}: ${msg}`);
}

function fail(id, msg) {
  failed += 1;
  console.error(`❌ ${id}: ${msg}`);
}

async function cleanup(admin) {
  await admin.from("court_engine_active_sessions").delete().eq("tenant_id", SMOKE_TENANT);
  await admin.from("court_engine_stores").delete().eq("tenant_id", SMOKE_TENANT);
  await admin.from("ai_workflow_checklists").delete().eq("tenant_id", SMOKE_TENANT);
  await admin.from("ai_suggestions").delete().eq("tenant_id", SMOKE_TENANT);
}

async function main() {
  loadProjectEnv();
  const { url } = getSupabaseEnv();
  const serviceKey = String(
    process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      ""
  ).trim();

  console.log("=== AI V5.2 Staging Smoke ===\n");

  if (!url.includes(STAGING_REF)) {
    fail("ENV", `VITE_SUPABASE_URL phải trỏ staging (${STAGING_REF})`);
    process.exit(1);
  }
  ok("ENV", "Supabase Staging ref OK");

  if (!serviceKey) {
    fail("ENV", "Thiếu STAGING_SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tables = [
    ["court_engine_stores", "SCHEMA-CE"],
    ["ai_suggestions", "SCHEMA-AI"],
    ["ai_workflow_checklists", "SCHEMA-CHK"],
  ];

  for (const [table, id] of tables) {
    const { error } = await admin.from(table).select("id").limit(1);
    if (error) fail(id, `${table}: ${error.message}`);
    else ok(id, `${table} readable`);
  }

  const { error: clubVerErr } = await admin.from("club_data_v3").select("version").limit(1);
  if (clubVerErr) fail("SCHEMA-CLUB", clubVerErr.message);
  else ok("SCHEMA-CLUB", "club_data_v3.version OK");

  await cleanup(admin);

  const { error: insertErr } = await admin.from("court_engine_stores").insert({
    tenant_id: SMOKE_TENANT,
    club_id: SMOKE_CLUB,
    payload: { sessions: [{ queue: ["p1"] }] },
    version: 1,
  });

  if (insertErr) fail("CE-1", insertErr.message);
  else {
    const { data } = await admin
      .from("court_engine_stores")
      .select("payload")
      .eq("tenant_id", SMOKE_TENANT)
      .single();
    if (data?.payload?.sessions?.[0]?.queue?.[0] === "p1") ok("CE-1", "Court engine write/read OK");
    else fail("CE-1", "Payload mismatch");
  }

  const { error: sugErr } = await admin.from("ai_suggestions").insert({
    tenant_id: SMOKE_TENANT,
    tournament_id: "__smoke_t__",
    type: "seed",
    status: "pending",
    input_snapshot: {},
    output_payload: {},
    confidence: "medium",
  });
  if (sugErr) fail("AI-2", sugErr.message);
  else ok("AI-2", "ai_suggestions insert OK");

  const { error: chkErr } = await admin.from("ai_workflow_checklists").upsert(
    {
      tenant_id: SMOKE_TENANT,
      tournament_id: "__smoke_t__",
      item_key: "smoke",
      completed: true,
    },
    { onConflict: "tenant_id,tournament_id,item_key" }
  );
  if (chkErr) fail("CHK-1", chkErr.message);
  else ok("CHK-1", "Checklist upsert OK");

  await cleanup(admin);

  console.log(`\n---\nKết quả: ${passed} pass, ${failed} fail\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
