/**
 * Safe tournament schedule publish → MATCH_SCHEDULED boundary bridge.
 * Does NOT modify Competition Engine internals.
 *
 * Called after schedule publish succeeds (tournament layer).
 */
import { emitMatchScheduledFromBoundary } from "./competitionMatchScheduledAdapter.js";
import { createCompetitionEntryResolver } from "../recipients/competitionEntryResolver.js";
import { getRecipientDirectory } from "../recipients/recipientDirectory.js";

function entryIdsFromMatch(match) {
  const ids = [];
  if (match?.entryAId) ids.push(String(match.entryAId));
  if (match?.entryBId) ids.push(String(match.entryBId));
  if (Array.isArray(match?.entryIds)) {
    for (const id of match.entryIds) ids.push(String(id));
  }
  return [...new Set(ids.filter(Boolean))];
}

/**
 * Emit MATCH_SCHEDULED for each scheduled match after publish.
 *
 * @param {object} input
 * @param {object} input.tournament
 * @param {object[]} input.matches
 * @param {string} [input.tenantId]
 * @param {string} [input.actorUserId]
 * @param {string|number} [input.scheduleVersion]
 */
export async function emitMatchScheduledAfterSchedulePublish(input = {}) {
  const {
    tournament,
    matches = [],
    tenantId = null,
    actorUserId = null,
    scheduleVersion = null,
  } = input;

  const resolvedTenantId =
    tenantId ||
    tournament?.tenantId ||
    tournament?.venueId ||
    tournament?.settings?.tenantId ||
    null;

  if (!resolvedTenantId) {
    return {
      ok: false,
      error: "tenantId is required to emit MATCH_SCHEDULED.",
      results: [],
      emitted: 0,
      skipped: 0,
    };
  }

  const version =
    scheduleVersion ||
    tournament?.settings?.schedule?.publishedAt ||
    tournament?.settings?.schedule?.lockedAt ||
    new Date().toISOString();

  const entryResolver = createCompetitionEntryResolver({
    tournament,
    clubId: tournament?.clubId || null,
  });
  const directory = getRecipientDirectory();
  if (directory && typeof directory === "object") {
    // Prefer injecting entry resolver onto identity directory when supported.
    // Identity directory stores entryResolver in closure — recreate via bootstrap in app.
  }

  const results = [];
  let emitted = 0;
  let skipped = 0;

  for (const match of matches || []) {
    const matchId = match?.id || match?.matchId;
    if (!matchId) {
      skipped += 1;
      results.push({ ok: false, skipped: true, reason: "missing_match_id" });
      continue;
    }
    const scheduledAt =
      match.scheduledStart || match.scheduledAt || match.startTime || null;
    const entryIds = entryIdsFromMatch(match);
    const userHints = Array.isArray(match.recipientUserIds)
      ? match.recipientUserIds.map(String)
      : [];

    const result = await emitMatchScheduledFromBoundary({
      tenantId: resolvedTenantId,
      matchId: String(matchId),
      scheduleVersion: `${version}:${matchId}`,
      competitionId: tournament?.id || tournament?.competitionId || null,
      venueId: resolvedTenantId,
      clubId: tournament?.clubId || null,
      actorUserId,
      matchLabel: match.label || match.name || match.roundLabel || String(matchId),
      scheduledAt,
      courtLabel: match.courtLabel || match.courtName || match.courtId || null,
      recipientHints: {
        entryIds,
        userIds: userHints,
        roles: entryIds.length || userHints.length ? [] : ["PLAYER"],
      },
      directory: {
        ...directory,
        listUsersByEntryIds: (args) => entryResolver(args),
        listUsersByIds: directory?.listUsersByIds?.bind(directory),
        listUsersByRoles: directory?.listUsersByRoles?.bind(directory),
      },
    });

    if (result.ok && (result.createdCount > 0 || result.duplicateCount > 0)) {
      emitted += 1;
    } else {
      skipped += 1;
    }
    results.push({
      matchId: String(matchId),
      ok: result.ok,
      outcome: result.outcome,
      createdCount: result.createdCount || 0,
      duplicateCount: result.duplicateCount || 0,
      rejectedRecipientIds: result.rejectedRecipientIds || [],
      error: result.error || null,
    });
  }

  return {
    ok: true,
    tenantId: resolvedTenantId,
    emitted,
    skipped,
    results,
  };
}
