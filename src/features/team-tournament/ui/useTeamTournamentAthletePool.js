/**
 * React hook — single Team Tournament athlete pool entry for UI screens.
 *
 * P0.2: separates initial load from background refresh; dedupes in-flight requests;
 * stale responses are ignored; unmounted components cannot commit state.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  listAvailableAthletes,
  resolveTeamTournamentAthleteClubId,
  resolveTeamTournamentAthleteTenantId,
  TEAM_TOURNAMENT_ATHLETE_SCOPE,
} from "../services/teamTournamentAthletePoolService.js";
import { logTeamRosterHydrationTransition } from "../engines/teamRosterHydrationDiagnostics.js";

/** @type {Map<string, Promise<object>>} */
const inFlightPoolRequests = new Map();

function normalizeId(value) {
  return String(value || "").trim();
}

function buildPoolRequestKey({
  tournamentId,
  clubId,
  tenantId,
  scopeMode,
  gender,
  assignedKey,
  callerName,
}) {
  return [
    normalizeId(tournamentId),
    normalizeId(clubId),
    normalizeId(tenantId),
    scopeMode,
    gender,
    assignedKey,
    callerName,
  ].join("::");
}

async function fetchAthletePoolDeduped(key, fetcher) {
  if (inFlightPoolRequests.has(key)) {
    return inFlightPoolRequests.get(key);
  }
  const promise = fetcher().finally(() => {
    inFlightPoolRequests.delete(key);
  });
  inFlightPoolRequests.set(key, promise);
  return promise;
}

export function __resetTeamTournamentAthletePoolRequestsForTests() {
  inFlightPoolRequests.clear();
}

export function __getTeamTournamentAthletePoolInFlightCountForTests() {
  return inFlightPoolRequests.size;
}

/**
 * @param {{
 *   tournament?: object|null,
 *   clubFromQuery?: string|null,
 *   selectedClubId?: string|null,
 *   activeClubId?: string|null,
 *   clubs?: object[],
 *   currentTenantId?: string|null,
 *   scopeMode?: 'club'|'tenant',
 *   gender?: string|null,
 *   assignedAthleteIds?: string[],
 *   callerName?: string,
 *   revision?: number|string,
 *   enabled?: boolean,
 * }} options
 */
export function useTeamTournamentAthletePool(options = {}) {
  const {
    tournament = null,
    clubFromQuery = null,
    selectedClubId = null,
    activeClubId = null,
    clubs = [],
    currentTenantId = null,
    scopeMode = TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB,
    gender = "all",
    assignedAthleteIds = [],
    callerName = "useTeamTournamentAthletePool",
    revision = 0,
    enabled = true,
  } = options;

  const tournamentId = normalizeId(tournament?.id);

  const clubId = useMemo(
    () =>
      resolveTeamTournamentAthleteClubId({
        tournamentClubId: tournament?.clubId,
        clubFromQuery,
        selectedClubId,
        activeClubId,
      }),
    [tournament?.clubId, clubFromQuery, selectedClubId, activeClubId]
  );

  const hostClub = useMemo(
    () => clubs.find((c) => normalizeId(c?.id) === clubId) || null,
    [clubs, clubId]
  );

  const tenantId = useMemo(
    () =>
      resolveTeamTournamentAthleteTenantId({
        tournament,
        club: hostClub,
        clubId,
        clubs,
        currentTenantId,
      }),
    [tournament, hostClub, clubId, clubs, currentTenantId]
  );

  const assignedKey = useMemo(
    () =>
      (assignedAthleteIds || [])
        .map((id) => normalizeId(id))
        .filter(Boolean)
        .sort()
        .join("|"),
    [assignedAthleteIds]
  );

  const requestKey = useMemo(
    () =>
      buildPoolRequestKey({
        tournamentId,
        clubId,
        tenantId,
        scopeMode,
        gender,
        assignedKey,
        callerName,
      }),
    [tournamentId, clubId, tenantId, scopeMode, gender, assignedKey, callerName]
  );

  const [athletes, setAthletes] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(Boolean(enabled));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [emptyMessage, setEmptyMessage] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [requestId, setRequestId] = useState(0);

  const sequenceRef = useRef(0);
  const mountedRef = useRef(true);
  const athletesRef = useRef([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    athletesRef.current = athletes;
  }, [athletes]);

  useEffect(() => {
    if (!enabled) {
      setAthletes([]);
      setLoadingInitial(false);
      setRefreshing(false);
      setError(null);
      setEmptyMessage(null);
      setDiagnostics(null);
      return undefined;
    }

    const seq = ++sequenceRef.current;
    const hasCachedAthletes = athletesRef.current.length > 0;

    if (!hasCachedAthletes) {
      setLoadingInitial(true);
      setRefreshing(false);
    } else {
      setLoadingInitial(false);
      setRefreshing(true);
    }
    setError(null);

    logTeamRosterHydrationTransition("useTeamTournamentAthletePool.fetch.start", {
      callerName,
      tournamentId,
      clubId,
      tenantId,
      revision,
      requestKey,
      requestId: seq,
      hasCachedAthletes,
      reloadTrigger: "effect",
    });

    fetchAthletePoolDeduped(requestKey, () =>
      listAvailableAthletes({
        tournamentId: tournamentId || null,
        clubId,
        tenantId,
        scopeMode,
        gender,
        assignedAthleteIds: assignedKey ? assignedKey.split("|") : [],
        callerName,
      })
    ).then((result) => {
      if (!mountedRef.current) {
        logTeamRosterHydrationTransition("useTeamTournamentAthletePool.stale.unmounted", {
          requestId: seq,
          latestSequence: sequenceRef.current,
        });
        return;
      }
      if (seq !== sequenceRef.current) {
        logTeamRosterHydrationTransition("useTeamRosterHydrationPool.stale.sequence", {
          requestId: seq,
          latestSequence: sequenceRef.current,
        });
        return;
      }

      setRequestId(seq);
      setDiagnostics(result.diagnostics || null);

      if (!result.ok) {
        if (!hasCachedAthletes) {
          setAthletes([]);
        }
        setError({
          code: result.code || "REPOSITORY_ERROR",
          message: result.message || "Không tải được VĐV.",
        });
        setEmptyMessage(null);
        setLoadingInitial(false);
        setRefreshing(false);
        logTeamRosterHydrationTransition("useTeamTournamentAthletePool.fetch.error", {
          requestId: seq,
          code: result.code,
          keptCachedAthletes: hasCachedAthletes,
        });
        return;
      }

      const nextAthletes = Array.isArray(result.athletes) ? result.athletes : [];
      setAthletes(nextAthletes);
      setError(null);
      setEmptyMessage(result.empty ? result.emptyMessage || result.message || null : null);
      setLoadingInitial(false);
      setRefreshing(false);

      logTeamRosterHydrationTransition("useTeamTournamentAthletePool.fetch.ready", {
        requestId: seq,
        athleteCount: nextAthletes.length,
        wasBackgroundRefresh: hasCachedAthletes,
      });
    });

    return undefined;
  }, [
    enabled,
    tournamentId,
    clubId,
    tenantId,
    scopeMode,
    gender,
    assignedKey,
    callerName,
    revision,
    requestKey,
  ]);

  return {
    athletes,
    players: athletes,
    loading: loadingInitial,
    loadingInitial,
    refreshing,
    error,
    emptyMessage,
    diagnostics,
    clubId,
    tenantId,
    scopeMode,
    requestId,
    source: "team-tournament-athlete-pool",
  };
}
