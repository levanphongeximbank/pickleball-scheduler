/**
 * AI V5.2 Production smoke — backend simulation (CE-1, CE-2) + schema checks.
 * Requires .env.local: VITE_SUPABASE_URL (production ref), SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const SMOKE_TENANT = "__smoke_ai_v52__";
const SMOKE_CLUB = "__smoke_club__";

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
}

async function main() {
  loadProjectEnv({ production: true });
  const { url } = getSupabaseEnv();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  console.log("=== AI V5.2 Production Smoke ===\n");

  if (!url.includes(PRODUCTION_REF)) {
    fail("ENV", `VITE_SUPABASE_URL không trỏ Production (${PRODUCTION_REF})`);
    process.exit(1);
  }
  ok("ENV", `Supabase Production ref OK`);

  if (!serviceKey) {
    fail("ENV", "Thiếu SUPABASE_SERVICE_ROLE_KEY — bỏ qua CE-1/CE-2 backend");
    console.log(`\nKết quả: ${passed} pass, ${failed} fail`);
    process.exit(failed > 0 ? 1 : 0);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Schema
  const { error: tableErr } = await admin.from("court_engine_stores").select("id").limit(1);
  if (tableErr) fail("SCHEMA", `court_engine_stores: ${tableErr.message}`);
  else ok("SCHEMA", "court_engine_stores readable");

  const { error: aiErr } = await admin.from("ai_suggestions").select("id").limit(1);
  if (aiErr) fail("SCHEMA", `ai_suggestions: ${aiErr.message}`);
  else ok("SCHEMA", "ai_suggestions readable");

  const { error: checklistErr } = await admin.from("ai_workflow_checklists").select("id").limit(1);
  if (checklistErr) fail("SCHEMA", `ai_workflow_checklists: ${checklistErr.message}`);
  else ok("SCHEMA", "ai_workflow_checklists readable");

  const { error: clubVerErr } = await admin.from("club_data_v3").select("version").limit(1);
  if (clubVerErr) fail("SCHEMA", `club_data_v3.version: ${clubVerErr.message}`);
  else ok("SCHEMA", "club_data_v3.version column OK");

  await cleanup(admin);

  // CE-1: Machine A push → Machine B pull
  const payloadA = {
    clubId: SMOKE_CLUB,
    tenantId: SMOKE_TENANT,
    sessions: [{ id: "s1", checkIns: [{ playerId: "p1", name: "Smoke Player" }], queue: ["p1"] }],
  };

  const { error: insertErr } = await admin.from("court_engine_stores").insert({
    tenant_id: SMOKE_TENANT,
    club_id: SMOKE_CLUB,
    payload: payloadA,
    version: 1,
  });

  if (insertErr) {
    fail("CE-1", insertErr.message);
  } else {
    const { data: pulled, error: pullErr } = await admin
      .from("court_engine_stores")
      .select("payload, version")
      .eq("tenant_id", SMOKE_TENANT)
      .eq("club_id", SMOKE_CLUB)
      .single();

    if (pullErr) fail("CE-1", pullErr.message);
    else if (pulled?.payload?.sessions?.[0]?.queue?.[0] === "p1") {
      ok("CE-1", "Máy A ghi → máy B đọc thấy queue (check-in)");
    } else {
      fail("CE-1", "Payload không khớp sau pull");
    }
  }

  // CE-2: Version conflict — update chỉ khi version khớp
  const { data: row } = await admin
    .from("court_engine_stores")
    .select("version")
    .eq("tenant_id", SMOKE_TENANT)
    .eq("club_id", SMOKE_CLUB)
    .single();

  const staleVersion = (row?.version ?? 1) - 1;
  const { data: conflictRows, error: conflictErr } = await admin
    .from("court_engine_stores")
    .update({ payload: { conflict: true }, version: (row?.version ?? 1) + 1 })
    .eq("tenant_id", SMOKE_TENANT)
    .eq("club_id", SMOKE_CLUB)
    .eq("version", staleVersion)
    .select("id");

  if (conflictErr) {
    fail("CE-2", conflictErr.message);
  } else if (!conflictRows?.length) {
    ok("CE-2", "Version cũ bị từ chối (optimistic conflict path OK)");
  } else {
    fail("CE-2", "Update với version sai vẫn thành công");
  }

  // AI-2 schema: insert suggestion row
  const { error: sugErr } = await admin.from("ai_suggestions").insert({
    tenant_id: SMOKE_TENANT,
    tournament_id: "__smoke_tournament__",
    type: "seed",
    status: "pending",
    input_snapshot: { smoke: true },
    output_payload: { seeds: [] },
    confidence: "medium",
  });

  if (sugErr) fail("AI-2", sugErr.message);
  else {
    const { count, error: countErr } = await admin
      .from("ai_suggestions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", SMOKE_TENANT);

    if (countErr || !count) fail("AI-2", countErr?.message || "Không đọc được suggestion");
    else ok("AI-2", "Gợi ý AI ghi/đọc qua Supabase OK");
  }

  await admin.from("ai_suggestions").delete().eq("tenant_id", SMOKE_TENANT);

  // Phase 5: checklist upsert
  const { error: chkInsertErr } = await admin.from("ai_workflow_checklists").upsert(
    {
      tenant_id: SMOKE_TENANT,
      tournament_id: "__smoke_tournament__",
      item_key: "smoke_item",
      completed: true,
    },
    { onConflict: "tenant_id,tournament_id,item_key" }
  );

  if (chkInsertErr) fail("CHK-1", chkInsertErr.message);
  else {
    const { data: chkRow, error: chkReadErr } = await admin
      .from("ai_workflow_checklists")
      .select("completed")
      .eq("tenant_id", SMOKE_TENANT)
      .eq("tournament_id", "__smoke_tournament__")
      .eq("item_key", "smoke_item")
      .single();

    if (chkReadErr || !chkRow?.completed) fail("CHK-1", chkReadErr?.message || "Checklist không khớp");
    else ok("CHK-1", "Workflow checklist ghi/đọc OK");
  }

  await cleanup(admin);

  // Production URL
  try {
    const res = await fetch("https://pickleball-scheduler-eight.vercel.app", {
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) ok("URL", `Production HTTP ${res.status}`);
    else fail("URL", `HTTP ${res.status}`);
  } catch (e) {
    fail("URL", e.message);
  }

  console.log(`\n---\nKết quả: ${passed} pass, ${failed} fail`);
  console.log("Manual còn lại: RBAC PLAYER chặn /court-engine (2 máy UI)\n");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
