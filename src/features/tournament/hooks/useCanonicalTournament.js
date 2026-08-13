import { useCallback, useEffect, useRef, useState } from "react";
import {
  getTournamentQuery,
  listTournamentsQuery,
  listMyTournamentsQuery,
  buildTournamentHubStats,
} from "../services/tournamentQueries.js";
import {
  updateTournamentCommand,
  deleteTournamentCommand,
  applyEngineV4StateCommand,
  setTournamentStatusCommand,
} from "../services/tournamentCommands.js";
import { resolveExplicitTenantFromClub } from "../guards/tournamentTenant.js";
import {
  assertInternalTournamentReadyForMutation,
  resolveCanonicalExpectedVersion,
} from "../internal/canonicalTournamentCas.js";
import { resolveCanonicalLoadPresentation } from "../internal/internalWorkspaceSections.js";
import { TOURNAMENT_MODE } from "../../../models/tournament/constants.js";

function readClubId(clubOrScope) {
  if (clubOrScope && typeof clubOrScope === "object") {
    return String(clubOrScope.id || clubOrScope.clubId || "").trim();
  }
  return String(clubOrScope || "").trim();
}

function readTenantId(clubOrScope) {
  if (clubOrScope && typeof clubOrScope === "object") {
    return resolveExplicitTenantFromClub(clubOrScope);
  }
  return null;
}

/**
 * Load one tournament from canonical cloud authority.
 * Pass activeClub (or { id, tenantId|venueId }) — never rely on localStorage tenant lookup.
 * @param {string|{id?:string,clubId?:string,tenantId?:string,venueId?:string}} clubOrScope
 */
export function useCanonicalTournament(clubOrScope, tournamentId, revision = 0) {
  const clubId = readClubId(clubOrScope);
  const tenantId = readTenantId(clubOrScope);
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(Boolean(clubId && tournamentId));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    hasLoadedRef.current = false;
  }, [clubId, tournamentId]);

  const reload = useCallback(async () => {
    if (!clubId || !tournamentId) {
      setTournament(null);
      setLoading(false);
      setRefreshing(false);
      hasLoadedRef.current = false;
      return null;
    }
    const presentation = resolveCanonicalLoadPresentation({
      hasTournament: hasLoadedRef.current,
    });
    if (presentation.initialLoading) setLoading(true);
    else setRefreshing(true);
    setError(null);
    const result = await getTournamentQuery(clubId, tournamentId, { tenantId });
    if (!result.ok) {
      if (presentation.initialLoading) {
        setTournament(null);
      }
      setError(result.error || "Không tải được giải.");
      setLoading(false);
      setRefreshing(false);
      return null;
    }
    setTournament(result.tournament);
    hasLoadedRef.current = true;
    setLoading(false);
    setRefreshing(false);
    return result.tournament;
  }, [clubId, tournamentId, tenantId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!clubId || !tournamentId) {
        if (!cancelled) {
          setTournament(null);
          setLoading(false);
          setRefreshing(false);
          hasLoadedRef.current = false;
        }
        return;
      }
      const presentation = resolveCanonicalLoadPresentation({
        hasTournament: hasLoadedRef.current,
      });
      if (presentation.initialLoading) setLoading(true);
      else setRefreshing(true);
      const result = await getTournamentQuery(clubId, tournamentId, { tenantId });
      if (cancelled) return;
      if (!result.ok) {
        if (presentation.initialLoading) {
          setTournament(null);
        }
        setError(result.error || "Không tải được giải.");
      } else {
        setTournament(result.tournament);
        hasLoadedRef.current = true;
        setError(null);
      }
      setLoading(false);
      setRefreshing(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId, tournamentId, revision, tenantId]);

  const update = useCallback(
    async (patch, options = {}) => {
      const current = options.currentTournament || tournament;
      const expectedVersion =
        options.expectedVersion != null
          ? resolveCanonicalExpectedVersion(options.expectedVersion)
          : resolveCanonicalExpectedVersion(current);
      if (String(current?.mode || "") === TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
        const ready = assertInternalTournamentReadyForMutation(current, {
          mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
        });
        if (!ready.ok) {
          return ready;
        }
      }
      const result = await updateTournamentCommand(clubId, tournamentId, patch, {
        ...options,
        tenantId,
        currentTournament: current,
        expectedVersion:
          expectedVersion != null ? expectedVersion : current?.version,
      });
      if (result.ok) {
        setTournament(result.tournament);
      }
      return result;
    },
    [clubId, tournamentId, tenantId, tournament]
  );

  const applyEngine = useCallback(
    async (engineState, options = {}) => {
      const current = options.currentTournament || tournament;
      if (String(current?.mode || "") === TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
        const ready = assertInternalTournamentReadyForMutation(current, {
          mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
        });
        if (!ready.ok) return ready;
      }
      const result = await applyEngineV4StateCommand(clubId, tournamentId, engineState, {
        ...options,
        tenantId,
        currentTournament: current,
        expectedVersion:
          options.expectedVersion != null
            ? options.expectedVersion
            : resolveCanonicalExpectedVersion(current),
      });
      if (result.ok) {
        setTournament(result.tournament);
      }
      return result;
    },
    [clubId, tournamentId, tenantId, tournament]
  );

  const setStatus = useCallback(
    async (status, options = {}) => {
      const current = options.currentTournament || tournament;
      if (String(current?.mode || "") === TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
        const ready = assertInternalTournamentReadyForMutation(current, {
          mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
        });
        if (!ready.ok) return ready;
      }
      const result = await setTournamentStatusCommand(clubId, tournamentId, status, {
        ...options,
        tenantId,
        currentTournament: current,
        expectedVersion:
          options.expectedVersion != null
            ? options.expectedVersion
            : resolveCanonicalExpectedVersion(current),
      });
      if (result.ok) {
        setTournament(result.tournament);
      }
      return result;
    },
    [clubId, tournamentId, tenantId, tournament]
  );

  return {
    tournament,
    loading,
    refreshing,
    error,
    reload,
    update,
    applyEngine,
    setStatus,
    setTournament,
  };
}

export function useCanonicalTournamentList(clubOrScope, revision = 0) {
  const clubId = readClubId(clubOrScope);
  const tenantId = readTenantId(clubOrScope);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(Boolean(clubId));
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total: 0, open: 0, draft: 0, completed: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!clubId) {
        if (!cancelled) {
          setTournaments([]);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      const opts = { tenantId };
      const [listResult, statsResult] = await Promise.all([
        listTournamentsQuery(clubId, {}, opts),
        buildTournamentHubStats(clubId, opts),
      ]);
      if (cancelled) return;
      if (!listResult.ok) {
        setError(listResult.error || "Không tải được danh sách giải.");
        setTournaments([]);
      } else {
        setError(null);
        setTournaments(listResult.tournaments);
      }
      if (statsResult.ok) {
        setStats(statsResult);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId, revision, tenantId]);

  const remove = useCallback(
    async (tournamentId) => deleteTournamentCommand(clubId, tournamentId, { tenantId }),
    [clubId, tenantId]
  );

  return { tournaments, loading, error, stats, remove };
}

export function useCanonicalMyTournaments(clubOrScope, playerId, revision = 0) {
  const clubId = readClubId(clubOrScope);
  const tenantId = readTenantId(clubOrScope);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(Boolean(clubId && playerId));
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!clubId || !playerId) {
        if (!cancelled) {
          setTournaments([]);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      const result = await listMyTournamentsQuery(clubId, { playerId }, { tenantId });
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error || "Không tải được giải của tôi.");
        setTournaments([]);
      } else {
        setError(null);
        setTournaments(result.tournaments);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId, playerId, revision, tenantId]);

  return { tournaments, loading, error };
}
