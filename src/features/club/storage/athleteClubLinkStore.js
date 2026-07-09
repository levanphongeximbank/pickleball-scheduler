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

export function clearAthleteClubLink(userId) {
  const id = String(userId || "").trim();
  if (!id) {
    return { ok: false, error: "Thiếu userId." };
  }

  const store = readStore();
  if (!store[id]) {
    return { ok: true, cleared: false };
  }

  delete store[id];
  writeStore(store);
  return { ok: true, cleared: true };
}

/**
 * Profile cloud không có club_id → xóa link local cũ (tránh máy khác / máy cũ “nhớ” CLB đã mất).
 */
export function reconcileAthleteClubLinkWithProfile(user) {
  if (!user?.id) {
    return user;
  }

  const profileClubId = user.clubId || user.club_id || null;
  if (profileClubId) {
    return mergeAthleteClubLink(user);
  }

  clearAthleteClubLink(user.id);
  return {
    ...user,
    clubId: null,
    club_id: null,
  };
}

export function mergeAthleteClubLink(user) {
  if (!user?.id) {
    return user;
  }

  const link = loadAthleteClubLink(user.id);
  if (!link) {
    return user;
  }

  const linkedClubId = link.clubId ? String(link.clubId).trim() : null;
  if (linkedClubId) {
    try {
      // Dynamic import avoided — club registry may not be loaded in all contexts.
      // Stale link without matching local club: ignore clubId (keep playerId).
      const raw = localStorage.getItem("pickleball-clubs-v1");
      if (raw) {
        const clubs = JSON.parse(raw);
        const found = Array.isArray(clubs)
          ? clubs.find((club) => club?.id === linkedClubId && !club?.isDefault)
          : null;
        if (!found) {
          clearAthleteClubLink(user.id);
          return {
            ...user,
            clubId: user.clubId || null,
            playerId: link.playerId ?? user.playerId ?? null,
          };
        }
      }
    } catch {
      // keep link if parse fails
    }
  }

  return {
    ...user,
    clubId: link.clubId ?? user.clubId ?? null,
    playerId: link.playerId ?? user.playerId ?? null,
  };
}
