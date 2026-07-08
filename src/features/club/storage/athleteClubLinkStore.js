const ATHLETE_CLUB_LINK_KEY = "pickleball-athlete-club-link-v1";

function readStore() {
  try {
    const raw = localStorage.getItem(ATHLETE_CLUB_LINK_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  localStorage.setItem(ATHLETE_CLUB_LINK_KEY, JSON.stringify(store));
}

export function saveAthleteClubLink(userId, { clubId, playerId }) {
  const id = String(userId || "").trim();
  if (!id) {
    return { ok: false, error: "Thiếu userId." };
  }

  const store = readStore();
  store[id] = {
    clubId: clubId ? String(clubId) : null,
    playerId: playerId ? String(playerId) : null,
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
  return { ok: true };
}

export function loadAthleteClubLink(userId) {
  const id = String(userId || "").trim();
  if (!id) {
    return null;
  }
  return readStore()[id] || null;
}

export function findUserIdByPlayerId(playerId) {
  const target = String(playerId || "").trim();
  if (!target) {
    return null;
  }

  const store = readStore();
  for (const [userId, link] of Object.entries(store)) {
    if (link?.playerId && String(link.playerId) === target) {
      return userId;
    }
  }

  return null;
}

export function mergeAthleteClubLink(user) {
  if (!user?.id) {
    return user;
  }

  const link = loadAthleteClubLink(user.id);
  if (!link) {
    return user;
  }

  return {
    ...user,
    clubId: link.clubId ?? user.clubId ?? null,
    playerId: link.playerId ?? user.playerId ?? null,
  };
}
