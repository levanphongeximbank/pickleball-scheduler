import { getClubDataKey } from "./clubStorage.js";

const SYNC_META_KEY = "pickleball-club-sync-meta-v1";

function getSyncMetaKey(clubId) {
  return `${SYNC_META_KEY}::${clubId}`;
}

function getDefaultSyncMeta() {
  return {
    dirty: false,
    dirtyAt: null,
    dirtyReason: null,
    dirtySource: null,
    dirtyOperation: null,
    dirtyGeneration: 0,
    lastLocalSaveAt: null,
    lastPullAt: null,
    lastPushAt: null,
    lastSuccessfulSyncAt: null,
    lastSuccessfulSyncVersion: null,
    lastSuccessfulSyncKind: null,
    lastFailedSyncAt: null,
    lastFailedSyncCode: null,
    pendingPushScheduled: false,
    pendingPushScheduledAt: null,
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

function writeSyncMeta(clubId, meta) {
  localStorage.setItem(getSyncMetaKey(clubId), JSON.stringify(meta));
}

export function getClubDirtyProvenance(clubId) {
  const meta = getClubSyncMeta(clubId);
  return {
    clubId: clubId || null,
    dirty: meta.dirty === true,
    dirtyAt: meta.dirtyAt,
    dirtyReason: meta.dirtyReason,
    dirtySource: meta.dirtySource,
    dirtyOperation: meta.dirtyOperation,
    dirtyGeneration: Number(meta.dirtyGeneration) || 0,
    lastSuccessfulSyncAt: meta.lastSuccessfulSyncAt,
    lastSuccessfulSyncVersion: meta.lastSuccessfulSyncVersion,
    lastFailedSyncAt: meta.lastFailedSyncAt,
    lastFailedSyncCode: meta.lastFailedSyncCode,
    pendingPushScheduled: meta.pendingPushScheduled === true,
    pendingPushScheduledAt: meta.pendingPushScheduledAt,
  };
}

export function markClubDataDirty(clubId, details = {}) {
  if (typeof localStorage === "undefined" || !clubId) {
    return;
  }

  const meta = getClubSyncMeta(clubId);
  const now = new Date().toISOString();
  meta.dirty = true;
  meta.dirtyAt = now;
  meta.dirtyReason = String(details.reason || "club-blob-write");
  meta.dirtySource = String(details.source || "local");
  meta.dirtyOperation = String(details.operation || "saveClubData");
  meta.dirtyGeneration = Number(meta.dirtyGeneration || 0) + 1;
  meta.lastLocalSaveAt = now;
  if (details.pendingPushScheduled === true) {
    meta.pendingPushScheduled = true;
    meta.pendingPushScheduledAt = now;
  }
  writeSyncMeta(clubId, meta);
}

export function markClubDataSynced(clubId, { pull = false, push = false, version = null } = {}) {
  if (typeof localStorage === "undefined" || !clubId) {
    return;
  }

  const meta = getClubSyncMeta(clubId);
  const now = new Date().toISOString();

  if (push) {
    meta.dirty = false;
    meta.lastPushAt = now;
    meta.lastSuccessfulSyncKind = "push";
  }

  if (pull) {
    meta.dirty = false;
    meta.lastPullAt = now;
    meta.lastSuccessfulSyncKind = "pull";
  }

  if (meta.dirty === false) {
    meta.dirtyReason = null;
    meta.dirtySource = null;
    meta.dirtyOperation = null;
    meta.pendingPushScheduled = false;
    meta.pendingPushScheduledAt = null;
    meta.lastSuccessfulSyncAt = now;
    if (version != null && Number.isFinite(Number(version))) {
      meta.lastSuccessfulSyncVersion = Number(version);
    }
  }

  writeSyncMeta(clubId, meta);
}

export function recordClubSyncFailure(clubId, code) {
  if (typeof localStorage === "undefined" || !clubId) {
    return;
  }
  const meta = getClubSyncMeta(clubId);
  meta.lastFailedSyncAt = new Date().toISOString();
  meta.lastFailedSyncCode = code ? String(code) : "SYNC_FAILED";
  writeSyncMeta(clubId, meta);
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
