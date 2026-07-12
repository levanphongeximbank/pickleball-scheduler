/**
 * TT-1C — Shadow compare blob vs cloud (staging-safe).
 *
 * Usage:
 *   node scripts/compare-team-tournament-blob-cloud.mjs --tournament-id=ID --club-id=CLUB
 *   node scripts/compare-team-tournament-blob-cloud.mjs --blob-path=./fixture.json --tournament-id=ID --club-id=CLUB
 *   node scripts/compare-team-tournament-blob-cloud.mjs ... --output=docs/v5/qa-evidence/phase-tt1c/SHADOW_COMPARE_REPORT.json
 *
 * Auth: signs in as STAGING_BTC_EMAIL (default owner@staging.local) via env password — never logs tokens.
 * STAGING ONLY: qyewbxjsiiyufanzcjcq
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";
import {
  extractTeamTournamentsFromClubBlob,
  extractTeamTournamentsFromJson,
} from "./lib/team-tournament-seed-core.mjs";
import {
  buildShadowCompareReport,
  classifyReadFailure,
} from "./lib/team-tournament-shadow-compare-report.mjs";
import { signInStagingUser } from "./staging-auth-resolve.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const get = (prefix) => argv.find((a) => a.startsWith(prefix))?.split("=")[1] || "";
  return {
    tournamentId: get("--tournament-id="),
    clubId: get("--club-id="),
    blobPath: get("--blob-path="),
    output: get("--output="),
    btcEmail: get("--btc-email=") || process.env.STAGING_BTC_EMAIL || "owner@staging.local",
  };
}

function assertStagingOnly(url) {
  if (!url.includes(STAGING_REF)) {
    throw new Error(`Refusing non-staging URL (expected ${STAGING_REF})`);
  }
  if (url.includes(PRODUCTION_REF)) {
    throw new Error("Refusing production Supabase URL");
  }
}

async function loadBlobTournament({ clubId, tournamentId, blobPath, authClient, adminClient }) {
  if (blobPath) {
    const raw = JSON.parse(readFileSync(path.resolve(blobPath), "utf8"));
    const list = extractTeamTournamentsFromJson(raw);
    const record = list.find((t) => String(t.id) === String(tournamentId)) || null;
    return {
      status: record ? "OK" : "ERROR",
      code: record ? null : "blob_not_found",
      error: record ? null : "Tournament not in blob fixture",
      record,
      source: "blob-path",
    };
  }

  if (!clubId) {
    return {
      status: "ERROR",
      code: "missing_club_id",
      error: "Thiếu --club-id= hoặc --blob-path=",
      record: null,
      source: null,
    };
  }

  if (!authClient && !adminClient) {
    return {
      status: "BLOCKED",
      code: "authorization_error",
      error: "No authenticated client for club_data_v3",
      record: null,
      source: "club_data_v3",
    };
  }

  const tryClient = authClient || adminClient;
  let readClient = tryClient;
  let readVia = authClient ? "club_data_v3" : "club_data_v3(service_role)";

  let { data, error } = await readClient
    .from("club_data_v3")
    .select("club_id, venue_id, data")
    .eq("club_id", clubId)
    .maybeSingle();

  if ((!data || error) && authClient && adminClient) {
    ({ data, error } = await adminClient
      .from("club_data_v3")
      .select("club_id, venue_id, data")
      .eq("club_id", clubId)
      .maybeSingle());
    readVia = "club_data_v3(service_role)";
  }

  if (error) {
    return {
      status: classifyReadFailure(error, "blob").status,
      code: classifyReadFailure(error, "blob").code,
      error: error.message,
      record: null,
      source: readVia,
    };
  }

  if (!data) {
    return {
      status: "ERROR",
      code: "blob_not_found",
      error: `club_data_v3 row missing for club_id=${clubId}`,
      record: null,
      source: readVia,
    };
  }

  const list = extractTeamTournamentsFromClubBlob(data);
  const record = list.find((t) => String(t.id) === String(tournamentId)) || null;
  return {
    status: record ? "OK" : "ERROR",
    code: record ? null : "blob_not_found",
    error: record ? null : `Tournament ${tournamentId} not in club blob`,
    record,
    source: readVia,
    rowClubId: data.club_id,
  };
}

async function loadCloudTeamData(tournamentId, authClient) {
  if (!authClient) {
    return {
      status: "BLOCKED",
      code: "authorization_error",
      error: "Missing authenticated session for team_tournament_get_setup",
      teamData: null,
    };
  }

  const { data, error } = await authClient.rpc("team_tournament_get_setup", {
    p_tournament_id: String(tournamentId),
    p_viewer_team_id: null,
  });

  if (error) {
    const classified = classifyReadFailure(error, "cloud");
    return { ...classified, teamData: null };
  }

  if (!data?.ok) {
    const code = String(data?.code || "").toLowerCase();
    const message = data?.error || data?.code || "Cloud get_setup failed";
    if (code.includes("forbidden") || code.includes("not_authenticated")) {
      return {
        status: "BLOCKED",
        code: "authorization_error",
        error: message,
        teamData: null,
      };
    }
    return {
      status: "ERROR",
      code: "cloud_read_error",
      error: message,
      teamData: null,
    };
  }

  return {
    status: "OK",
    code: null,
    error: null,
    teamData: data.tournament?.teamData || null,
  };
}

async function main() {
  loadProjectEnv();
  const args = parseArgs(process.argv.slice(2));

  if (!args.tournamentId) {
    console.error("Thiếu --tournament-id=");
    process.exit(1);
  }

  const env = getStagingSupabaseEnv();
  assertStagingOnly(env.url);

  const signIn = await signInStagingUser(args.btcEmail);
  let adminClient = null;
  if (env.serviceKey?.length > 20 && env.url.includes(STAGING_REF)) {
    adminClient = createClient(env.url, env.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const authClient = signIn.client;
  const blobLoad = await loadBlobTournament({
    clubId: args.clubId,
    tournamentId: args.tournamentId,
    blobPath: args.blobPath,
    authClient,
    adminClient,
  });

  const cloudLoad = await loadCloudTeamData(args.tournamentId, authClient);

  const blobClubId = blobLoad.record?.clubId || blobLoad.rowClubId || null;
  const cliClubId = args.clubId || blobClubId || null;
  const clubIdMatch =
    !cliClubId || !blobClubId ? null : String(cliClubId) === String(blobClubId);

  /** @type {import('./lib/team-tournament-shadow-compare-report.mjs').buildShadowCompareReport} */
  let compare = null;
  let overallStatus = "OK";

  if (blobLoad.status !== "OK") {
    overallStatus = blobLoad.status;
  } else if (cloudLoad.status !== "OK") {
    overallStatus = cloudLoad.status;
  } else if (!cloudLoad.teamData) {
    overallStatus = "ERROR";
    cloudLoad.status = "ERROR";
    cloudLoad.code = "cloud_read_error";
    cloudLoad.error = "Cloud returned empty teamData";
  } else {
    compare = buildShadowCompareReport(blobLoad.record.teamData, cloudLoad.teamData);
    overallStatus = compare.ok ? "OK" : "MISMATCH";
  }

  if (clubIdMatch === false) {
    overallStatus = overallStatus === "OK" ? "ERROR" : overallStatus;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    environment: { ref: STAGING_REF, btcEmail: args.btcEmail },
    tournamentId: args.tournamentId,
    clubId: {
      cli: cliClubId,
      blob: blobClubId,
      match: clubIdMatch,
    },
    status: overallStatus,
    blobRead: {
      status: blobLoad.status,
      code: blobLoad.code,
      error: blobLoad.error,
      source: blobLoad.source,
    },
    cloudRead: {
      status: cloudLoad.status,
      code: cloudLoad.code,
      error: cloudLoad.error,
    },
    auth: {
      signIn: signIn.error ? "FAILED" : "OK",
      signInError: signIn.error || null,
    },
    compare: compare
      ? {
          ok: compare.ok,
          mismatchCount: compare.mismatchCount,
          summaryByType: compare.summaryByType,
          sections: compare.sections,
          dreambreakerPilot: compare.dreambreakerPilot,
          mismatches: compare.mismatches,
        }
      : null,
    notes: [],
  };

  if (cloudLoad.status === "BLOCKED") {
    report.notes.push("Cloud read BLOCKED — mismatches not computed (no fake empty cloud compare).");
  }
  if (cloudLoad.status === "ERROR") {
    report.notes.push("Cloud read ERROR — mismatches not computed.");
  }
  if (compare?.dreambreakerPilot?.pilotUsesDreambreaker) {
    report.notes.push(
      "Pilot uses DreamBreaker — verify cloud path before cloud_primary (legacy-only = NO-GO if required)."
    );
  }

  const json = JSON.stringify(report, null, 2);
  console.log(json);

  if (args.output) {
    const outPath = path.resolve(rootDir, args.output);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, json, "utf8");
  }

  if (overallStatus === "OK") {
    process.exit(0);
  }
  if (overallStatus === "MISMATCH") {
    process.exit(3);
  }
  process.exit(2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
