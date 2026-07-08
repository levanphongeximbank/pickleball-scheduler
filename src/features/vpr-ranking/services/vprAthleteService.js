import { getPlayerGenderKey } from "../../../models/player.js";
import { loadClubData } from "../../../domain/clubStorage.js";
import {
  listAthleteLinks,
  listAthletes,
  saveAthleteLinks,
  saveAthletes,
} from "../storage/vprLocalStore.js";

function createAthleteId() {
  return `vpr-athlete-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function findLink(clubId, playerId) {
  return listAthleteLinks().find(
    (link) => link.clubId === clubId && String(link.playerId) === String(playerId)
  );
}

function findAthleteByAuthUser(authUserId) {
  if (!authUserId) {
    return null;
  }
  return listAthletes().find((athlete) => athlete.authUserId === authUserId) || null;
}

function findPlayerInClub(clubId, playerId) {
  const data = loadClubData(clubId);
  return (data.players || []).find((player) => String(player.id) === String(playerId)) || null;
}

export function resolveOrCreateVprAthlete({
  clubId,
  playerId,
  tenantId = null,
  authUserId = null,
  displayName = null,
  region = "",
}) {
  const existingLink = findLink(clubId, playerId);
  const athletes = listAthletes();
  const links = listAthleteLinks();

  if (existingLink) {
    const athlete = athletes.find((row) => row.id === existingLink.vprAthleteId);
    if (athlete) {
      return { athlete, link: existingLink, created: false };
    }
  }

  const player = findPlayerInClub(clubId, playerId);
  const resolvedAuth = authUserId || null;
  const byAuth = findAthleteByAuthUser(resolvedAuth);

  let athlete = byAuth;
  let created = false;

  if (!athlete) {
    athlete = {
      id: createAthleteId(),
      displayName: displayName || player?.name || `VĐV ${playerId}`,
      gender: getPlayerGenderKey(player?.gender),
      region: region || player?.region || "",
      clubName: player?.clubName || "",
      authUserId: resolvedAuth,
      phone: player?.phone || "",
      mergeStatus: resolvedAuth ? "linked" : "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    athletes.push(athlete);
    saveAthletes(athletes);
    created = true;
  }

  if (!existingLink) {
    const link = {
      id: `vpr-link-${Date.now()}`,
      vprAthleteId: athlete.id,
      clubId,
      playerId: String(playerId),
      tenantId,
      createdAt: new Date().toISOString(),
    };
    links.push(link);
    saveAthleteLinks(links);
    return { athlete, link, created };
  }

  return { athlete, link: existingLink, created };
}

export function getVprAthleteForClubPlayer(clubId, playerId) {
  const link = findLink(clubId, playerId);
  if (!link) {
    return null;
  }
  return listAthletes().find((athlete) => athlete.id === link.vprAthleteId) || null;
}

export function mergeVprAthletes(targetAthleteId, sourceAthleteId) {
  const athletes = listAthletes();
  const links = listAthleteLinks();
  const target = athletes.find((row) => row.id === targetAthleteId);
  const source = athletes.find((row) => row.id === sourceAthleteId);
  if (!target || !source) {
    return { ok: false, error: "Không tìm thấy hồ sơ VPR." };
  }

  links.forEach((link) => {
    if (link.vprAthleteId === sourceAthleteId) {
      link.vprAthleteId = targetAthleteId;
    }
  });

  const filtered = athletes.filter((row) => row.id !== sourceAthleteId);
  saveAthletes(filtered);
  saveAthleteLinks(links);
  return { ok: true, athleteId: targetAthleteId };
}
