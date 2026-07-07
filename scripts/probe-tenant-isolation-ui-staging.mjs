/**
 * JWT probe — tenant isolation UI data (court count, club_data_v3, cross-tenant).
 * Complements verify-cross-tenant-rls-staging.mjs for browser matrix G3/V1/CL2.
 *
 * Usage: npm run probe:tenant-isolation-staging
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "./load-env.mjs";
import { signInStagingUser } from "./staging-auth-resolve.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const TENANT_A = "venue-staging-a";
const TENANT_B = "venue-staging-b";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function applyStagingEnv() {
  loadProjectEnv();
  const qaPath = path.join(rootDir, ".env.staging-qa.local");
  if (fs.existsSync(qaPath)) {
    const content = fs.readFileSync(qaPath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i === -1) continue;
      const key = line.slice(0, i).trim();
      let value = line.slice(i + 1).trim();
      process.env[key] = value;
    }
  }

  const stagingPath = path.join(rootDir, ".env.staging.local");
  if (fs.existsSync(stagingPath) && !process.env.STAGING_SUPABASE_ANON_KEY) {
    const content = fs.readFileSync(stagingPath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line.startsWith("VITE_SUPABASE_URL=")) {
        process.env.STAGING_SUPABASE_URL = line.slice("VITE_SUPABASE_URL=".length).trim();
      }
      if (line.startsWith("VITE_SUPABASE_ANON_KEY=")) {
        process.env.STAGING_SUPABASE_ANON_KEY = line.slice("VITE_SUPABASE_ANON_KEY=".length).trim();
      }
    }
  }

  if (process.env.STAGING_SUPABASE_URL?.includes(STAGING_REF)) {
    process.env.VITE_SUPABASE_URL = process.env.STAGING_SUPABASE_URL;
  }
  if (process.env.STAGING_SUPABASE_ANON_KEY) {
    process.env.VITE_SUPABASE_ANON_KEY = process.env.STAGING_SUPABASE_ANON_KEY;
  }
}

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✅ ${message}`);
}

async function probeOwner(label, email, ownTenant, otherClubId, expectedCourts, expectedLeague) {
  const session = await signInStagingUser(email);
  if (session.error || !session.client) {
    fail(`${label} login: ${session.error || "no client"}`);
  }

  const { data: profile } = await session.client
    .from("profiles")
    .select("venue_id, role")
    .eq("email", email)
    .maybeSingle();

  if (profile?.venue_id !== ownTenant) {
    fail(`${label} profile venue_id=${profile?.venue_id} expected ${ownTenant}`);
  }
  ok(`${label} profile venue_id=${ownTenant}`);

  const { data: venues } = await session.client.from("venues").select("id, name");
  const foreignVenues = (venues || []).filter((v) => v.id !== ownTenant);
  if (foreignVenues.length > 0) {
    fail(`${label} thấy venue khác: ${foreignVenues.map((v) => v.id).join(", ")}`);
  }
  ok(`${label} venues: chỉ ${ownTenant}`);

  const ownClubId = ownTenant === TENANT_A ? "club-staging-a" : "club-staging-b";
  const { data: ownClub } = await session.client
    .from("club_data_v3")
    .select("club_id, venue_id, data")
    .eq("club_id", ownClubId)
    .maybeSingle();

  const courtCount = ownClub?.data?.courts?.length ?? 0;
  const league = ownClub?.data?.leagues?.[0]?.name ?? "";
  if (courtCount !== expectedCourts) {
    fail(`${label} court count=${courtCount} expected ${expectedCourts}`);
  }
  if (league !== expectedLeague) {
    fail(`${label} league=${league} expected ${expectedLeague}`);
  }
  ok(`${label} club_data own: ${courtCount} courts, league=${league}`);

  const { data: foreignClub } = await session.client
    .from("club_data_v3")
    .select("club_id")
    .eq("club_id", otherClubId);

  if ((foreignClub || []).length > 0) {
    fail(`${label} LEAK — đọc được ${otherClubId}`);
  }
  ok(`${label} club_data cross-tenant blocked (${otherClubId})`);

  const { data: subs } = await session.client
    .from("tenant_subscriptions")
    .select("tenant_id, status")
    .eq("tenant_id", ownTenant);

  if (!subs?.length) {
    fail(`${label} không có subscription cho ${ownTenant}`);
  }
  ok(`${label} subscription: ${subs[0].status}`);

  return { ok: true };
}

async function main() {
  console.log("=== Tenant Isolation UI Probe (JWT) ===\n");
  applyStagingEnv();

  const url = String(process.env.VITE_SUPABASE_URL || "");
  if (!url.includes(STAGING_REF)) {
    fail(`URL không trỏ staging ${STAGING_REF}`);
  }

  await probeOwner("Owner A", "owner@staging.local", TENANT_A, "club-staging-b", 3, "Giải A");
  await probeOwner("Owner B", "owner-b@staging.local", TENANT_B, "club-staging-a", 5, "Giải B");

  console.log("\n✅ Tenant isolation UI probe PASS (JWT layer).\n");
}

main().catch((error) => fail(error?.message || String(error)));
