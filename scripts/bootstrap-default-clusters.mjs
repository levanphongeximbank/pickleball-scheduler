/**
 * Bootstrap default court cluster per venue + assign owner.
 * Usage: node scripts/bootstrap-default-clusters.mjs [--venue-id=venue-staging-a]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv } from "./load-env.mjs";
import {
  assignUserToCluster,
  ensureDefaultClusterForVenue,
} from "../src/features/court-cluster/services/courtClusterService.js";
import { loadCourtsForClub } from "../src/domain/clubStorage.js";
import { ensureCourtsHaveClusterId } from "../src/features/court-cluster/services/courtClusterService.js";
import { saveCourtsForClub } from "../src/domain/clubStorage.js";
import { loadClubs } from "../src/data/club.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadStagingEnv() {
  const filePath = path.join(rootDir, ".env.staging.local");
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const merged = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    merged[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return merged;
}

async function bootstrapSupabase(venueId, clusterId, ownerUserId) {
  const env = loadStagingEnv();
  const url = env.VITE_SUPABASE_URL || "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceKey) {
    return { ok: false, skipped: true };
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await admin.from("court_clusters").upsert({
    id: clusterId,
    venue_id: venueId,
    name: "Cụm chính",
    slug: "main",
    status: "active",
    court_count: 0,
    owner_user_id: ownerUserId || null,
    updated_at: new Date().toISOString(),
  });

  if (ownerUserId) {
    await admin.from("user_cluster_assignments").upsert({
      user_id: ownerUserId,
      cluster_id: clusterId,
      role: "CLUSTER_OWNER",
    });
  }

  return { ok: true };
}

function bootstrapLocalCourts(venueId, clusterId) {
  for (const club of loadClubs()) {
    if (club.venueId !== venueId && club.tenantId !== venueId) {
      continue;
    }

    const courts = loadCourtsForClub(club.id);
    if (!courts.length) {
      continue;
    }

    const stamped = ensureCourtsHaveClusterId(courts, venueId).map((court) => ({
      ...court,
      clusterId: court.clusterId || clusterId,
    }));
    saveCourtsForClub(stamped, club.id);
    console.log(`  courts stamped for club ${club.id}: ${stamped.length}`);
  }
}

async function main() {
  loadProjectEnv();
  const venueArg = process.argv.find((arg) => arg.startsWith("--venue-id="));
  const venueFilter = venueArg ? venueArg.split("=")[1] : null;

  const venues = loadClubs()
    .map((club) => club.venueId || club.tenantId)
    .filter(Boolean);
  const uniqueVenues = [...new Set(venues)];

  const targets = venueFilter ? uniqueVenues.filter((id) => id === venueFilter) : uniqueVenues;

  if (targets.length === 0) {
    console.log("No venues found in club registry. Pass --venue-id=...");
    process.exit(0);
  }

  console.log("=== Bootstrap default court clusters ===\n");

  for (const venueId of targets) {
    const result = ensureDefaultClusterForVenue(venueId);
    if (!result.ok) {
      console.warn(`⚠️  ${venueId}: ${result.error}`);
      continue;
    }

    const cluster = result.cluster;
    console.log(`✅ ${venueId} → ${cluster.id}${result.created ? " (created)" : ""}`);
    bootstrapLocalCourts(venueId, cluster.id);

    const cloud = await bootstrapSupabase(venueId, cluster.id, cluster.ownerUserId);
    if (cloud.ok && !cloud.skipped) {
      console.log(`  cloud upsert OK`);
    }
  }

  console.log("\nDone.\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
