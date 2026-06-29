import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchMatchLiveForTournament,
  subscribeTournamentMatchLive,
} from "../domain/matchLiveSync.js";

function indexRowsByMatchId(rows = []) {
  return rows.reduce((accumulator, row) => {
    if (row?.matchId) {
      accumulator[String(row.matchId)] = row;
    }
    return accumulator;
  }, {});
}

export function useMatchLiveScores(clubId, tournamentId, enabled = true) {
  const [liveByMatchId, setLiveByMatchId] = useState({});
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled || !clubId || !tournamentId) {
      setLiveByMatchId({});
      setReady(true);
      return;
    }

    const result = await fetchMatchLiveForTournament(clubId, tournamentId);
    if (!result.ok) {
      setError(result.error || "Khong tai duoc diem live.");
      setReady(true);
      return;
    }

    setError(null);
    setLiveByMatchId(indexRowsByMatchId(result.rows));
    setReady(true);
  }, [clubId, tournamentId, enabled]);

  useEffect(() => {
    setReady(false);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !clubId || !tournamentId) {
      return undefined;
    }

    const unsubscribe = subscribeTournamentMatchLive(clubId, tournamentId, (row) => {
      setLiveByMatchId((previous) => ({
        ...previous,
        [String(row.matchId)]: row,
      }));
    });

    return unsubscribe;
  }, [clubId, tournamentId, enabled]);

  return {
    liveByMatchId,
    error,
    ready,
    refresh,
  };
}

export function useRefereeFinalizeQueue({
  liveByMatchId,
  onFinalize,
  enabled = true,
}) {
  const processedIdsRef = useRef(new Set());
  const onFinalizeRef = useRef(onFinalize);

  useEffect(() => {
    onFinalizeRef.current = onFinalize;
  }, [onFinalize]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    Object.values(liveByMatchId || {}).forEach((row) => {
      if (row.status !== "finalize_requested" || processedIdsRef.current.has(row.id)) {
        return;
      }

      processedIdsRef.current.add(row.id);
      Promise.resolve(onFinalizeRef.current(row)).catch(() => {
        processedIdsRef.current.delete(row.id);
      });
    });
  }, [liveByMatchId, enabled]);
}
