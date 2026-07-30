import { getSupabaseAuthClient } from "../../auth/supabaseClient.js";
import { rpcV2ClubGet, rpcV2ClubListRegistry } from "../club/services/clubStorageV2RpcService.js";
import { createClub as createClubCommand } from "../club/services/clubTenantService.js";
import { createCourtClusterRecord } from "../../models/courtCluster.js";
import { rpcAdminUpsertCluster, rpcListRegisterableClusters } from "../court-cluster/services/courtClaimRequestRpcService.js";
import {
  rpcPlatformResolveAthleteProfile,
} from "../club/services/clubStorageV2RpcService.js";
import {
  rpcRatingV5GetMyPilotEnrollment,
  rpcRatingV5GetProfile,
  rpcRatingV5StartAssessment,
} from "../pick-vn-rating-v5/services/ratingV5RpcService.js";
import { finalizeMatchViaCompetitionSsot } from "../competition-engine/remote-ssot/finalizeMatchViaCompetitionSsot.js";
import { loadActivePrivatePairingRulesForRuntime } from "../private-pairing-rules/services/privatePairingRulesService.js";
import { getCoachingPageGateway } from "../coaching/runtime/createDefaultCoachingRuntime.js";
import { listPublicClubsRemote, listPublicCourtsRemote, listPublicRankingsRemote, listPublicTournamentsRemote } from "../public-catalog/remote/index.js";
import { getDashboardAnalytics } from "../dashboard-analytics/services/dashboardService.js";
import {
  OPERATOR_ACCEPTANCE_ERROR,
  resolveOperatorAcceptanceAccess,
  resolveOperatorAcceptanceTarget,
} from "./operatorAcceptanceShared.js";
import { evaluateMessagingAcceptanceMode } from "./operatorAcceptanceMessaging.js";
import { runOperatorAcceptanceGlobalProbes } from "./operatorAcceptanceGlobalProbes.js";
import { evaluateOwnerSecurityBoundary } from "./operatorAcceptanceSecurityBoundary.js";
import { PUBLIC_CATALOG_RPC } from "../public-catalog/persistence/schema.js";

function nowIso() {
  return new Date().toISOString();
}

function okStep(id, payload = {}) {
  return {
    id,
    status: "PASS",
    observedAt: nowIso(),
    ...payload,
  };
}

function failStep(id, code, message, payload = {}) {
  return {
    id,
    status: "FAIL",
    code,
    message,
    observedAt: nowIso(),
    ...payload,
  };
}

async function getAuthenticatedSupabaseUser() {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: OPERATOR_ACCEPTANCE_ERROR.CLIENT_UNAVAILABLE };
  }
  const { data: sessionData, error } = await client.auth.getSession();
  if (error) {
    return {
      ok: false,
      code: OPERATOR_ACCEPTANCE_ERROR.SESSION_UNAVAILABLE,
      error: error.message,
    };
  }
  const sessionUserId = sessionData?.session?.user?.id || null;
  return { ok: true, sessionUserId };
}

async function runClubAcceptance({ tenantId }) {
  const listBefore = await rpcV2ClubListRegistry({ tenantId });
  if (!listBefore.ok) {
    return failStep("A-CLUB", listBefore.code || OPERATOR_ACCEPTANCE_ERROR.CLUB_CREATE_FAILED, listBefore.error || "Club registry read failed");
  }
  let club = (listBefore.clubs || [])[0] || null;
  if (!club) {
    const created = await createClubCommand({
      name: `HC Operator Seed Club ${tenantId}`,
      tenantId,
      code: `HC-${tenantId.slice(-6).toUpperCase()}`,
      description: "Browser-session operator acceptance seed",
    });
    if (!created.ok) {
      return failStep(
        "A-CLUB",
        created.code || OPERATOR_ACCEPTANCE_ERROR.CLUB_CREATE_FAILED,
        created.error || "Club create failed"
      );
    }
    club = created.club;
  }
  const readBack = await rpcV2ClubGet(club.id);
  if (!readBack.ok || !readBack.club) {
    return failStep(
      "A-CLUB",
      readBack.code || OPERATOR_ACCEPTANCE_ERROR.CLUB_CREATE_FAILED,
      readBack.error || "Club read-back failed"
    );
  }
  return okStep("A-CLUB", {
    objectId: club.id,
    details: {
      source: "club_* RPC",
      tenantId,
      clubId: club.id,
      canonicalBlob: "club_data_v3",
      legacyTableAbsent: "notObserved",
    },
  });
}

async function runCourtAcceptance({ tenantId }) {
  const cluster = createCourtClusterRecord({
    venueId: tenantId,
    id: `${tenantId}-hc-operator-cluster`,
    name: `HC Operator Cluster ${tenantId}`,
    slug: `hc-operator-${tenantId}`,
  });
  const upserted = await rpcAdminUpsertCluster({ cluster });
  if (!upserted.ok) {
    return failStep(
      "A-COURT",
      upserted.code || OPERATOR_ACCEPTANCE_ERROR.COURT_CLUSTER_FAILED,
      upserted.error || "Cluster upsert failed"
    );
  }
  const listed = await rpcListRegisterableClusters({ search: "HC Operator", limit: 100 });
  if (!listed.ok) {
    return failStep(
      "A-COURT",
      listed.code || OPERATOR_ACCEPTANCE_ERROR.COURT_CLUSTER_FAILED,
      listed.error || "Cluster list failed"
    );
  }
  const found = (listed.clusters || []).find((item) => item.id === upserted.cluster?.id);
  if (!found) {
    return failStep(
      "A-COURT",
      OPERATOR_ACCEPTANCE_ERROR.COURT_CLUSTER_FAILED,
      "Cluster durable read-back missing"
    );
  }
  const foundVenueId = String(found.venueId ?? found.venue_id ?? "").trim();
  if (foundVenueId !== String(tenantId).trim()) {
    return failStep(
      "A-COURT",
      OPERATOR_ACCEPTANCE_ERROR.COURT_TENANT_MISMATCH,
      "Cluster venueId does not match acceptance tenantId",
      {
        details: {
          source: "court_admin_upsert_cluster RPC",
          foundVenueId,
          tenantId,
          tenantIsolation: false,
        },
      }
    );
  }
  return okStep("A-COURT", {
    objectId: found.id,
    details: {
      source: "court_admin_upsert_cluster RPC",
      foundVenueId,
      tenantId,
      tenantIsolation: true,
    },
  });
}

async function runPlayerAcceptance({ sessionUserId }) {
  const resolved = await rpcPlatformResolveAthleteProfile(sessionUserId);
  if (!resolved.ok) {
    return failStep(
      "A-PLAYER",
      resolved.code || OPERATOR_ACCEPTANCE_ERROR.PLAYER_RESOLVE_FAILED,
      resolved.error || "Player profile resolve failed"
    );
  }
  return okStep("A-PLAYER", {
    objectId: resolved.data?.athlete_id || resolved.data?.profile_id || sessionUserId,
    details: {
      source: "platform_resolve_athlete_profile RPC",
      authUsersCreated: "notObserved",
    },
  });
}

function resolveRatingProfileId(result) {
  return String(
    result?.profile?.id ||
      result?.profile_id ||
      result?.profileId ||
      result?.data?.profile?.id ||
      result?.data?.profile_id ||
      ""
  ).trim();
}

async function runRatingAcceptance() {
  const first = await rpcRatingV5StartAssessment("doubles");
  const second = await rpcRatingV5StartAssessment("doubles");
  const enrollment = await rpcRatingV5GetMyPilotEnrollment();
  const profile = await rpcRatingV5GetProfile("doubles");
  if (!first.ok || !second.ok || !profile.ok) {
    const failing = [first, second, profile].find((item) => !item.ok) || enrollment;
    return failStep(
      "A-RATE",
      failing?.code || OPERATOR_ACCEPTANCE_ERROR.RATING_FAILED,
      failing?.error || "Rating acceptance failed"
    );
  }
  const firstProfileId = resolveRatingProfileId(first);
  const secondProfileId = resolveRatingProfileId(second);
  const sameProfileId =
    Boolean(firstProfileId) &&
    Boolean(secondProfileId) &&
    firstProfileId === secondProfileId;
  if (!sameProfileId) {
    return failStep(
      "A-RATE",
      OPERATOR_ACCEPTANCE_ERROR.RATING_PROFILE_MISMATCH,
      "Two start-assessment calls did not resolve the same profile",
      {
        details: {
          source: "rating_v5_* RPC",
          sameProfileId: false,
          firstProfileId: firstProfileId || null,
          secondProfileId: secondProfileId || null,
          enrollmentCode:
            enrollment.code || (enrollment.ok === false ? enrollment.code : "OK"),
          clubBlobWriteForbidden: "notObserved",
        },
      }
    );
  }
  return okStep("A-RATE", {
    objectId: resolveRatingProfileId(profile) || firstProfileId || null,
    details: {
      source: "rating_v5_* RPC",
      sameProfileId: true,
      enrollmentCode:
        enrollment.code || (enrollment.ok === false ? enrollment.code : "OK"),
      clubBlobWriteForbidden: "notObserved",
    },
  });
}

async function runCompetitionAcceptance({ tenantId }) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return failStep(
      "A-COMP",
      OPERATOR_ACCEPTANCE_ERROR.CLIENT_UNAVAILABLE,
      "Supabase client unavailable"
    );
  }
  const { data: matchRow, error: matchError } = await client
    .from("competition_ssot_matches")
    .select("id, competition_id, match_key")
    .eq("tenant_id", tenantId)
    .eq("match_key", "hard-cutover-seed::match::m1")
    .maybeSingle();
  if (matchError || !matchRow?.id) {
    return failStep(
      "A-COMP",
      OPERATOR_ACCEPTANCE_ERROR.COMPETITION_FINALIZE_FAILED,
      matchError?.message || "Seed competition match missing"
    );
  }
  const idem = `hard-cutover-browser::${tenantId}::finalize::m1`;
  const payload = { winner_side: "A", sets: [] };
  const first = await finalizeMatchViaCompetitionSsot(
    {
      tenantId,
      matchId: matchRow.id,
      resultPayload: payload,
      idempotencyKey: idem,
      winnerSide: "A",
      source: "competition_ssot_finalize",
    },
    import.meta.env
  );
  const replay = await finalizeMatchViaCompetitionSsot(
    {
      tenantId,
      matchId: matchRow.id,
      resultPayload: payload,
      idempotencyKey: idem,
      winnerSide: "A",
      source: "competition_ssot_finalize",
    },
    import.meta.env
  );
  if (!first.ok || !replay.ok) {
    const failing = !first.ok ? first : replay;
    return failStep(
      "A-COMP",
      failing.code || OPERATOR_ACCEPTANCE_ERROR.COMPETITION_FINALIZE_FAILED,
      failing.error || "Competition finalize failed"
    );
  }
  const { data: finalizedRows, error: finalizedError } = await client
    .from("competition_ssot_finalized_results")
    .select("match_id, idempotency_key, source")
    .eq("match_id", matchRow.id);
  if (finalizedError || !Array.isArray(finalizedRows) || finalizedRows.length !== 1) {
    return failStep(
      "A-COMP",
      OPERATOR_ACCEPTANCE_ERROR.COMPETITION_FINALIZE_FAILED,
      finalizedError?.message || "Finalized projection missing or duplicated"
    );
  }
  return okStep("A-COMP", {
    objectId: matchRow.id,
    details: {
      source: "competition_ssot_finalize_match_result",
      replay: Boolean(replay.replay),
      finalizedRows: finalizedRows.length,
      finalizedSource: finalizedRows[0]?.source || null,
    },
  });
}

async function runSecurityBoundaryAcceptance({ isSuperAdmin }) {
  const evaluated = evaluateOwnerSecurityBoundary({ isSuperAdmin });
  if (!evaluated.ok) {
    return failStep(
      "A-SEC",
      evaluated.code || OPERATOR_ACCEPTANCE_ERROR.SECURITY_BOUNDARY_FAILED,
      evaluated.message || "Security boundary failed"
    );
  }
  return okStep("A-SEC", {
    details: evaluated.details,
  });
}

async function runPairingAcceptance({ tenantId }) {
  const result = await loadActivePrivatePairingRulesForRuntime(
    { scopeType: "tenant", tenantId },
    import.meta.env
  );
  if (!result.ok) {
    return failStep(
      "A-PAIR",
      result.code || OPERATOR_ACCEPTANCE_ERROR.PAIRING_FAILED,
      result.message || result.error || "Restricted capability runtime failed"
    );
  }
  return okStep("A-PAIR", {
    details: {
      source: "restricted_capability_runtime",
      ruleCount: Array.isArray(result.rules) ? result.rules.length : 0,
      skipped: Boolean(result.skipped),
    },
  });
}

async function runCoachingAcceptance() {
  const gateway = getCoachingPageGateway();
  const pass =
    gateway.mode === "durable" || gateway.mode === "unavailable";
  if (!pass) {
    return failStep(
      "A-COACH",
      OPERATOR_ACCEPTANCE_ERROR.COACHING_FAILED,
      `Unexpected coaching mode: ${gateway.mode}`
    );
  }
  return okStep("A-COACH", {
    details: {
      mode: gateway.mode,
      stagingDurableActivate: gateway.stagingDurableActivate,
      noLegacyAuthority: gateway.mode !== "legacy",
    },
  });
}

async function runMessagingAcceptance({ runtimeStatus }) {
  const evaluated = evaluateMessagingAcceptanceMode(runtimeStatus);
  if (!evaluated.ok) {
    return failStep(
      "A-MSG",
      evaluated.code || OPERATOR_ACCEPTANCE_ERROR.MESSAGING_FAILED,
      `Unexpected messaging mode: ${evaluated.rawMode || evaluated.normalizedMode || "unknown"}`
    );
  }
  return okStep("A-MSG", {
    details: {
      mode: evaluated.rawMode,
      normalizedMode: evaluated.normalizedMode,
      reason: evaluated.reason,
      demoAllowed: evaluated.demoAllowed,
      noSilentFallback: evaluated.normalizedMode !== "DEMO",
      acceptedModes: ["PRODUCTION", "UNAVAILABLE"],
    },
  });
}

async function runDashboardAcceptance({ clubId }) {
  const result = getDashboardAnalytics({
    clubId: clubId || "hard-cutover-seed-club-primary",
    from: "2030-01-01",
    to: "2030-01-31",
    mode: "live",
    env: import.meta.env,
  });
  const sourceState = result?.sourceState?.state || null;
  const unavailable = result?.unavailable === true;
  const pass = unavailable || sourceState === "UNAVAILABLE" || result?.isMock === false;
  if (!pass) {
    return failStep(
      "A-DASH",
      OPERATOR_ACCEPTANCE_ERROR.DASHBOARD_FAILED,
      "Dashboard returned unexpected fallback state"
    );
  }
  return okStep("A-DASH", {
    details: {
      unavailable,
      sourceState,
      isMock: Boolean(result?.isMock),
      noLocalStorageAuthority: result?.isMock !== true,
    },
  });
}

async function runCatalogAcceptance() {
  const probes = [
    { rpc: PUBLIC_CATALOG_RPC.LIST_CLUBS, result: await listPublicClubsRemote() },
    { rpc: PUBLIC_CATALOG_RPC.LIST_COURTS, result: await listPublicCourtsRemote() },
    {
      rpc: PUBLIC_CATALOG_RPC.LIST_TOURNAMENTS,
      result: await listPublicTournamentsRemote(),
    },
    { rpc: PUBLIC_CATALOG_RPC.LIST_RANKINGS, result: await listPublicRankingsRemote() },
  ];
  for (const probe of probes) {
    if (!probe.result?.ok) {
      return failStep(
        "A-CAT",
        probe.result?.code || OPERATOR_ACCEPTANCE_ERROR.CATALOG_FAILED,
        probe.result?.message || `Public catalog RPC failed: ${probe.rpc}`,
        { details: { rpc: probe.rpc } }
      );
    }
    const items = probe.result.value?.items;
    if (items !== undefined && !Array.isArray(items)) {
      return failStep(
        "A-CAT",
        OPERATOR_ACCEPTANCE_ERROR.CATALOG_FAILED,
        `Malformed public catalog response: ${probe.rpc}`,
        { details: { rpc: probe.rpc, malformed: true } }
      );
    }
  }
  return okStep("A-CAT", {
    details: {
      rpcs: probes.map((probe) => probe.rpc),
      clubs: probes[0].result.value?.items?.length ?? 0,
      courts: probes[1].result.value?.items?.length ?? 0,
      tournaments: probes[2].result.value?.items?.length ?? 0,
      rankings: probes[3].result.value?.items?.length ?? 0,
      emptyResultAllowed: true,
      source: "public_catalog_list_* RPC",
    },
  });
}

export async function runOperatorAcceptanceSequence({
  authUser,
  currentTenantId,
  isSuperAdmin,
  communicationRuntimeStatus = null,
  env = import.meta.env,
} = {}) {
  const session = await getAuthenticatedSupabaseUser();
  if (!session.ok) {
    return {
      access: {
        ok: false,
        code: session.code,
        target: resolveOperatorAcceptanceTarget(),
      },
      stoppedAt: "A-OWN",
      steps: [
        failStep("A-OWN", session.code, session.error || "Authenticated session unavailable"),
      ],
    };
  }

  const access = resolveOperatorAcceptanceAccess({
    env,
    authUser,
    sessionUserId: session.sessionUserId,
    currentTenantId,
    isSuperAdmin,
  });
  if (!access.ok) {
    return {
      access,
      stoppedAt: "A-OWN",
      steps: [failStep("A-OWN", access.code, access.code)],
    };
  }

  const steps = [okStep("A-OWN", { objectId: access.maskedActorId, details: {
    tenantId: access.tenantId,
    role: access.role,
    isSuperAdmin: access.isSuperAdmin,
    projectRef: access.target.projectRef,
  } })];

  const club = await runClubAcceptance({ tenantId: access.tenantId });
  steps.push(club);
  if (club.status === "FAIL") return { access, stoppedAt: club.id, steps };

  const court = await runCourtAcceptance({ tenantId: access.tenantId });
  steps.push(court);
  if (court.status === "FAIL") return { access, stoppedAt: court.id, steps };

  const player = await runPlayerAcceptance({ sessionUserId: access.actorId });
  steps.push(player);
  if (player.status === "FAIL") return { access, stoppedAt: player.id, steps };

  const rating = await runRatingAcceptance();
  steps.push(rating);
  if (rating.status === "FAIL") return { access, stoppedAt: rating.id, steps };

  const comp = await runCompetitionAcceptance({ tenantId: access.tenantId });
  steps.push(comp);
  if (comp.status === "FAIL") return { access, stoppedAt: comp.id, steps };

  // Owner path: generic A-SEC only (no restricted capability positive read).
  // Super-admin path: keep prior positive restricted-capability check (A-PAIR).
  if (access.isSuperAdmin) {
    const pair = await runPairingAcceptance({ tenantId: access.tenantId });
    steps.push(pair);
    if (pair.status === "FAIL") return { access, stoppedAt: pair.id, steps };
  } else {
    const security = await runSecurityBoundaryAcceptance({
      isSuperAdmin: access.isSuperAdmin,
    });
    steps.push(security);
    if (security.status === "FAIL") return { access, stoppedAt: security.id, steps };
  }

  const coach = await runCoachingAcceptance();
  steps.push(coach);
  if (coach.status === "FAIL") return { access, stoppedAt: coach.id, steps };

  const msg = await runMessagingAcceptance({ runtimeStatus: communicationRuntimeStatus });
  steps.push(msg);
  if (msg.status === "FAIL") return { access, stoppedAt: msg.id, steps };

  const dash = await runDashboardAcceptance({ clubId: club.objectId });
  steps.push(dash);
  if (dash.status === "FAIL") return { access, stoppedAt: dash.id, steps };

  const cat = await runCatalogAcceptance();
  steps.push(cat);
  if (cat.status === "FAIL") return { access, stoppedAt: cat.id, steps };

  const globalProbes = runOperatorAcceptanceGlobalProbes(env);
  for (const probe of globalProbes) {
    steps.push(probe);
    if (probe.status === "FAIL") {
      return { access, stoppedAt: probe.id, steps };
    }
  }

  return { access, steps, stoppedAt: null };
}
