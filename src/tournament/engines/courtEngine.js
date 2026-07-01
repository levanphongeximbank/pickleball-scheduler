import { getCourtDisplayName } from "../../models/court.js";
import { COURT_STATUS, MATCH_STATUS } from "../../models/tournament/constants.js";
import { assignMatchCourt } from "./matchEngine.js";

const ACTIVE_MATCH_STATUSES = new Set([
  MATCH_STATUS.ASSIGNED,
  MATCH_STATUS.PLAYING,
]);

function normalizeCourtId(value) {
  return value === null || value === undefined ? "" : String(value);
}

export function buildCourtRuntimeState(court, index = 0, options = {}) {
  const id = normalizeCourtId(court?.id ?? index + 1);
  const lockedCourtIds = new Set(
    (options.lockedCourtIds || []).map((item) => normalizeCourtId(item))
  );
  const matches = options.matches || [];
  const activeMatch = matches.find(
    (match) =>
      normalizeCourtId(match.courtId) === id &&
      ACTIVE_MATCH_STATUSES.has(match.status)
  );

  const isLocked = lockedCourtIds.has(id) || court?.status === COURT_STATUS.LOCKED;

  let status = COURT_STATUS.AVAILABLE;
  if (isLocked) {
    status = COURT_STATUS.LOCKED;
  } else if (activeMatch) {
    status = COURT_STATUS.PLAYING;
  }

  return {
    id,
    name: getCourtDisplayName(court, index),
    status,
    currentMatchId: activeMatch?.id || court?.currentMatchId || null,
    locked: isLocked,
    active: court?.active !== false,
  };
}

export function buildCourtRuntimeStates(courts = [], matches = [], options = {}) {
  return (courts || [])
    .filter((court) => court?.active !== false)
    .map((court, index) =>
      buildCourtRuntimeState(court, index, {
        ...options,
        matches,
      })
    );
}

export function canAssignMatchToCourt(courtState, match, options = {}) {
  if (!courtState) {
    return { ok: false, error: "Khong tim thay san." };
  }

  if (courtState.locked || courtState.status === COURT_STATUS.LOCKED) {
    return { ok: false, error: "San dang bi khoa." };
  }

  if (courtState.currentMatchId) {
    return { ok: false, error: "San dang co tran khac." };
  }

  if (
    !options.allowPlaying &&
    match?.status &&
    match.status !== MATCH_STATUS.WAITING &&
    match.status !== MATCH_STATUS.ASSIGNED &&
    match.status !== MATCH_STATUS.POSTPONED &&
    match.status !== MATCH_STATUS.PLAYING
  ) {
    return { ok: false, error: "Tran khong o trang thai cho gan san." };
  }

  return { ok: true };
}

export function assignMatchToCourt(courtStates, match, courtId) {
  const states = [...(courtStates || [])];
  const courtState = states.find(
    (item) => normalizeCourtId(item.id) === normalizeCourtId(courtId)
  );
  const validation = canAssignMatchToCourt(courtState, match);

  if (!validation.ok) {
    return { ok: false, error: validation.error, courtStates: states, match };
  }

  const assignResult = assignMatchCourt(match, courtId);
  if (!assignResult.ok) {
    return { ok: false, error: assignResult.error, courtStates: states, match };
  }

  const nextMatch = assignResult.match;
  const nextStates = states.map((item) => {
    if (normalizeCourtId(item.id) !== normalizeCourtId(courtId)) {
      return item;
    }

    return {
      ...item,
      status: COURT_STATUS.PLAYING,
      currentMatchId: nextMatch.id,
    };
  });

  return {
    ok: true,
    courtStates: nextStates,
    match: nextMatch,
  };
}

export function transferMatchToCourt(courtStates, match, fromCourtId, toCourtId) {
  const states = [...(courtStates || [])];
  const fromId = normalizeCourtId(fromCourtId);
  const toId = normalizeCourtId(toCourtId);

  if (fromId === toId) {
    return { ok: false, error: "Sân đích trùng sân hiện tại.", courtStates: states, match };
  }

  const targetState = states.find((item) => normalizeCourtId(item.id) === toId);
  const validation = canAssignMatchToCourt(targetState, match, { allowPlaying: true });
  if (!validation.ok) {
    return { ok: false, error: validation.error, courtStates: states, match };
  }

  const released = releaseCourt(states, fromId, null);
  if (!released.ok) {
    return { ok: false, error: released.error, courtStates: states, match };
  }

  const assignResult = assignMatchToCourt(released.courtStates, match, toId);
  if (!assignResult.ok) {
    return assignResult;
  }

  const nextStates = assignResult.courtStates.map((item) => {
    if (normalizeCourtId(item.id) !== toId) {
      return item;
    }
    return {
      ...item,
      status: match.status === MATCH_STATUS.PLAYING ? COURT_STATUS.PLAYING : item.status,
      currentMatchId: match.id,
    };
  });

  const preservedMatch = {
    ...assignResult.match,
    courtId: toId,
    startedAt: match.startedAt,
    status: match.status,
    scoreA: match.scoreA,
    scoreB: match.scoreB,
  };

  return {
    ok: true,
    courtStates: nextStates,
    match: preservedMatch,
    fromCourtId: fromId,
    toCourtId: toId,
  };
}

export function releaseCourt(courtStates, courtId, completedMatch = null) {
  const nextStates = (courtStates || []).map((item) => {
    if (normalizeCourtId(item.id) !== normalizeCourtId(courtId)) {
      return item;
    }

    const locked = item.locked === true;
    return {
      ...item,
      status: locked ? COURT_STATUS.LOCKED : COURT_STATUS.AVAILABLE,
      currentMatchId: null,
    };
  });

  return {
    ok: true,
    courtStates: nextStates,
    match: completedMatch,
  };
}

export function setCourtLocked(courtStates, courtId, locked = true) {
  const nextStates = (courtStates || []).map((item) => {
    if (normalizeCourtId(item.id) !== normalizeCourtId(courtId)) {
      return item;
    }

    if (locked && item.currentMatchId) {
      return item;
    }

    return {
      ...item,
      locked,
      status: locked ? COURT_STATUS.LOCKED : COURT_STATUS.AVAILABLE,
      currentMatchId: locked ? null : item.currentMatchId,
    };
  });

  const target = nextStates.find(
    (item) => normalizeCourtId(item.id) === normalizeCourtId(courtId)
  );

  if (locked && target?.currentMatchId) {
    return {
      ok: false,
      error: "Khong the khoa san dang co tran.",
      courtStates: courtStates || [],
    };
  }

  return { ok: true, courtStates: nextStates };
}

export function getAvailableCourts(courtStates = []) {
  return courtStates.filter(
    (court) =>
      court.status === COURT_STATUS.AVAILABLE &&
      !court.locked &&
      !court.currentMatchId
  );
}

export function getBusyPlayerIds(matches = []) {
  const busy = new Set();

  matches.forEach((match) => {
    if (!ACTIVE_MATCH_STATUSES.has(match.status) && match.status !== MATCH_STATUS.PLAYING) {
      return;
    }

    [match.entryAId, match.entryBId].forEach((entryId) => {
      if (entryId) {
        busy.add(String(entryId));
      }
    });
  });

  return busy;
}
