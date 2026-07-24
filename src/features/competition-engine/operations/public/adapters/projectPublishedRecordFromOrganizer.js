/**
 * Project a published public record from an Organizer operations record + overlays.
 * Read-only — does not mutate Organizer state or call Organizer commands.
 */

import { PUBLICATION_OPS_STATE } from "../../constants.js";
import { clonePlain, deepFreeze, isNonEmptyString } from "../fingerprint.js";
import { resolvePublicVisibility } from "../gates/publicationPrivacyGates.js";

/**
 * @param {{
 *   organizerRecord: object,
 *   publicOverlay?: object,
 * }} input
 * @returns {Readonly<object>}
 */
export function projectPublishedRecordFromOrganizer(input) {
  const organizer =
    input.organizerRecord && typeof input.organizerRecord === "object"
      ? input.organizerRecord
      : {};
  const overlay =
    input.publicOverlay && typeof input.publicOverlay === "object"
      ? input.publicOverlay
      : {};

  const publicationState =
    overlay.publicationState ||
    organizer.publicationState ||
    PUBLICATION_OPS_STATE.NONE;

  const visibility = resolvePublicVisibility(
    overlay.visibility || organizer.visibility,
    publicationState
  );

  const entriesSource = Array.isArray(overlay.entries)
    ? overlay.entries
    : Array.isArray(organizer.entries)
      ? organizer.entries
      : [];

  const record = {
    tenantId: organizer.tenantId ?? overlay.tenantId ?? null,
    competitionId: organizer.competitionId ?? overlay.competitionId ?? null,
    venueId: organizer.venueId ?? overlay.venueId ?? null,
    venueName: overlay.venueName ?? organizer.venueName ?? null,
    publicTitle: overlay.publicTitle ?? organizer.publicTitle ?? null,
    title: overlay.title ?? organizer.title ?? null,
    branding: overlay.branding ?? organizer.branding ?? null,
    dates: overlay.dates ?? organizer.dates ?? null,
    timezone: overlay.timezone ?? organizer.timezone ?? null,
    divisions: overlay.divisions ?? organizer.divisions ?? [],
    templateId: organizer.templateId ?? overlay.templateId ?? null,
    formatLabel: overlay.formatLabel ?? "INDIVIDUAL_POOL_KNOCKOUT",
    publicationState,
    visibility,
    entries: entriesSource.map((e) => ({
      participantId: e?.participantId ?? e?.id ?? null,
      displayName: e?.displayName ?? e?.publicName ?? e?.participantId ?? null,
      seedNumber: e?.seedNumber ?? null,
      divisionId: e?.divisionId ?? null,
      categoryId: e?.categoryId ?? null,
      status: e?.status ?? "ELIGIBLE",
      publicVisible: e?.publicVisible !== false,
      private: e?.private === true,
      visibility: e?.visibility ?? "PUBLIC",
    })),
    schedule:
      overlay.schedule ||
      organizer.schedule ||
      (organizer.scheduleSummary
        ? {
            fingerprint: organizer.scheduleFingerprint,
            matches: organizer.scheduleSummary.matches || [],
            courts: organizer.scheduleSummary.courts || [],
            timezone: organizer.timezone ?? null,
          }
        : null),
    scheduleFingerprint: organizer.scheduleFingerprint ?? null,
    courts: overlay.courts ?? organizer.courts ?? [],
    pools:
      overlay.pools ||
      organizer.pools ||
      (organizer.poolCompositionSummary
        ? {
            fingerprint: organizer.poolCompositionFingerprint,
            groups: organizer.poolCompositionSummary.groups || [],
          }
        : null),
    poolCompositionFingerprint: organizer.poolCompositionFingerprint ?? null,
    poolCompositionSummary: organizer.poolCompositionSummary ?? null,
    standings: overlay.standings ?? organizer.standings ?? null,
    unresolvedTie: organizer.unresolvedTie === true || overlay.unresolvedTie === true,
    qualification: overlay.qualification ?? organizer.qualification ?? null,
    bracket:
      overlay.bracket ||
      organizer.bracket ||
      (organizer.knockoutSummary
        ? {
            fingerprint: organizer.knockoutFingerprint,
            ...organizer.knockoutSummary,
          }
        : null),
    knockoutFingerprint: organizer.knockoutFingerprint ?? null,
    matches: overlay.matches ?? organizer.matches ?? [],
    matchCenter: overlay.matchCenter ?? organizer.matchCenter ?? null,
    finalResults: overlay.finalResults ?? organizer.finalResults ?? null,
    archive: overlay.archive ?? organizer.archive ?? null,
    revision: organizer.revision ?? overlay.revision ?? 0,
  };

  // Drop known internal-only organizer fields from the published source shape.
  void isNonEmptyString;
  return deepFreeze(clonePlain(record));
}
