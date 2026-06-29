import { useCallback, useEffect, useMemo, useState } from "react";

import {
  isScoreDraftScopeValid,
  loadScoreDrafts,
  saveScoreDrafts,
} from "./scoreDraftStorage.js";

export function useScoreDrafts(draftScope) {
  const scopeKey = useMemo(() => {
    if (!isScoreDraftScopeValid(draftScope)) {
      return "";
    }

    return `${draftScope.clubId || ""}::${draftScope.tournamentId}::${draftScope.eventId}`;
  }, [draftScope?.clubId, draftScope?.tournamentId, draftScope?.eventId]);

  const [draftScores, setDraftScores] = useState(() => loadScoreDrafts(draftScope));

  useEffect(() => {
    if (!scopeKey) {
      setDraftScores({});
      return;
    }

    setDraftScores(loadScoreDrafts(draftScope));
  }, [scopeKey, draftScope]);

  useEffect(() => {
    if (!scopeKey) {
      return;
    }

    saveScoreDrafts(draftScope, draftScores);
  }, [draftScores, draftScope, scopeKey]);

  const resolveScores = useCallback(
    (matchId, match) => {
      const draft = draftScores[matchId];
      return {
        scoreA: draft?.scoreA ?? match?.scoreA ?? "",
        scoreB: draft?.scoreB ?? match?.scoreB ?? "",
      };
    },
    [draftScores]
  );

  const updateScores = useCallback((matchId, match, partial) => {
    setDraftScores((previous) => {
      const current = {
        scoreA: previous[matchId]?.scoreA ?? match?.scoreA ?? "",
        scoreB: previous[matchId]?.scoreB ?? match?.scoreB ?? "",
      };

      return {
        ...previous,
        [matchId]: { ...current, ...partial },
      };
    });
  }, []);

  const clearDraft = useCallback((matchId) => {
    setDraftScores((previous) => {
      if (!previous[matchId]) {
        return previous;
      }

      const next = { ...previous };
      delete next[matchId];
      return next;
    });
  }, []);

  if (!scopeKey) {
    return null;
  }

  return {
    resolveScores,
    updateScores,
    clearDraft,
  };
}
