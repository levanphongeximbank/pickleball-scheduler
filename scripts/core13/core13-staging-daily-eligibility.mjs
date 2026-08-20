/**
 * CORE-13 fixture Daily athlete eligibility — harness only.
 *
 * Uses the same authority as daily_play_check_in / daily_play_create_matches:
 * public.daily_play_athlete_eligible_for_club(tenant, club, player).
 *
 * DUPLICATED_JS_ELIGIBILITY_RULE=DENY
 * PLAYER_ELIGIBILITY_BYPASS=DENY
 * HARDCODED_PLAYER_IDS=DENY
 * CLUB_DATA_V3_AS_PLAYER_SSOT=DENY
 */

export const DAILY_ATHLETE_ELIGIBILITY_AUTHORITY = "daily_play_athlete_eligible_for_club";
export const DAILY_ATHLETE_ELIGIBILITY_RPC = DAILY_ATHLETE_ELIGIBILITY_AUTHORITY;

function proof(ok, detail, extra = {}) {
  return Object.freeze({ ok: ok === true, detail: String(detail || ""), ...extra });
}

function text(value) {
  return String(value || "").trim();
}

function uniqueSortedIds(values = []) {
  return [...new Set((values || []).map((value) => text(value)).filter(Boolean))].sort();
}

/**
 * Read-only candidate discovery from canonical membership tables.
 * Does not invent eligibility — verification must call the RPC.
 */
export async function discoverClubMemberAthleteCandidates(serviceClient, { tenantId, clubId } = {}) {
  const tenant = text(tenantId);
  const club = text(clubId);
  if (!serviceClient || !tenant || !club) {
    return proof(false, "tenantId and clubId required for athlete discovery");
  }
  const { data, error } = await serviceClient
    .from("club_members")
    .select("athlete_id, user_id, club_id, tenant_id, status, athletes(id, tenant_id, status)")
    .eq("club_id", club)
    .eq("tenant_id", tenant)
    .eq("status", "active");
  if (error) {
    return proof(false, error.message || "club_members discovery failed");
  }
  const candidates = [];
  for (const row of Array.isArray(data) ? data : []) {
    const athlete = row?.athletes && typeof row.athletes === "object" ? row.athletes : null;
    const athleteId = text(athlete?.id || row?.athlete_id);
    if (!athleteId) continue;
    if (text(athlete?.tenant_id) && text(athlete.tenant_id) !== tenant) continue;
    if (text(athlete?.status || "active") !== "active") continue;
    candidates.push(
      Object.freeze({
        athleteId,
        clubId: club,
        tenantId: tenant,
        source: "club_members+athletes",
      })
    );
  }
  const byId = new Map();
  for (const row of candidates) {
    if (!byId.has(row.athleteId)) byId.set(row.athleteId, row);
  }
  const sorted = [...byId.values()].sort((a, b) => a.athleteId.localeCompare(b.athleteId));
  return proof(true, "club-member-athlete-candidates", {
    candidates: Object.freeze(sorted),
    tenantId: tenant,
    clubId: club,
  });
}

export async function verifyAthleteEligibleViaCanonicalRpc(
  serviceClient,
  { tenantId, clubId, athleteId } = {}
) {
  const tenant = text(tenantId);
  const club = text(clubId);
  const player = text(athleteId);
  if (!serviceClient || !tenant || !club || !player) {
    return proof(false, "tenantId/clubId/athleteId required for eligibility RPC");
  }
  const { data, error } = await serviceClient.rpc(DAILY_ATHLETE_ELIGIBILITY_RPC, {
    p_tenant_id: tenant,
    p_club_id: club,
    p_player_id: player,
  });
  if (error) {
    return proof(false, error.message || "daily_play_athlete_eligible_for_club failed", {
      athleteId: player,
      authority: DAILY_ATHLETE_ELIGIBILITY_AUTHORITY,
    });
  }
  const eligible = data === true || data === "t" || data === 1 || data === "true";
  if (!eligible) {
    return proof(false, "PLAYER_NOT_ELIGIBLE", {
      athleteId: player,
      authority: DAILY_ATHLETE_ELIGIBILITY_AUTHORITY,
      eligible: false,
    });
  }
  return proof(true, "canonical-eligible", {
    athleteId: player,
    authority: DAILY_ATHLETE_ELIGIBILITY_AUTHORITY,
    eligible: true,
  });
}

/**
 * Resolve fixture Daily athletes using the same RPC authority as createMatches.
 */
export async function resolveCanonicalDailyEligibleAthletes(
  serviceClient,
  { tenantId, clubId, minRequired = 4 } = {}
) {
  const tenant = text(tenantId);
  const club = text(clubId);
  const required = Number(minRequired) || 4;
  const discovered = await discoverClubMemberAthleteCandidates(serviceClient, {
    tenantId: tenant,
    clubId: club,
  });
  if (!discovered.ok) return discovered;

  const trace = [];
  const eligiblePlayerIds = [];
  for (const candidate of discovered.candidates || []) {
    const verified = await verifyAthleteEligibleViaCanonicalRpc(serviceClient, {
      tenantId: tenant,
      clubId: club,
      athleteId: candidate.athleteId,
    });
    trace.push(
      Object.freeze({
        athleteId: candidate.athleteId,
        eligible: verified.ok === true,
        authority: DAILY_ATHLETE_ELIGIBILITY_AUTHORITY,
        detail: verified.detail,
      })
    );
    if (verified.ok) eligiblePlayerIds.push(candidate.athleteId);
    if (eligiblePlayerIds.length >= required) break;
  }

  const ids = uniqueSortedIds(eligiblePlayerIds).slice(0, required);
  if (ids.length < required) {
    return proof(
      false,
      `DAILY_CHECKED_IN_PLAYERS_INSUFFICIENT canonical eligible=${ids.length} required=${required}`,
      {
        tenantId: tenant,
        clubId: club,
        eligiblePlayerIds: ids,
        eligiblePlayerCount: ids.length,
        required,
        selectedPlayerTrace: Object.freeze(trace),
        DAILY_ELIGIBILITY_AUTHORITY: DAILY_ATHLETE_ELIGIBILITY_AUTHORITY,
        canonicalEligibilityVerified: false,
        CLUB_DATA_V3_AS_PLAYER_SSOT: "DENY",
        PLAYER_ELIGIBILITY_BYPASS: "DENY",
      }
    );
  }

  return proof(true, "canonical-daily-eligible-athletes", {
    tenantId: tenant,
    clubId: club,
    clubTenantId: tenant,
    eligiblePlayerIds: ids,
    eligiblePlayerCount: ids.length,
    required,
    selectedPlayerTrace: Object.freeze(trace.filter((row) => row.eligible === true)),
    DAILY_ELIGIBILITY_AUTHORITY: DAILY_ATHLETE_ELIGIBILITY_AUTHORITY,
    canonicalEligibilityVerified: true,
    PRECHECK_ELIGIBILITY_RULE_EQUALS_CREATE_MATCHES: "YES",
    CLUB_DATA_V3_AS_PLAYER_SSOT: "DENY",
    PLAYER_ELIGIBILITY_BYPASS: "DENY",
    HARDCODED_PLAYER_IDS: "DENY",
  });
}
