import { normalizeClubMember } from "../models/clubMember.js";
import { normalizeClubMembershipRequest } from "../models/clubMembershipRequest.js";
import { normalizeClubPlayerRating } from "../models/clubPlayerRating.js";
import { normalizeClubRatingHistory } from "../models/clubRatingHistory.js";
import { normalizeClubMatch } from "../models/clubMatch.js";
import { normalizeClubActivitySession } from "../models/clubActivitySession.js";

const EXTENSION_KEY_PREFIX = "pickleball-club-extension-v1";

function extensionKey(clubId) {
  return `${EXTENSION_KEY_PREFIX}::${clubId}`;
}

function emptyExtension(clubId) {
  return {
    clubId,
    members: [],
    membershipRequests: [],
    ratings: [],
    ratingHistory: [],
    matches: [],
    activitySessions: [],
    updatedAt: new Date().toISOString(),
  };
}

function safeParse(raw, fallback) {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function loadClubExtension(clubId) {
  const id = String(clubId || "").trim();
  if (!id) {
    return emptyExtension("");
  }

  const raw = localStorage.getItem(extensionKey(id));
  const parsed = safeParse(raw, emptyExtension(id));

  return {
    clubId: id,
    members: (parsed.members || []).map(normalizeClubMember),
    membershipRequests: (parsed.membershipRequests || []).map(normalizeClubMembershipRequest),
    ratings: (parsed.ratings || []).map(normalizeClubPlayerRating),
    ratingHistory: (parsed.ratingHistory || []).map(normalizeClubRatingHistory),
    matches: (parsed.matches || []).map(normalizeClubMatch),
    activitySessions: (parsed.activitySessions || [])
      .map((item) => normalizeClubActivitySession(item))
      .filter(Boolean),
    updatedAt: parsed.updatedAt || new Date().toISOString(),
  };
}

export function saveClubExtension(clubId, data) {
  const id = String(clubId || "").trim();
  if (!id) {
    return { ok: false, error: "clubId không hợp lệ." };
  }

  const payload = {
    clubId: id,
    members: (data.members || []).map(normalizeClubMember),
    membershipRequests: (data.membershipRequests || []).map(normalizeClubMembershipRequest),
    ratings: (data.ratings || []).map(normalizeClubPlayerRating),
    ratingHistory: (data.ratingHistory || []).map(normalizeClubRatingHistory),
    matches: (data.matches || []).map(normalizeClubMatch),
    activitySessions: (data.activitySessions || [])
      .map((item) => normalizeClubActivitySession(item))
      .filter(Boolean),
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(extensionKey(id), JSON.stringify(payload));
  return { ok: true, data: payload };
}

export function purgeClubExtension(clubId) {
  localStorage.removeItem(extensionKey(clubId));
}
