/**
 * Nâng tenant staging A/B lên gói Enterprise (active) để QA full tính năng.
 * Usage: npm run upgrade:staging-enterprise
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const STAGING_TENANTS = ["venue-staging-a", "venue-staging-b"];
const PLAN_ID = "plan-ENTERPRISE";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadStagingEnv() {
  const filePath = path.join(rootDir, ".env.staging.local");
  if (!fs.existsSync(filePath)) {
    throw new Error("Thiếu .env.staging.local");
  }

  const merged = {};
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    merged[key] = value;
  }
  return merged;
}

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✅ ${message}`);
}

async function main() {
  console.log("=== Upgrade Staging → Enterprise ===\n");

  const env = loadStagingEnv();
  const url = String(env.VITE_SUPABASE_URL || "").trim();
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url.includes(STAGING_REF)) {
    fail(`URL không phải staging ${STAGING_REF}`);
  }
  if (!serviceKey) {
    fail("Thiếu SUPABASE_SERVICE_ROLE_KEY trong .env.staging.local");
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const periodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  for (const tenantId of STAGING_TENANTS) {
    const { error: venueError } = await admin
      .from("venues")
      .update({ status: "active", updated_at: now })
      .eq("id", tenantId);

    if (venueError) fail(`venues ${tenantId}: ${venueError.message}`);
    ok(`venue ${tenantId} → active`);

    const subId = `sub-${tenantId}-enterprise`;
    const { data: existing } = await admin
      .from("tenant_subscriptions")
      .select("id")
      .eq("tenant_id", tenantId)
      .limit(1);

    const rowId = existing?.[0]?.id || subId;
    const payload = {
      id: rowId,
      tenant_id: tenantId,
      plan_id: PLAN_ID,
      status: "active",
      billing_cycle: "yearly",
      start_date: now,
      end_date: periodEnd,
      trial_start_date: null,
      trial_end_date: null,
      grace_period_until: null,
      auto_renew: true,
      updated_at: now,
    };

    const { error: subError } = existing?.length
      ? await admin.from("tenant_subscriptions").update(payload).eq("tenant_id", tenantId)
      : await admin.from("tenant_subscriptions").insert(payload);

    if (subError) fail(`subscription ${tenantId}: ${subError.message}`);
    ok(`subscription ${tenantId} (${rowId}) → ENTERPRISE active (đến ${periodEnd.slice(0, 10)})`);
  }

  console.log("\n✅ Staging tenants đã ở gói Enterprise. Reload app (F5) để billing bridge cập nhật.");
}

main().catch((err) => fail(err?.message || String(err)));
