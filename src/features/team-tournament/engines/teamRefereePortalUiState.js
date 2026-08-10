/**
 * Pure UI-state helpers for Team Referee Portal accordion + dirty score sync.
 * Keeps expansion/query and local score edits stable across polling/realtime refresh.
 */

export function collectAvailableMatchupIds(scoredMatchups = [], waitingMatchups = []) {
  const ids = [];
  const seen = new Set();
  for (const item of [...scoredMatchups, ...waitingMatchups]) {
    const id = item?.id ? String(item.id) : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function availableMatchupIdsKey(availableIds = []) {
  return [...availableIds].filter(Boolean).map(String).sort().join("|");
}

/**
 * Initial open from ?matchup= only (once data is available).
 */
export function resolveInitialExpandedMatchupId({ queryMatchupId, availableIds = [] }) {
  const queryId = queryMatchupId ? String(queryMatchupId).trim() : "";
  if (!queryId) return "";
  return availableIds.includes(queryId) ? queryId : "";
}

/**
 * After refresh: keep current expansion if still available; clear if gone.
 * Never re-force query matchup here.
 */
export function reconcileExpandedMatchupId({ expandedMatchupId, availableIds = [] }) {
  const current = expandedMatchupId ? String(expandedMatchupId) : "";
  if (!current) return "";
  return availableIds.includes(current) ? current : "";
}

export function buildMatchupQuerySearchParams(currentSearchParams, matchupId) {
  const next = new URLSearchParams(currentSearchParams?.toString?.() || currentSearchParams || "");
  const id = matchupId ? String(matchupId).trim() : "";
  if (id) {
    next.set("matchup", id);
  } else {
    next.delete("matchup");
  }
  return next;
}

function cloneGames(games) {
  if (!Array.isArray(games) || games.length === 0) {
    return [{ teamA: 0, teamB: 0 }];
  }
  return games.map((game) => ({
    teamA: Number(game?.teamA) || 0,
    teamB: Number(game?.teamB) || 0,
  }));
}

export function normalizeScoreStateFromSubMatch(subMatch) {
  return {
    scoreA: Number(subMatch?.score?.teamA) || 0,
    scoreB: Number(subMatch?.score?.teamB) || 0,
    games: cloneGames(subMatch?.score?.games),
  };
}

export function buildSubMatchScoreFingerprint(subMatch) {
  const score = normalizeScoreStateFromSubMatch(subMatch);
  return JSON.stringify({
    id: String(subMatch?.subMatchId || subMatch?.id || ""),
    version: subMatch?.version ?? null,
    status: subMatch?.status ?? null,
    resultConfirmedAt: subMatch?.resultConfirmedAt ?? null,
    scoreA: score.scoreA,
    scoreB: score.scoreB,
    games: score.games,
  });
}

/**
 * @returns {{
 *   action: 'rehydrate' | 'keep' | 'conflict',
 *   nextState?: { scoreA:number, scoreB:number, games:array },
 *   nextFingerprint: string,
 *   dirty: boolean,
 *   conflict: boolean,
 * }}
 */
export function resolveScorePanelServerSync({
  dirty,
  previousFingerprint,
  subMatch,
}) {
  const nextFingerprint = buildSubMatchScoreFingerprint(subMatch);
  const serverState = normalizeScoreStateFromSubMatch(subMatch);

  if (!dirty) {
    return {
      action: "rehydrate",
      nextState: serverState,
      nextFingerprint,
      dirty: false,
      conflict: false,
    };
  }

  if (previousFingerprint === nextFingerprint) {
    return {
      action: "keep",
      nextFingerprint,
      dirty: true,
      conflict: false,
    };
  }

  return {
    action: "conflict",
    nextFingerprint,
    dirty: true,
    conflict: true,
  };
}

export function rebaseScorePanelAfterSuccessfulWrite(subMatch) {
  const nextState = normalizeScoreStateFromSubMatch(subMatch);
  return {
    ...nextState,
    fingerprint: buildSubMatchScoreFingerprint(subMatch),
    dirty: false,
    conflict: false,
  };
}

/**
 * Ensure score mutations always use the panel's rendered matchup/subMatch ids.
 */
export function bindScoreActionIds({
  panelMatchupId,
  panelSubMatchId,
  requestedMatchupId,
  requestedSubMatchId,
}) {
  const matchupId = String(panelMatchupId || "").trim();
  const subMatchId = String(panelSubMatchId || "").trim();
  const reqMatchup = String(requestedMatchupId || matchupId).trim();
  const reqSub = String(requestedSubMatchId || subMatchId).trim();
  const ok = Boolean(matchupId && subMatchId && matchupId === reqMatchup && subMatchId === reqSub);
  return {
    ok,
    matchupId,
    subMatchId,
    error: ok ? null : "SCORE_ACTION_MATCHUP_BINDING_MISMATCH",
  };
}
