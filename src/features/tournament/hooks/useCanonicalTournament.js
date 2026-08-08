import { useCallback, useEffect, useState } from "react";
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

/**
 * Load one tournament from canonical cloud authority.
 */
export function useCanonicalTournament(clubId, tournamentId, revision = 0) {
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(Boolean(clubId && tournamentId));
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!clubId || !tournamentId) {
      setTournament(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    setError(null);
    const result = await getTournamentQuery(clubId, tournamentId);
    if (!result.ok) {
      setTournament(null);
      setError(result.error || "Không tải được giải.");
      setLoading(false);
      return null;
    }
    setTournament(result.tournament);
    setLoading(false);
    return result.tournament;
  }, [clubId, tournamentId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!clubId || !tournamentId) {
        if (!cancelled) {
          setTournament(null);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      const result = await getTournamentQuery(clubId, tournamentId);
      if (cancelled) return;
      if (!result.ok) {
        setTournament(null);
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
  }, [clubId, tournamentId, revision]);

  const update = useCallback(
    async (patch, options = {}) => {
      const result = await updateTournamentCommand(clubId, tournamentId, patch, options);
      if (result.ok) {
        setTournament(result.tournament);
      }
      return result;
    },
    [clubId, tournamentId]
  );

  const applyEngine = useCallback(
    async (engineState, options = {}) => {
      const result = await applyEngineV4StateCommand(
        clubId,
        tournamentId,
        engineState,
        options
      );
      if (result.ok) {
        setTournament(result.tournament);
      }
      return result;
    },
    [clubId, tournamentId]
  );

  const setStatus = useCallback(
    async (status, options = {}) => {
      const result = await setTournamentStatusCommand(
        clubId,
        tournamentId,
        status,
        options
      );
      if (result.ok) {
        setTournament(result.tournament);
      }
      return result;
    },
    [clubId, tournamentId]
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

export function useCanonicalTournamentList(clubId, revision = 0) {
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
      const [listResult, statsResult] = await Promise.all([
        listTournamentsQuery(clubId),
        buildTournamentHubStats(clubId),
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
  }, [clubId, revision]);

  const remove = useCallback(
    async (tournamentId) => deleteTournamentCommand(clubId, tournamentId),
    [clubId]
  );

  return { tournaments, loading, error, stats, remove };
}

export function useCanonicalMyTournaments(clubId, playerId, revision = 0) {
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
      const result = await listMyTournamentsQuery(clubId, { playerId });
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
  }, [clubId, playerId, revision]);

  return { tournaments, loading, error };
}
