import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const courtResourceRoot = path.join(root, "src/features/court-resource");

function listJavaScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(absolute);
    return entry.isFile() && entry.name.endsWith(".js") ? [absolute] : [];
  });
}

test("court-resource has one gateway implementation and no reverse business dependency", () => {
  const files = listJavaScriptFiles(courtResourceRoot);
  const prohibited =
    /(?:tournamentBookingService|features[\\/]competition-core|features[\\/]team-tournament|features[\\/]individual-tournament|features[\\/]court-engine|features[\\/]ai-director|features[\\/]ai-assistant|tournament[\\/]engines)/;

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, prohibited, path.relative(root, file));
  }

  const gatewayFiles = files.filter(
    (file) => path.basename(file) === "courtResourceGateway.js"
  );
  assert.deepEqual(
    gatewayFiles.map((file) => path.relative(root, file).replaceAll("\\", "/")),
    ["src/features/court-resource/services/courtResourceGateway.js"]
  );

  const compatibility = readFileSync(
    path.join(root, "src/features/venue-court/services/courtResourceGateway.js"),
    "utf8"
  );
  assert.match(
    compatibility,
    /^\s*\/\/[^\n]*\nexport \* from ["']\.\.\/\.\.\/court-resource\/services\/courtResourceGateway\.js["'];?\s*$/
  );
  assert.doesNotMatch(compatibility, /\bfunction\b|\bconst\s+defaultDeps\b/);
});

test("tournament booking is a facade above the gateway and cannot form a cycle", () => {
  const facade = readFileSync(
    path.join(root, "src/domain/tournamentBookingService.js"),
    "utf8"
  );
  const gateway = readFileSync(
    path.join(root, "src/features/court-resource/services/courtResourceGateway.js"),
    "utf8"
  );
  // Facade translates/composes: default reserve path must go through Court Resource
  // Gateway. Compatibility helpers (clubStorage / courtBookingEngine) may persist or
  // validate caller-authorized occupancy but must not load legacy inventory authority.
  assert.match(facade, /features\/court-resource\/index\.js/);
  assert.match(facade, /\breserveCourts\b/);
  assert.match(facade, /\breleaseCourts\b/);
  assert.match(facade, /export async function syncTournamentCourtBookings/);
  assert.match(facade, /await reserveCourts\(/);
  assert.doesNotMatch(facade, /\bloadCourtsForClub\b/);
  assert.doesNotMatch(facade, /localStorage\.getItem/);
  assert.doesNotMatch(gateway, /tournamentBookingService/);
});

test("Phase 3A package excludes reservation cutover and external index ownership", () => {
  const migrationRoot = path.join(
    root,
    "docs/v5/migrations/court-resource-post427-canonical-reconciliation-01"
  );
  const apply = readFileSync(path.join(migrationRoot, "02_APPLY.sql"), "utf8");
  const rollback = readFileSync(path.join(migrationRoot, "04_ROLLBACK.sql"), "utf8");
  const readme = readFileSync(path.join(migrationRoot, "README.md"), "utf8");
  assert.doesNotMatch(apply, /(?:CREATE|ALTER|DROP)\s+TABLE\s+(?:IF\s+EXISTS\s+)?public\.court_reservations/i);
  assert.doesNotMatch(rollback, /court_clusters_id_venue_scope_uidx|clubs_id_tenant_scope_uidx/i);
  assert.doesNotMatch(rollback, /DROP\s+(?:TABLE|INDEX)[^;]*(?:court_clusters|public\.clubs)/i);
  assert.match(readme, /Package-owned indexes/);
  assert.match(readme, /not add or\s+alter reservations/i);
});

test("club_data_v3 is documented as transitional, not the Physical Court master", () => {
  const foundation = readFileSync(
    path.join(root, "docs/v5/SHARED_COURT_RESOURCE_FOUNDATION.md"),
    "utf8"
  );
  const inventory = readFileSync(
    path.join(root, "src/features/venue-court/services/canonicalCloudCourtInventory.js"),
    "utf8"
  );
  assert.match(foundation, /transitional Club operational inventory/i);
  assert.match(foundation, /not.*system-wide Physical Court master/i);
  assert.match(inventory, /not the system-wide canonical\s+\* Physical Court master/i);
  assert.match(inventory, /Does not fabricate clusterId from venueId/);
  assert.doesNotMatch(inventory, /\$\{[^}]*venueId[^}]*\}-main/);
});

test("venue-court index keeps #429 binder exports and #428 canonical gateway re-export", () => {
  const index = readFileSync(
    path.join(root, "src/features/venue-court/index.js"),
    "utf8"
  );
  assert.match(index, /bindClubCourtsToCluster/);
  assert.match(index, /clusterBindingCore/);
  assert.match(index, /clusterBindingContract/);
  assert.match(
    index,
    /from ["']\.\.\/court-resource\/services\/courtResourceGateway\.js["']/
  );
  assert.match(
    index,
    /from ["']\.\.\/court-resource\/constants\/courtResourceContract\.js["']/
  );
  assert.doesNotMatch(
    index,
    /from ["']\.\/services\/courtResourceGateway\.js["']/
  );
});

test("transitional cluster binder is not Physical Court identity or reservation authority", () => {
  const binder = readFileSync(
    path.join(root, "src/features/venue-court/services/bindClubCourtsToClusterService.js"),
    "utf8"
  );
  const core = readFileSync(
    path.join(root, "src/features/venue-court/services/clusterBindingCore.js"),
    "utf8"
  );
  const access = readFileSync(
    path.join(root, "src/features/court-resource/contracts/clubOperationalAccess.js"),
    "utf8"
  );
  const foundation = readFileSync(
    path.join(root, "docs/v5/SHARED_COURT_RESOURCE_FOUNDATION.md"),
    "utf8"
  );
  for (const source of [binder, core]) {
    assert.doesNotMatch(source, /\breserveCourts\b|\breleaseCourts\b/);
    assert.doesNotMatch(source, /from ["'][^"']*court-resource[^"']*["']/);
    assert.doesNotMatch(source, /createCanonicalPhysicalCourt|court_resource_physical_courts/);
  }
  assert.match(binder, /does not create physicalCourtId UUIDs/);
  assert.doesNotMatch(access, /registeredClusterId|registered_cluster_id/);
  assert.match(foundation, /transitional operational cluster-binding compatibility writer/i);
  assert.match(foundation, /registered_cluster_id[\s\S]*court_resource_club_operational_access/);
  assert.match(foundation, /CLUSTER BINDING/);
});
