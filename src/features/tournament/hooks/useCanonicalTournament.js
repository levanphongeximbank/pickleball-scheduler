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
import { resolveCanonicalTournamentLoadPolicy } from "./canonicalTournamentLoadPolicy.js";

export { resolveCanonicalTournamentLoadPolicy };

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

function readAuthzFingerprint(clubOrScope) {
  if (clubOrScope && typeof clubOrScope === "object") {
    return String(clubOrScope.authzFingerprint || "").trim();
  }
  return "";
}

/**
 * Load one tournament from canonical cloud authority.
 * Pass activeClub (or { id, tenantId|venueId }) — never rely on localStorage tenant lookup.
 * @param {string|{id?:string,clubId?:string,tenantId?:string,venueId?:string}} clubOrScope
 */
export function useCanonicalTournament(clubOrScope, tournamentId, revision = 0) {
  const clubId = readClubId(clubOrScope);
  const tenantId = readTenantId(clubOrScope);
  const authzFingerprint = readAuthzFingerprint(clubOrScope);
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(Boolean(clubId && tournamentId));
  const [error, setError] = useState(null);
  const tournamentRef = useRef(null);
  const identityRef = useRef({ clubId, tournamentId, tenantId, authzFingerprint });

  useEffect(() => {
    tournamentRef.current = tournament;
  }, [tournament]);

  const reload = useCallback(async ({ soft = false } = {}) => {
    if (!clubId || !tournamentId) {
      const policy = resolveCanonicalTournamentLoadPolicy({
        clubId,
        tournamentId,
        tenantId,
        prevClubId: identityRef.current.clubId,
        prevTournamentId: identityRef.current.tournamentId,
        prevTenantId: identityRef.current.tenantId,
        hasUsableTournament: Boolean(tournamentRef.current),
        usableTournamentId: tournamentRef.current?.id,
        authzFingerprint,
        prevAuthzFingerprint: identityRef.current.authzFingerprint,
      });
      if (policy.mode === "keep-transient") {
        return tournamentRef.current;
      }
      setTournament(null);
      setLoading(false);
      return null;
    }
    const sameIdentity =
      identityRef.current.clubId === clubId &&
      String(identityRef.current.tournamentId) === String(tournamentId) &&
      (!identityRef.current.tenantId ||
        !tenantId ||
        identityRef.current.tenantId === tenantId) &&
      (!identityRef.current.authzFingerprint ||
        !authzFingerprint ||
        identityRef.current.authzFingerprint === authzFingerprint);
    const canSoft = soft && sameIdentity && Boolean(tournamentRef.current);
    if (!canSoft) {
      setLoading(true);
    }
    setError(null);
    const result = await getTournamentQuery(clubId, tournamentId, { tenantId });
    if (!result.ok) {
      // Fail closed: do not keep a stale tournament as if it were a successful read.
      if (!canSoft) {
        setTournament(null);
      }
      setError(result.error || "Không tải được giải.");
      setLoading(false);
      return null;
    }
    setTournament(result.tournament);
    setLoading(false);
    return result.tournament;
  }, [clubId, tournamentId, tenantId, authzFingerprint]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const prev = identityRef.current;
      const policy = resolveCanonicalTournamentLoadPolicy({
        clubId,
        tournamentId,
        tenantId,
        prevClubId: prev.clubId,
        prevTournamentId: prev.tournamentId,
        prevTenantId: prev.tenantId,
        hasUsableTournament: Boolean(tournamentRef.current),
        usableTournamentId: tournamentRef.current?.id,
        authzFingerprint,
        prevAuthzFingerprint: prev.authzFingerprint,
      });

      if (policy.mode === "keep-transient") {
        return;
      }

      if (policy.updateIdentity) {
        identityRef.current = { clubId, tournamentId, tenantId, authzFingerprint };
      }

      if (!clubId || !tournamentId) {
        if (!cancelled) {
          if (policy.clearTournament) {
            setTournament(null);
            tournamentRef.current = null;
          }
          setLoading(false);
        }
        return;
      }

      // Tournament/club/tenant switch must never flash the previous tournament as the new one.
      if (policy.clearTournament) {
        setTournament(null);
        tournamentRef.current = null;
        setLoading(true);
        setError(null);
      }

      const soft = policy.soft && Boolean(tournamentRef.current);
      if (!soft) {
        setLoading(true);
      }

      const result = await getTournamentQuery(clubId, tournamentId, { tenantId });
      if (cancelled) return;
      if (!result.ok) {
        if (!soft) {
          setTournament(null);
        }
        setError(result.error || "Không tải được giải.");
      } else {
        setTournament(result.tournament);
        setError(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId, tournamentId, revision, tenantId, authzFingerprint]);

  const update = useCallback(
    async (patch, options = {}) => {
      const result = await updateTournamentCommand(clubId, tournamentId, patch, {
        ...options,
        tenantId,
      });
      if (result.ok) {
        setTournament(result.tournament);
      }
      return result;
    },
    [clubId, tournamentId, tenantId]
  );

  const applyEngine = useCallback(
    async (engineState, options = {}) => {
      const result = await applyEngineV4StateCommand(clubId, tournamentId, engineState, {
        ...options,
        tenantId,
      });
      if (result.ok) {
        setTournament(result.tournament);
      }
      return result;
    },
    [clubId, tournamentId, tenantId]
  );

  const setStatus = useCallback(
    async (status, options = {}) => {
      const result = await setTournamentStatusCommand(clubId, tournamentId, status, {
        ...options,
        tenantId,
      });
      if (result.ok) {
        setTournament(result.tournament);
      }
      return result;
    },
    [clubId, tournamentId, tenantId]
  );

  return {
    tournament,
    loading,
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
