import {
  getClubCloudVersion,
  getClubDataKey,
  loadClubData,
  saveClubData,
} from "./clubStorage.js";

const SYNC_META_KEY = "pickleball-club-sync-meta-v1";

function getSyncMetaKey(clubId) {
  return `${SYNC_META_KEY}::${clubId}`;
}

function getDefaultSyncMeta() {
  return {
    dirty: false,
    lastLocalSaveAt: null,
    lastPullAt: null,
    lastPushAt: null,
  };
}

export function getClubSyncMeta(clubId) {
  if (typeof localStorage === "undefined" || !clubId) {
    return getDefaultSyncMeta();
  }

  const raw = localStorage.getItem(getSyncMetaKey(clubId));
  if (!raw) {
    return getDefaultSyncMeta();
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      ...getDefaultSyncMeta(),
      ...(parsed && typeof parsed === "object" ? parsed : {}),
    };
  } catch {
    return getDefaultSyncMeta();
  }
}

export function markClubDataDirty(clubId) {
  if (typeof localStorage === "undefined" || !clubId) {
    return;
  }

  const meta = getClubSyncMeta(clubId);
  meta.dirty = true;
  meta.lastLocalSaveAt = new Date().toISOString();
  localStorage.setItem(getSyncMetaKey(clubId), JSON.stringify(meta));
}

export function markClubDataSynced(clubId, { pull = false, push = false } = {}) {
  if (typeof localStorage === "undefined" || !clubId) {
    return;
  }

  const meta = getClubSyncMeta(clubId);
  const now = new Date().toISOString();

  if (push) {
    meta.dirty = false;
    meta.lastPushAt = now;
  }

  if (pull) {
    meta.dirty = false;
    meta.lastPullAt = now;
  }

  localStorage.setItem(getSyncMetaKey(clubId), JSON.stringify(meta));
}

export function isClubDataDirty(clubId) {
  return getClubSyncMeta(clubId).dirty === true;
}

export function hasLocalClubBlob(clubId) {
  if (typeof localStorage === "undefined" || !clubId) {
    return false;
  }
  return Boolean(localStorage.getItem(getClubDataKey(clubId)));
}

export { getClubCloudVersion };
