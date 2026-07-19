import { getRecipientDirectory } from "./recipientDirectory.js";
import { ensureIdentityRecipientDirectory } from "./recipientBootstrap.js";

// Ensure Phase 1.3 identity directory is the default when nothing is injected.
ensureIdentityRecipientDirectory({ allowUnverifiedUserIds: true });

/**
 * Resolve recipientHints → unique tenant-scoped userIds.
 *
 * @param {object} input
 * @param {string} input.tenantId
 * @param {string|null} [input.venueId]
 * @param {string|null} [input.clubId]
 * @param {string|null} [input.competitionId]
 * @param {{ userIds?: string[], roles?: string[], entryIds?: string[] }} input.recipientHints
 * @param {import("./recipientDirectory.js").RecipientDirectory} [input.directory]
 * @returns {{ ok: true, recipients: Array<{ userId: string, tenantId: string }>, rejected: string[] } | { ok: false, error: string }}
 */
export function resolveNotificationRecipients({
  tenantId,
  venueId = null,
  clubId = null,
  competitionId = null,
  recipientHints = {},
  directory = null,
} = {}) {
  if (!tenantId) {
    return { ok: false, error: "tenantId is required for recipient resolution." };
  }

  const dir = directory || getRecipientDirectory();
  const hints = recipientHints || {};
  const collected = [];
  const rejected = [];
  const skipped = [];

  const userIds = Array.isArray(hints.userIds) ? hints.userIds : [];
  const roles = Array.isArray(hints.roles) ? hints.roles : [];
  const entryIds = Array.isArray(hints.entryIds) ? hints.entryIds : [];

  if (userIds.length) {
    const resolved = dir.listUsersByIds({ tenantId, userIds });
    const resolvedIds = new Set(resolved.map((u) => u.userId));
    for (const raw of userIds) {
      const id = String(raw);
      if (!resolvedIds.has(id)) {
        rejected.push(id);
      }
    }
    for (const user of resolved) {
      if (user.tenantId !== tenantId) {
        rejected.push(user.userId);
        continue;
      }
      collected.push(user);
    }
  }

  if (roles.length) {
    const resolved = dir.listUsersByRoles({
      tenantId,
      venueId,
      clubId,
      roles,
    });
    for (const user of resolved) {
      if (user.tenantId !== tenantId) {
        rejected.push(user.userId);
        continue;
      }
      collected.push(user);
    }
  }

  if (entryIds.length) {
    const resolved = dir.listUsersByEntryIds({
      tenantId,
      competitionId,
      entryIds,
    });
    const resolvedEntryIds = new Set(
      (resolved || []).map((u) => String(u.entryId || "")).filter(Boolean)
    );
    for (const raw of entryIds) {
      const entryId = String(raw);
      const hasUserForEntry = (resolved || []).some(
        (u) => String(u.entryId || "") === entryId && u.userId
      );
      if (!hasUserForEntry && !resolvedEntryIds.has(entryId)) {
        skipped.push({ entryId, reason: "unresolved_entry_or_no_linked_user" });
        rejected.push(`entry:${entryId}`);
      }
    }
    for (const user of resolved || []) {
      if (!user.userId || user.tenantId !== tenantId) {
        if (user.userId) rejected.push(user.userId);
        continue;
      }
      collected.push(user);
    }
  }

  const seen = new Set();
  const recipients = [];
  for (const user of collected) {
    const userId = String(user.userId || "").trim();
    if (!userId) continue;
    if (user.tenantId !== tenantId) {
      rejected.push(userId);
      continue;
    }
    if (seen.has(userId)) continue;
    seen.add(userId);
    recipients.push({ userId, tenantId });
  }

  return {
    ok: true,
    recipients,
    rejected: [...new Set(rejected)],
    skipped,
  };
}
