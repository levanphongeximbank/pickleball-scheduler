const PREFIX = "pickleball-tournament-score-draft-v1";

function buildKey({ clubId, tournamentId, eventId }) {
  return `${PREFIX}::${clubId || ""}::${tournamentId || ""}::${eventId || ""}`;
}

export function isScoreDraftScopeValid(scope) {
  return Boolean(scope?.tournamentId && scope?.eventId);
}

export function loadScoreDrafts(scope) {
  if (!isScoreDraftScopeValid(scope)) {
    return {};
  }

  try {
    const raw = sessionStorage.getItem(buildKey(scope));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveScoreDrafts(scope, drafts) {
  if (!isScoreDraftScopeValid(scope)) {
    return;
  }

  const key = buildKey(scope);
  if (!drafts || !Object.keys(drafts).length) {
    sessionStorage.removeItem(key);
    return;
  }

  sessionStorage.setItem(key, JSON.stringify(drafts));
}
