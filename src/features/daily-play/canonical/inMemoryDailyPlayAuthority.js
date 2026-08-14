/**
 * In-memory Daily Play canonical authority — mirrors SQL RPC contracts for tests.
 * Not a browser blob SoT: injected as the server seam in unit tests.
 */

import {
  DAILY_PLAY_CODE,
  DAILY_PLAY_MESSAGES,
  DAILY_PLAY_RPC,
} from "./dailyPlayCodes.js";
import {
  applyAssignCourt,
  applyCancelMatch,
  applyChangeCourt,
  applyCheckIn,
  applyCheckOut,
  applyCreateMatches,
  applyCorrectScore,
  applyStartMatch,
  applySubmitScore,
  assertExpectedVersion,
  assertMatchParticipantsReady,
  buildCourtRuntimeView,
  emptyDailyPlayState,
  listAvailableCourts,
  normalizeCanonicalCourt,
  normalizeDailyPlayCanonicalState,
  resolveCreateMatchCount,
  selectEnabledCourts,
  validateDoublesMatchShape,
} from "./dailyPlayCanonicalDomain.js";

function deny(code, error, extra = {}) {
  return { ok: false, code, error: error || DAILY_PLAY_MESSAGES[code] || code, ...extra };
}

function ok(payload = {}) {
  return { ok: true, code: DAILY_PLAY_CODE.OK, ...payload };
}

export function createInMemoryDailyPlayAuthority(seed = {}) {
  /** @type {Map<string, object>} tournamentId -> row */
  const tournaments = new Map(Object.entries(seed.tournaments || {}));
  /** @type {Map<string, object[]>} clubId -> courts */
  const clubCourts = new Map(Object.entries(seed.clubCourts || {}));
  /** @type {Map<string, object[]>} tournamentId -> leases */
  const leasesByTournament = new Map(Object.entries(seed.leases || {}));
  /** @type {Map<string, object>} idempotencyKey -> result */
  const ledger = new Map(Object.entries(seed.ledger || {}));

  /** @type {Map<string, Set<string>>} `${tenantId}::${clubId}` -> eligible athlete ids */
  const eligibleAthletes = new Map();
  for (const [key, ids] of Object.entries(seed.eligibleAthletes || {})) {
    eligibleAthletes.set(String(key), new Set((ids || []).map(String)));
  }

  const actor = {
    tenantId: seed.tenantId || "tenant-daily-01",
    permissions: new Set(
      seed.permissions || [
        "tournament.view",
        "tournament.create",
        "tournament.update",
      ]
    ),
    isSuperAdmin: Boolean(seed.isSuperAdmin),
    authenticated: seed.authenticated !== false,
  };

  function assertAuth() {
    if (!actor.authenticated) {
      return deny(DAILY_PLAY_CODE.NOT_AUTHENTICATED, "Chưa đăng nhập.");
    }
    return null;
  }

  function assertTenant(tenantId) {
    if (!tenantId || tenantId === "default" || tenantId === "default-tenant") {
      return deny(DAILY_PLAY_CODE.TENANT_FORBIDDEN, "Thiếu tenant.");
    }
    if (!actor.isSuperAdmin && tenantId !== actor.tenantId) {
      return deny(DAILY_PLAY_CODE.TENANT_FORBIDDEN, "Sai tenant.");
    }
    return null;
  }

  function assertPerm(permission) {
    if (actor.isSuperAdmin) return null;
    if (!actor.permissions.has(permission)) {
      return deny(DAILY_PLAY_CODE.FORBIDDEN, `Thiếu quyền ${permission}.`);
    }
    return null;
  }

  function getTournament(tenantId, clubId, tournamentId) {
    const row = tournaments.get(String(tournamentId));
    if (!row || row.tenant_id !== tenantId || row.club_id !== clubId) {
      return null;
    }
    if (row.mode !== "daily_play") {
      return null;
    }
    return row;
  }

  function readDaily(row) {
    return normalizeDailyPlayCanonicalState(row.payload?.settings?.dailyPlay || {});
  }

  function writeDaily(row, daily) {
    row.payload = {
      ...(row.payload || {}),
      settings: {
        ...(row.payload?.settings || {}),
        dailyPlay: normalizeDailyPlayCanonicalState(daily),
      },
    };
    row.updated_at = new Date().toISOString();
    tournaments.set(String(row.id), row);
  }

  function courtsForClub(clubId, enabledCourtIds = []) {
    const raw = clubCourts.get(String(clubId)) || [];
    return selectEnabledCourts(raw, enabledCourtIds);
  }

  function leasesFor(tournamentId) {
    return leasesByTournament.get(String(tournamentId)) || [];
  }

  function setLeases(tournamentId, leases) {
    leasesByTournament.set(String(tournamentId), leases);
  }

  function clubWideActiveLeases(tenantId, clubId) {
    const all = [];
    for (const [tournamentId, leases] of leasesByTournament.entries()) {
      const owner = tournaments.get(String(tournamentId));
      if (!owner) continue;
      if (owner.tenant_id !== tenantId || owner.club_id !== clubId) continue;
      for (const lease of leases || []) {
        if (String(lease.status || "active") === "active") {
          all.push(lease);
        }
      }
    }
    return all;
  }

  function clubWideOccupiedCourtIds(tenantId, clubId) {
    return [
      ...new Set(
        clubWideActiveLeases(tenantId, clubId)
          .map((lease) => String(lease.courtId ?? lease.court_id ?? ""))
          .filter(Boolean)
      ),
    ].sort();
  }

  function isAthleteEligible(tenantId, clubId, playerId) {
    const key = `${tenantId}::${clubId}`;
    const set = eligibleAthletes.get(key);
    if (!set) {
      // Fail closed unless tests seed eligibility (mirrors server helper).
      return false;
    }
    return set.has(String(playerId));
  }

  function snapshot(row) {
    const daily = readDaily(row);
    const courts = courtsForClub(row.club_id, daily.enabledCourtIds);
    const leases = leasesFor(row.id);
    const occupiedCourtIds = clubWideOccupiedCourtIds(row.tenant_id, row.club_id);
    const occupancy = {
      courts,
      matches: daily.matches,
      leases,
      occupiedCourtIds,
    };
    const available = listAvailableCourts(occupancy);
    return ok({
      tournamentId: String(row.id),
      tenantId: row.tenant_id,
      clubId: row.club_id,
      revision: daily.revision,
      dailyPlay: daily,
      courts: courts.map((court, index) => normalizeCanonicalCourt(court, index)),
      courtStates: buildCourtRuntimeView(occupancy),
      availableCourts: available,
      leases,
      occupiedCourtIds,
      hasCourtCapability: courts.length > 0,
    });
  }

  function beginIdempotent(key, command) {
    if (!key || !String(key).trim()) {
      return {
        error: deny(
          DAILY_PLAY_CODE.MISSING_IDEMPOTENCY_KEY,
          "Thiếu idempotency key."
        ),
      };
    }
    const ledgerKey = `${command}::${key}`;
    if (ledger.has(ledgerKey)) {
      return { replay: true, result: ledger.get(ledgerKey) };
    }
    return { ledgerKey };
  }

  function finishIdempotent(ledgerKey, result) {
    if (ledgerKey && result?.ok) {
      ledger.set(ledgerKey, result);
    }
    return result;
  }

  async function rpc(name, args = {}) {
    const authDeny = assertAuth();
    if (authDeny) return authDeny;

    const tenantDeny = assertTenant(args.p_tenant_id);
    if (tenantDeny) return tenantDeny;

    if (name === DAILY_PLAY_RPC.GET_STATE) {
      const permDeny = assertPerm("tournament.view");
      if (permDeny) return permDeny;
      const row = getTournament(
        args.p_tenant_id,
        args.p_club_id,
        args.p_tournament_id
      );
      if (!row) return deny(DAILY_PLAY_CODE.NOT_FOUND, "Không tìm thấy buổi Daily Play.");
      return snapshot(row);
    }

    const writePerm = assertPerm("tournament.update");
    if (writePerm) return writePerm;

    const row = getTournament(
      args.p_tenant_id,
      args.p_club_id,
      args.p_tournament_id
    );
    if (!row) return deny(DAILY_PLAY_CODE.NOT_FOUND, "Không tìm thấy buổi Daily Play.");

    // Idempotent replay must win before CAS (retry with stale version still replays).
    const earlyIdempotent = beginIdempotent(args.p_idempotency_key, name);
    if (earlyIdempotent.error) return earlyIdempotent.error;
    if (earlyIdempotent.replay) return earlyIdempotent.result;

    const daily = readDaily(row);

    if (name === DAILY_PLAY_RPC.CORRECT_SCORE) {
      const leases = leasesFor(row.id);
      const corrected = applyCorrectScore(daily, {
        matchId: args.p_match_id,
        scoreA: args.p_score_a,
        scoreB: args.p_score_b,
        note: args.p_note,
        leases,
      });
      if (!corrected.ok) return corrected;
      if (corrected.replay) {
        return finishIdempotent(earlyIdempotent.ledgerKey, {
          ...snapshot(row),
          match: corrected.match,
          replay: true,
          ratingVprApplied: false,
          ratingExcludedReason: "daily-play-excluded",
        });
      }
      const versionCheck = assertExpectedVersion(daily, args.p_expected_version);
      if (!versionCheck.ok) {
        return { ...versionCheck, state: snapshot(row) };
      }
      writeDaily(row, corrected.state);
      return finishIdempotent(earlyIdempotent.ledgerKey, {
        ...snapshot(row),
        match: corrected.match,
        ratingVprApplied: false,
        ratingExcludedReason: "daily-play-excluded",
      });
    }

    const versionCheck = assertExpectedVersion(daily, args.p_expected_version);
    if (!versionCheck.ok) {
      const fresh = snapshot(row);
      return {
        ...versionCheck,
        state: fresh,
      };
    }

    if (name === DAILY_PLAY_RPC.CHECK_IN) {
      if (!isAthleteEligible(args.p_tenant_id, args.p_club_id, args.p_player_id)) {
        return deny(
          DAILY_PLAY_CODE.PLAYER_NOT_ELIGIBLE,
          DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.PLAYER_NOT_ELIGIBLE]
        );
      }
      writeDaily(row, applyCheckIn(daily, args.p_player_id));
      if (row.status === "draft") row.status = "active";
      return finishIdempotent(earlyIdempotent.ledgerKey, snapshot(row));
    }

    if (name === DAILY_PLAY_RPC.CHECK_OUT) {
      const result = applyCheckOut(daily, args.p_player_id);
      if (!result.ok) return result;
      writeDaily(row, result.state);
      return finishIdempotent(earlyIdempotent.ledgerKey, snapshot(row));
    }

    if (name === DAILY_PLAY_RPC.CREATE_MATCHES) {
      const courts = courtsForClub(row.club_id, daily.enabledCourtIds);
      const leases = leasesFor(row.id);
      const occupiedCourtIds = clubWideOccupiedCourtIds(row.tenant_id, row.club_id);
      const available = listAvailableCourts({
        courts,
        matches: daily.matches,
        leases,
        occupiedCourtIds,
      });
      const proposed = Array.isArray(args.p_matches) ? args.p_matches : [];
      for (const match of proposed) {
        const shape = validateDoublesMatchShape(match);
        if (!shape.ok) return shape;
        for (const playerId of shape.playerIds) {
          if (!isAthleteEligible(args.p_tenant_id, args.p_club_id, playerId)) {
            return deny(
              DAILY_PLAY_CODE.PLAYER_NOT_ELIGIBLE,
              DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.PLAYER_NOT_ELIGIBLE]
            );
          }
        }
      }
      const countPlan = resolveCreateMatchCount({
        enabledCourts: courts,
        availableCourts: available,
        eligiblePlayerCount: proposed.length
          ? proposed.length * 4
          : Number(args.p_eligible_player_count || 0),
      });
      if (!countPlan.ok) return countPlan;
      if (!proposed.length) {
        return deny(DAILY_PLAY_CODE.VALIDATION, "Thiếu danh sách trận đề xuất.");
      }
      if (proposed.length > countPlan.matchCount) {
        return deny(
          DAILY_PLAY_CODE.VALIDATION,
          "Số trận đề xuất vượt quá năng lực sân/VĐV."
        );
      }

      const created = applyCreateMatches(daily, proposed.slice(0, countPlan.matchCount));
      if (!created.ok) return created;
      // Create must remain waiting with no leases.
      writeDaily(row, created.state);
      if (row.status === "draft") row.status = "active";
      const snap = snapshot(row);
      return finishIdempotent(earlyIdempotent.ledgerKey, {
        ...snap,
        matches: created.matches,
        waitingForCourt: countPlan.waitingForCourt === true,
        message: countPlan.message || null,
      });
    }

    if (name === DAILY_PLAY_RPC.ASSIGN_COURT) {
      const courts = courtsForClub(row.club_id, daily.enabledCourtIds);
      const leases = leasesFor(row.id);
      const occupiedCourtIds = clubWideOccupiedCourtIds(row.tenant_id, row.club_id);
      const available = listAvailableCourts({
        courts,
        matches: daily.matches,
        leases,
        occupiedCourtIds,
      });
      if (!courts.length) {
        return deny(
          DAILY_PLAY_CODE.NO_COURT_CAPABILITY,
          DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.NO_COURT_CAPABILITY]
        );
      }
      const courtId = args.p_court_id
        ? String(args.p_court_id)
        : available[0]
          ? String(available[0].id)
          : null;
      if (!courtId) {
        return deny(
          DAILY_PLAY_CODE.NO_COURT_AVAILABLE,
          DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.NO_COURT_AVAILABLE]
        );
      }
      if (!courts.some((court) => String(court.id) === courtId)) {
        return deny(DAILY_PLAY_CODE.COURT_NOT_ELIGIBLE, "Sân không thuộc buổi chơi.");
      }

      const matchToAssign = daily.matches.find(
        (item) => String(item.id) === String(args.p_match_id)
      );
      if (matchToAssign) {
        const ready = assertMatchParticipantsReady(matchToAssign, {
          checkedInPlayerIds: daily.checkedInPlayerIds,
          isEligible: (playerId) =>
            isAthleteEligible(args.p_tenant_id, args.p_club_id, playerId),
        });
        if (!ready.ok) return ready;
      }

      const assigned = applyAssignCourt(daily, {
        matchId: args.p_match_id,
        courtId,
        leases: clubWideActiveLeases(row.tenant_id, row.club_id),
      });
      if (!assigned.ok) return assigned;
      writeDaily(row, assigned.state);
      setLeases(row.id, [
        ...leases.filter(
          (lease) =>
            !(
              String(lease.matchId) === String(args.p_match_id) &&
              String(lease.status) === "active"
            )
        ),
        assigned.lease,
      ]);
      return finishIdempotent(earlyIdempotent.ledgerKey, snapshot(row));
    }

    if (name === DAILY_PLAY_RPC.START_MATCH) {
      const leases = leasesFor(row.id);
      const matchToStart = daily.matches.find(
        (item) => String(item.id) === String(args.p_match_id)
      );
      if (matchToStart) {
        const ready = assertMatchParticipantsReady(matchToStart, {
          checkedInPlayerIds: daily.checkedInPlayerIds,
          isEligible: (playerId) =>
            isAthleteEligible(args.p_tenant_id, args.p_club_id, playerId),
        });
        if (!ready.ok) return ready;
      }
      const started = applyStartMatch(daily, {
        matchId: args.p_match_id,
        leases,
      });
      if (!started.ok) return started;
      writeDaily(row, started.state);
      return finishIdempotent(earlyIdempotent.ledgerKey, snapshot(row));
    }

    if (name === DAILY_PLAY_RPC.SUBMIT_SCORE) {
      const leases = leasesFor(row.id);
      const scored = applySubmitScore(daily, {
        matchId: args.p_match_id,
        scoreA: args.p_score_a,
        scoreB: args.p_score_b,
        leases,
      });
      if (!scored.ok) return scored;
      if (!scored.replay) {
        writeDaily(row, scored.state);
        setLeases(row.id, scored.leases);
      }
      return finishIdempotent(earlyIdempotent.ledgerKey, {
        ...snapshot(row),
        match: scored.match,
        replay: Boolean(scored.replay),
        ratingVprApplied: false,
        ratingExcludedReason: "daily-play-excluded",
      });
    }

    if (name === DAILY_PLAY_RPC.CANCEL_MATCH) {
      const leases = leasesFor(row.id);
      const cancelled = applyCancelMatch(daily, {
        matchId: args.p_match_id,
        leases,
      });
      if (!cancelled.ok) return cancelled;
      writeDaily(row, cancelled.state);
      setLeases(row.id, cancelled.leases);
      return finishIdempotent(earlyIdempotent.ledgerKey, snapshot(row));
    }

    if (name === DAILY_PLAY_RPC.CHANGE_COURT) {
      const courts = courtsForClub(row.club_id, daily.enabledCourtIds);
      if (!courts.some((court) => String(court.id) === String(args.p_court_id))) {
        return deny(DAILY_PLAY_CODE.COURT_NOT_ELIGIBLE, "Sân không thuộc buổi chơi.");
      }
      const leases = leasesFor(row.id);
      const target = String(args.p_court_id);
      const occupiedElsewhere = clubWideActiveLeases(row.tenant_id, row.club_id).some(
        (lease) =>
          String(lease.courtId ?? lease.court_id) === target &&
          String(lease.status || "active") === "active" &&
          String(lease.matchId) !== String(args.p_match_id)
      );
      if (occupiedElsewhere) {
        return deny(
          DAILY_PLAY_CODE.COURT_ALREADY_LEASED,
          DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.COURT_ALREADY_LEASED],
          { courtId: target }
        );
      }
      const changed = applyChangeCourt(daily, {
        matchId: args.p_match_id,
        newCourtId: args.p_court_id,
        leases,
      });
      if (!changed.ok) return changed;
      if (!changed.replay) {
        writeDaily(row, changed.state);
        setLeases(row.id, changed.leases);
      }
      return finishIdempotent(earlyIdempotent.ledgerKey, snapshot(row));
    }

    return deny(DAILY_PLAY_CODE.VALIDATION, `RPC không hỗ trợ: ${name}`);
  }

  return {
    rpc,
    __setClubCourts(clubId, courts) {
      clubCourts.set(String(clubId), courts || []);
    },
    __setEligibleAthletes(tenantId, clubId, playerIds = []) {
      eligibleAthletes.set(
        `${tenantId}::${clubId}`,
        new Set((playerIds || []).map(String))
      );
    },
    __seedTournament(row) {
      const id = String(row.id);
      tournaments.set(id, {
        id,
        tenant_id: row.tenant_id || actor.tenantId,
        club_id: row.club_id,
        mode: "daily_play",
        status: row.status || "active",
        payload: row.payload || {
          settings: { dailyPlay: emptyDailyPlayState() },
        },
        updated_at: new Date().toISOString(),
      });
    },
    __setLeases(tournamentId, leases = []) {
      setLeases(tournamentId, leases || []);
    },
    __getLedger() {
      return ledger;
    },
  };
}

export function createSeededDailyPlayTournament({
  id = "daily-t1",
  tenantId = "tenant-daily-01",
  clubId = "club-1",
  dailyPlay = null,
} = {}) {
  return {
    id,
    tenant_id: tenantId,
    club_id: clubId,
    mode: "daily_play",
    status: "active",
    payload: {
      settings: {
        dailyPlay: normalizeDailyPlayCanonicalState(
          dailyPlay || emptyDailyPlayState()
        ),
      },
    },
  };
}
