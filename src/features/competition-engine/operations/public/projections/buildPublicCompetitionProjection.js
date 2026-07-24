/**
 * Build fail-closed public competition projections from a published record.
 * Allowlist mapping only — no standings/bracket/schedule engines.
 */

import { PUBLICATION_OPS_STATE } from "../../constants.js";
import {
  PUBLIC_AVAILABILITY,
  PUBLIC_MATCH_STATUS,
} from "../constants.js";
import {
  computePublicFingerprint,
  deepFreeze,
  isNonEmptyString,
} from "../fingerprint.js";
import { resolvePublicVisibility } from "../gates/publicationPrivacyGates.js";
import {
  pickAllowlisted,
  PUBLIC_BRACKET_SLOT_FIELDS,
  PUBLIC_COURT_FIELDS,
  PUBLIC_FINAL_RESULT_FIELDS,
  PUBLIC_MATCH_CENTER_FIELDS,
  PUBLIC_OVERVIEW_FIELDS,
  PUBLIC_PARTICIPANT_FIELDS,
  PUBLIC_POOL_GROUP_FIELDS,
  PUBLIC_QUALIFIER_FIELDS,
  PUBLIC_SCHEDULE_MATCH_FIELDS,
  PUBLIC_STANDING_ROW_FIELDS,
  stripForbiddenKeys,
} from "./allowlists.js";
import { mapPublicMatchStatus, mapPublicScore } from "./mapMatchStatus.js";

/**
 * @param {object} record
 * @returns {ReturnType<typeof resolvePublicVisibility>}
 */
function visibilityOf(record) {
  return resolvePublicVisibility(
    record.visibility,
    record.publicationState || PUBLICATION_OPS_STATE.NONE
  );
}

/**
 * @param {object} entry
 * @returns {boolean}
 */
function isPublicParticipant(entry) {
  if (!entry || typeof entry !== "object") return false;
  if (entry.publicVisible === false) return false;
  if (entry.private === true) return false;
  if (String(entry.visibility || "").toUpperCase() === "PRIVATE") return false;
  return true;
}

/**
 * @param {object} entry
 * @returns {object}
 */
function mapParticipant(entry) {
  return pickAllowlisted(
    {
      participantId: String(entry.participantId || entry.id || "").trim(),
      displayName: String(
        entry.displayName || entry.publicName || entry.participantId || ""
      ).trim(),
      seedNumber:
        entry.seedNumber != null && Number.isFinite(Number(entry.seedNumber))
          ? Number(entry.seedNumber)
          : null,
      divisionId: entry.divisionId != null ? String(entry.divisionId) : null,
      categoryId: entry.categoryId != null ? String(entry.categoryId) : null,
      status: String(entry.status || "ELIGIBLE").toUpperCase(),
    },
    PUBLIC_PARTICIPANT_FIELDS
  );
}

/**
 * @param {object} record
 */
export function buildPublicOverviewProjection(record) {
  const visibility = visibilityOf(record);
  if (!visibility.competitionPublished) {
    return deepFreeze({
      available: false,
      availability: PUBLIC_AVAILABILITY.UNAVAILABLE,
      reasonCode: "COMPETITION_UNPUBLISHED",
      competitionId: record.competitionId ?? null,
      tenantId: record.tenantId ?? null,
      projectionFingerprint: computePublicFingerprint(
        {
          competitionId: record.competitionId,
          tenantId: record.tenantId,
          available: false,
        },
        "e2e05-overview"
      ),
    });
  }

  const brandingSource =
    record.branding && typeof record.branding === "object" ? record.branding : {};
  const venueSource =
    record.venue && typeof record.venue === "object"
      ? record.venue
      : {
          venueId: record.venueId ?? null,
          venueName: record.venueName ?? null,
        };
  const datesSource =
    record.dates && typeof record.dates === "object" ? record.dates : {};

  const overview = pickAllowlisted(
    {
      competitionId: record.competitionId ?? null,
      tenantId: record.tenantId ?? null,
      publicTitle: String(
        record.publicTitle ||
          brandingSource.publicTitle ||
          record.title ||
          record.competitionId ||
          ""
      ).trim(),
      branding: Object.freeze(
        stripForbiddenKeys({
          publicTitle: brandingSource.publicTitle ?? null,
          primaryColor: brandingSource.primaryColor ?? null,
          logoRef: brandingSource.logoRef ?? null,
          tagline: brandingSource.tagline ?? null,
        })
      ),
      venue: Object.freeze(
        stripForbiddenKeys({
          venueId: venueSource.venueId ?? record.venueId ?? null,
          venueName: venueSource.venueName ?? record.venueName ?? null,
          city: venueSource.city ?? null,
        })
      ),
      dates: Object.freeze(
        stripForbiddenKeys({
          startDate: datesSource.startDate ?? record.startDate ?? null,
          endDate: datesSource.endDate ?? record.endDate ?? null,
          timezone: datesSource.timezone ?? record.timezone ?? null,
        })
      ),
      divisions: Object.freeze(
        (Array.isArray(record.divisions) ? record.divisions : []).map((d) =>
          Object.freeze(
            stripForbiddenKeys({
              divisionId: d?.divisionId ?? d?.id ?? null,
              label: d?.label ?? d?.name ?? null,
              categoryId: d?.categoryId ?? null,
            })
          )
        )
      ),
      publicationStatus: String(
        record.publicationState || PUBLICATION_OPS_STATE.NONE
      ),
      availability: record.archive?.status === "ARCHIVED"
        ? PUBLIC_AVAILABILITY.ARCHIVED
        : PUBLIC_AVAILABILITY.AVAILABLE,
      templateId: record.templateId ?? null,
      formatLabel: record.formatLabel ?? "INDIVIDUAL_POOL_KNOCKOUT",
    },
    PUBLIC_OVERVIEW_FIELDS
  );

  const fingerprint = computePublicFingerprint(overview, "e2e05-overview");
  return deepFreeze({
    available: true,
    ...overview,
    projectionFingerprint: fingerprint,
  });
}

/**
 * @param {object} record
 */
export function buildPublicParticipantsProjection(record) {
  const visibility = visibilityOf(record);
  if (!visibility.competitionPublished || !visibility.participantsVisible) {
    return deepFreeze({
      available: false,
      reasonCode: !visibility.competitionPublished
        ? "COMPETITION_UNPUBLISHED"
        : "PARTICIPANTS_HIDDEN",
      participants: Object.freeze([]),
      projectionFingerprint: computePublicFingerprint(
        { available: false },
        "e2e05-participants"
      ),
    });
  }

  const entries = Array.isArray(record.entries) ? record.entries : [];
  const participants = entries
    .filter(isPublicParticipant)
    .map(mapParticipant)
    .filter((p) => isNonEmptyString(p.participantId))
    .sort((a, b) =>
      String(a.participantId).localeCompare(String(b.participantId))
    )
    .map((p) => Object.freeze(p));

  const payload = {
    available: true,
    competitionId: record.competitionId ?? null,
    tenantId: record.tenantId ?? null,
    participants: Object.freeze(participants),
    count: participants.length,
  };
  return deepFreeze({
    ...payload,
    projectionFingerprint: computePublicFingerprint(payload, "e2e05-participants"),
  });
}

/**
 * @param {object} record
 */
export function buildPublicScheduleProjection(record) {
  const visibility = visibilityOf(record);
  if (!visibility.competitionPublished || !visibility.schedulePublished) {
    return deepFreeze({
      available: false,
      reasonCode: !visibility.competitionPublished
        ? "COMPETITION_UNPUBLISHED"
        : "SCHEDULE_UNPUBLISHED",
      matches: Object.freeze([]),
      courts: Object.freeze([]),
      projectionFingerprint: computePublicFingerprint(
        { available: false },
        "e2e05-schedule"
      ),
    });
  }

  const schedule =
    record.schedule && typeof record.schedule === "object"
      ? record.schedule
      : {};
  const timezone = schedule.timezone ?? record.timezone ?? null;
  const rawMatches = Array.isArray(schedule.matches)
    ? schedule.matches
    : Array.isArray(record.matches)
      ? record.matches
      : [];

  const matches = rawMatches
    .map((m) => {
      const venueId = m?.venueId ?? schedule.venueId ?? record.venueId ?? null;
      const courtId = m?.courtId ?? null;
      return pickAllowlisted(
        {
          matchId: String(m?.matchId || m?.id || "").trim(),
          divisionId: m?.divisionId ?? null,
          stage: m?.stage ?? null,
          round: m?.round ?? m?.roundLabel ?? null,
          scheduledTime: m?.scheduledTime ?? m?.startTime ?? null,
          timezone: m?.timezone ?? timezone,
          venueId,
          venueName: m?.venueName ?? record.venueName ?? null,
          courtId,
          courtName: m?.courtName ?? m?.courtLabel ?? null,
          status: mapPublicMatchStatus(m?.status),
          participantIds: Object.freeze(
            Array.isArray(m?.participantIds)
              ? m.participantIds.map((id) => String(id))
              : []
          ),
          participantLabels: Object.freeze(
            Array.isArray(m?.participantLabels)
              ? m.participantLabels.map((label) => String(label))
              : []
          ),
        },
        PUBLIC_SCHEDULE_MATCH_FIELDS
      );
    })
    .filter((m) => isNonEmptyString(m.matchId))
    .sort((a, b) => {
      const t = String(a.scheduledTime || "").localeCompare(
        String(b.scheduledTime || "")
      );
      if (t !== 0) return t;
      return String(a.matchId).localeCompare(String(b.matchId));
    })
    .map((m) => Object.freeze(m));

  const courtsSource = Array.isArray(record.courts)
    ? record.courts
    : Array.isArray(schedule.courts)
      ? schedule.courts
      : [];
  const courts = courtsSource
    .filter((c) => c?.publicVisible !== false)
    .map((c) =>
      Object.freeze(
        pickAllowlisted(
          {
            courtId: String(c?.courtId || c?.id || "").trim(),
            courtName: String(c?.courtName || c?.name || "").trim(),
            venueId: c?.venueId ?? record.venueId ?? null,
            venueName: c?.venueName ?? record.venueName ?? null,
            publicLabel: c?.publicLabel ?? c?.courtName ?? c?.name ?? null,
          },
          PUBLIC_COURT_FIELDS
        )
      )
    )
    .filter((c) => isNonEmptyString(c.courtId))
    .sort((a, b) => String(a.courtId).localeCompare(String(b.courtId)));

  const payload = {
    available: true,
    competitionId: record.competitionId ?? null,
    tenantId: record.tenantId ?? null,
    timezone,
    certifiedFingerprint:
      schedule.fingerprint ?? record.scheduleFingerprint ?? null,
    matches: Object.freeze(matches),
    courts: Object.freeze(courts),
  };
  return deepFreeze({
    ...payload,
    projectionFingerprint: computePublicFingerprint(payload, "e2e05-schedule"),
  });
}

/**
 * @param {object} record
 */
export function buildPublicPoolsProjection(record) {
  const visibility = visibilityOf(record);
  if (!visibility.competitionPublished) {
    return deepFreeze({
      available: false,
      reasonCode: "COMPETITION_UNPUBLISHED",
      groups: Object.freeze([]),
      projectionFingerprint: computePublicFingerprint(
        { available: false },
        "e2e05-pools"
      ),
    });
  }

  const pools =
    record.pools && typeof record.pools === "object" ? record.pools : {};
  const groupsSource = Array.isArray(pools.groups)
    ? pools.groups
    : Array.isArray(record.poolCompositionSummary?.groups)
      ? record.poolCompositionSummary.groups
      : [];

  const groups = groupsSource
    .map((g) =>
      Object.freeze(
        pickAllowlisted(
          {
            groupId: String(g?.groupId || g?.id || "").trim(),
            groupLabel: String(g?.groupLabel || g?.label || g?.name || "").trim(),
            participantIds: Object.freeze(
              (Array.isArray(g?.participantIds) ? g.participantIds : []).map(
                (id) => String(id)
              )
            ),
            participantLabels: Object.freeze(
              (Array.isArray(g?.participantLabels)
                ? g.participantLabels
                : []
              ).map((label) => String(label))
            ),
          },
          PUBLIC_POOL_GROUP_FIELDS
        )
      )
    )
    .filter((g) => isNonEmptyString(g.groupId))
    .sort((a, b) => String(a.groupId).localeCompare(String(b.groupId)));

  const payload = {
    available: true,
    competitionId: record.competitionId ?? null,
    tenantId: record.tenantId ?? null,
    compositionFingerprint:
      pools.fingerprint ?? record.poolCompositionFingerprint ?? null,
    groups: Object.freeze(groups),
  };
  return deepFreeze({
    ...payload,
    projectionFingerprint: computePublicFingerprint(payload, "e2e05-pools"),
  });
}

/**
 * @param {object} record
 */
export function buildPublicStandingsProjection(record) {
  const visibility = visibilityOf(record);
  if (!visibility.competitionPublished || !visibility.resultsPublished) {
    return deepFreeze({
      available: false,
      reasonCode: !visibility.competitionPublished
        ? "COMPETITION_UNPUBLISHED"
        : "RESULTS_UNPUBLISHED",
      rows: Object.freeze([]),
      unresolvedTie: false,
      projectionFingerprint: computePublicFingerprint(
        { available: false },
        "e2e05-standings"
      ),
    });
  }

  const standings =
    record.standings && typeof record.standings === "object"
      ? record.standings
      : {};
  const rowsSource = Array.isArray(standings.rows) ? standings.rows : [];
  const rows = rowsSource
    .map((r) =>
      Object.freeze(
        pickAllowlisted(
          {
            participantId: String(r?.participantId || "").trim(),
            displayName: String(r?.displayName || r?.participantId || "").trim(),
            groupId: r?.groupId ?? null,
            rank: r?.rank != null ? Number(r.rank) : null,
            played: r?.played != null ? Number(r.played) : null,
            wins: r?.wins != null ? Number(r.wins) : null,
            losses: r?.losses != null ? Number(r.losses) : null,
            points: r?.points != null ? Number(r.points) : null,
            pointDiff: r?.pointDiff != null ? Number(r.pointDiff) : null,
            qualificationStatus: r?.qualificationStatus ?? null,
          },
          PUBLIC_STANDING_ROW_FIELDS
        )
      )
    )
    .filter((r) => isNonEmptyString(r.participantId))
    .sort((a, b) => {
      const groupCmp = String(a.groupId || "").localeCompare(
        String(b.groupId || "")
      );
      if (groupCmp !== 0) return groupCmp;
      const rankA = a.rank == null ? Number.POSITIVE_INFINITY : Number(a.rank);
      const rankB = b.rank == null ? Number.POSITIVE_INFINITY : Number(b.rank);
      if (rankA !== rankB) return rankA - rankB;
      return String(a.participantId).localeCompare(String(b.participantId));
    });

  const unresolvedTie =
    standings.unresolvedTie === true || record.unresolvedTie === true;

  const payload = {
    available: true,
    competitionId: record.competitionId ?? null,
    tenantId: record.tenantId ?? null,
    rows: Object.freeze(rows),
    tieBreakExplanation: standings.tieBreakExplanation
      ? String(standings.tieBreakExplanation)
      : null,
    unresolvedTie,
    // Explicit: public layer does not compute standings — consumes published rows only.
    computedLocally: false,
    fingerprint: standings.fingerprint ?? null,
  };
  return deepFreeze({
    ...payload,
    projectionFingerprint: computePublicFingerprint(payload, "e2e05-standings"),
  });
}

/**
 * @param {object} record
 */
export function buildPublicQualificationProjection(record) {
  const visibility = visibilityOf(record);
  if (!visibility.competitionPublished || !visibility.resultsPublished) {
    return deepFreeze({
      available: false,
      reasonCode: !visibility.competitionPublished
        ? "COMPETITION_UNPUBLISHED"
        : "RESULTS_UNPUBLISHED",
      qualifiers: Object.freeze([]),
      unresolvedTie: false,
      projectionFingerprint: computePublicFingerprint(
        { available: false },
        "e2e05-qualification"
      ),
    });
  }

  const qualification =
    record.qualification && typeof record.qualification === "object"
      ? record.qualification
      : {};
  const unresolvedTie =
    qualification.unresolvedTie === true || record.unresolvedTie === true;
  const qualifiersSource = Array.isArray(qualification.qualifiers)
    ? qualification.qualifiers
    : [];

  // Preserve unresolved ties — never silently promote a qualifier.
  const qualifiers = unresolvedTie
    ? []
    : qualifiersSource
        .map((q) =>
          Object.freeze(
            pickAllowlisted(
              {
                participantId: String(q?.participantId || "").trim(),
                displayName: String(
                  q?.displayName || q?.participantId || ""
                ).trim(),
                groupId: q?.groupId ?? null,
                seedSlot: q?.seedSlot != null ? Number(q.seedSlot) : null,
                status: String(q?.status || "QUALIFIED").toUpperCase(),
              },
              PUBLIC_QUALIFIER_FIELDS
            )
          )
        )
        .filter((q) => isNonEmptyString(q.participantId))
        .sort((a, b) => {
          const slotA =
            a.seedSlot == null ? Number.POSITIVE_INFINITY : Number(a.seedSlot);
          const slotB =
            b.seedSlot == null ? Number.POSITIVE_INFINITY : Number(b.seedSlot);
          if (slotA !== slotB) return slotA - slotB;
          return String(a.participantId).localeCompare(String(b.participantId));
        });

  const payload = {
    available: true,
    competitionId: record.competitionId ?? null,
    tenantId: record.tenantId ?? null,
    qualifiers: Object.freeze(qualifiers),
    unresolvedTie,
    pendingReason: unresolvedTie ? "UNRESOLVED_TIE" : null,
    fingerprint: qualification.fingerprint ?? null,
  };
  return deepFreeze({
    ...payload,
    projectionFingerprint: computePublicFingerprint(
      payload,
      "e2e05-qualification"
    ),
  });
}

/**
 * @param {object} record
 */
export function buildPublicBracketProjection(record) {
  const visibility = visibilityOf(record);
  if (!visibility.competitionPublished || !visibility.bracketPublished) {
    return deepFreeze({
      available: false,
      reasonCode: !visibility.competitionPublished
        ? "COMPETITION_UNPUBLISHED"
        : "BRACKET_UNPUBLISHED",
      rounds: Object.freeze([]),
      slots: Object.freeze([]),
      champion: null,
      projectionFingerprint: computePublicFingerprint(
        { available: false },
        "e2e05-bracket"
      ),
    });
  }

  const bracket =
    record.bracket && typeof record.bracket === "object" ? record.bracket : {};
  const rounds = Object.freeze(
    (Array.isArray(bracket.rounds) ? bracket.rounds : []).map((r) =>
      Object.freeze(
        stripForbiddenKeys({
          roundId: r?.roundId ?? r?.id ?? null,
          roundLabel: r?.roundLabel ?? r?.label ?? null,
          status: r?.status ?? null,
        })
      )
    )
  );
  const slots = (Array.isArray(bracket.slots) ? bracket.slots : [])
    .map((s) =>
      Object.freeze(
        pickAllowlisted(
          {
            slotId: String(s?.slotId || s?.id || "").trim(),
            roundId: s?.roundId ?? null,
            roundLabel: s?.roundLabel ?? null,
            position: s?.position != null ? Number(s.position) : null,
            participantId: s?.participantId ?? null,
            displayName: s?.displayName ?? null,
            isBye: s?.isBye === true,
            isPlaceholder:
              s?.isPlaceholder === true ||
              (!s?.participantId && s?.isBye !== true),
            winnerOfMatchId: s?.winnerOfMatchId ?? null,
            status: s?.status ?? null,
          },
          PUBLIC_BRACKET_SLOT_FIELDS
        )
      )
    )
    .filter((s) => isNonEmptyString(s.slotId))
    .sort((a, b) => {
      const roundCmp = String(a.roundId || "").localeCompare(
        String(b.roundId || "")
      );
      if (roundCmp !== 0) return roundCmp;
      const posA =
        a.position == null ? Number.POSITIVE_INFINITY : Number(a.position);
      const posB =
        b.position == null ? Number.POSITIVE_INFINITY : Number(b.position);
      if (posA !== posB) return posA - posB;
      return String(a.slotId).localeCompare(String(b.slotId));
    });

  const championVisible =
    visibility.finalResultsPublished === true && bracket.champion != null;
  const champion = championVisible
    ? Object.freeze(
        stripForbiddenKeys({
          participantId: bracket.champion.participantId ?? null,
          displayName: bracket.champion.displayName ?? null,
        })
      )
    : null;

  const payload = {
    available: true,
    competitionId: record.competitionId ?? null,
    tenantId: record.tenantId ?? null,
    rounds,
    slots: Object.freeze(slots),
    champion,
    // Explicit: no winner inference in public layer.
    inferredWinners: false,
    fingerprint: bracket.fingerprint ?? record.knockoutFingerprint ?? null,
  };
  return deepFreeze({
    ...payload,
    projectionFingerprint: computePublicFingerprint(payload, "e2e05-bracket"),
  });
}

/**
 * @param {object} record
 */
export function buildPublicMatchCenterProjection(record) {
  const visibility = visibilityOf(record);
  if (!visibility.competitionPublished) {
    return deepFreeze({
      available: false,
      reasonCode: "COMPETITION_UNPUBLISHED",
      matches: Object.freeze([]),
      projectionFingerprint: computePublicFingerprint(
        { available: false },
        "e2e05-match-center"
      ),
    });
  }

  const matchCenter =
    record.matchCenter && typeof record.matchCenter === "object"
      ? record.matchCenter
      : {};
  const rawMatches = Array.isArray(matchCenter.matches)
    ? matchCenter.matches
    : Array.isArray(record.matches)
      ? record.matches
      : [];

  const matches = rawMatches
    .map((m) => {
      const status = mapPublicMatchStatus(m?.status);
      const score = mapPublicScore(m, visibility);
      const validatedResult =
        visibility.resultsPublished && m?.validatedResult
          ? Object.freeze(
              stripForbiddenKeys({
                accepted: m.validatedResult.accepted === true,
                score: m.validatedResult.score ?? null,
                winnerParticipantId:
                  m.validatedResult.winnerParticipantId ?? null,
              })
            )
          : null;

      return pickAllowlisted(
        {
          matchId: String(m?.matchId || m?.id || "").trim(),
          divisionId: m?.divisionId ?? null,
          stage: m?.stage ?? null,
          round: m?.round ?? null,
          participants: Object.freeze(
            (Array.isArray(m?.participants)
              ? m.participants
              : Array.isArray(m?.participantIds)
                ? m.participantIds.map((id) => ({ participantId: id }))
                : []
            ).map((p) =>
              Object.freeze(
                stripForbiddenKeys({
                  participantId: p?.participantId ?? p?.id ?? null,
                  displayName: p?.displayName ?? p?.participantId ?? null,
                })
              )
            )
          ),
          scheduledTime: m?.scheduledTime ?? m?.startTime ?? null,
          timezone: m?.timezone ?? record.timezone ?? null,
          venue: Object.freeze(
            stripForbiddenKeys({
              venueId: m?.venueId ?? record.venueId ?? null,
              venueName: m?.venueName ?? record.venueName ?? null,
            })
          ),
          court: Object.freeze(
            stripForbiddenKeys({
              courtId: m?.courtId ?? null,
              courtName: m?.courtName ?? null,
            })
          ),
          status,
          score,
          validatedResult,
          nextMatchId: m?.nextMatchId ?? null,
          updateVersion:
            m?.updateVersion ?? m?.revision ?? record.revision ?? 0,
        },
        PUBLIC_MATCH_CENTER_FIELDS
      );
    })
    .filter((m) => isNonEmptyString(m.matchId))
    .sort((a, b) => {
      const t = String(a.scheduledTime || "").localeCompare(
        String(b.scheduledTime || "")
      );
      if (t !== 0) return t;
      return String(a.matchId).localeCompare(String(b.matchId));
    })
    .map((m) => Object.freeze(m));

  const payload = {
    available: true,
    competitionId: record.competitionId ?? null,
    tenantId: record.tenantId ?? null,
    matches: Object.freeze(matches),
    statusSummary: Object.freeze({
      scheduled: matches.filter((m) => m.status === PUBLIC_MATCH_STATUS.SCHEDULED)
        .length,
      active: matches.filter((m) => m.status === PUBLIC_MATCH_STATUS.ACTIVE)
        .length,
      suspended: matches.filter(
        (m) => m.status === PUBLIC_MATCH_STATUS.SUSPENDED
      ).length,
      delayed: matches.filter((m) => m.status === PUBLIC_MATCH_STATUS.DELAYED)
        .length,
      completed: matches.filter(
        (m) => m.status === PUBLIC_MATCH_STATUS.COMPLETED
      ).length,
      cancelled: matches.filter(
        (m) =>
          m.status === PUBLIC_MATCH_STATUS.CANCELLED ||
          m.status === PUBLIC_MATCH_STATUS.VOID
      ).length,
    }),
    // No realtime backend — polling/refresh adapter may re-query this projection.
    realtimeEnabled: false,
  };
  return deepFreeze({
    ...payload,
    projectionFingerprint: computePublicFingerprint(
      payload,
      "e2e05-match-center"
    ),
  });
}

/**
 * @param {object} record
 */
export function buildPublicFinalResultsProjection(record) {
  const visibility = visibilityOf(record);
  if (!visibility.competitionPublished || !visibility.finalResultsPublished) {
    return deepFreeze({
      available: false,
      reasonCode: !visibility.competitionPublished
        ? "COMPETITION_UNPUBLISHED"
        : "FINAL_RESULTS_UNPUBLISHED",
      ranking: Object.freeze([]),
      awards: Object.freeze([]),
      projectionFingerprint: computePublicFingerprint(
        { available: false },
        "e2e05-final"
      ),
    });
  }

  const finalResults =
    record.finalResults && typeof record.finalResults === "object"
      ? record.finalResults
      : {};
  const ranking = (Array.isArray(finalResults.ranking)
    ? finalResults.ranking
    : []
  )
    .map((r) =>
      Object.freeze(
        pickAllowlisted(
          {
            participantId: String(r?.participantId || "").trim(),
            displayName: String(r?.displayName || r?.participantId || "").trim(),
            placement: r?.placement != null ? Number(r.placement) : null,
            award: r?.award ?? null,
          },
          PUBLIC_FINAL_RESULT_FIELDS
        )
      )
    )
    .filter((r) => isNonEmptyString(r.participantId))
    .sort((a, b) => {
      const pa =
        a.placement == null ? Number.POSITIVE_INFINITY : Number(a.placement);
      const pb =
        b.placement == null ? Number.POSITIVE_INFINITY : Number(b.placement);
      if (pa !== pb) return pa - pb;
      return String(a.participantId).localeCompare(String(b.participantId));
    });

  const awards = Object.freeze(
    (Array.isArray(finalResults.awards) ? finalResults.awards : [])
      .map((a) =>
        Object.freeze(
          stripForbiddenKeys({
            awardId: a?.awardId ?? a?.id ?? null,
            label: a?.label ?? a?.name ?? null,
            participantId: a?.participantId ?? null,
            displayName: a?.displayName ?? null,
          })
        )
      )
      .filter((a) => a.awardId != null || a.participantId != null)
  );

  const payload = {
    available: true,
    competitionId: record.competitionId ?? null,
    tenantId: record.tenantId ?? null,
    ranking: Object.freeze(ranking),
    awards,
    fingerprint: finalResults.fingerprint ?? null,
  };
  return deepFreeze({
    ...payload,
    projectionFingerprint: computePublicFingerprint(payload, "e2e05-final"),
  });
}

/**
 * @param {object} record
 */
export function buildPublicArchiveProjection(record) {
  const visibility = visibilityOf(record);
  const archive =
    record.archive && typeof record.archive === "object" ? record.archive : {};
  const archived =
    archive.status === "ARCHIVED" || archive.visible === true;

  if (!visibility.archiveVisible && !archived) {
    return deepFreeze({
      available: false,
      reasonCode: "ARCHIVE_HIDDEN",
      status: "NOT_ARCHIVED",
      visible: false,
      projectionFingerprint: computePublicFingerprint(
        { available: false },
        "e2e05-archive"
      ),
    });
  }

  if (!visibility.archiveVisible) {
    return deepFreeze({
      available: false,
      reasonCode: "ARCHIVE_HIDDEN",
      status: archive.status ?? "ARCHIVED",
      visible: false,
      projectionFingerprint: computePublicFingerprint(
        { available: false, status: archive.status ?? "ARCHIVED" },
        "e2e05-archive"
      ),
    });
  }

  const payload = {
    available: true,
    competitionId: record.competitionId ?? null,
    tenantId: record.tenantId ?? null,
    status: String(archive.status || "ARCHIVED"),
    visible: true,
    archivedAt: archive.archivedAt ?? null,
    fingerprint: archive.fingerprint ?? null,
  };
  return deepFreeze({
    ...payload,
    projectionFingerprint: computePublicFingerprint(payload, "e2e05-archive"),
  });
}

/**
 * Full public experience aggregate.
 * @param {object} record
 */
export function buildPublicCompetitionExperienceProjection(record) {
  const overview = buildPublicOverviewProjection(record);
  const participants = buildPublicParticipantsProjection(record);
  const schedule = buildPublicScheduleProjection(record);
  const pools = buildPublicPoolsProjection(record);
  const standings = buildPublicStandingsProjection(record);
  const qualification = buildPublicQualificationProjection(record);
  const bracket = buildPublicBracketProjection(record);
  const matchCenter = buildPublicMatchCenterProjection(record);
  const finalResults = buildPublicFinalResultsProjection(record);
  const archive = buildPublicArchiveProjection(record);
  const visibility = visibilityOf(record);

  const payload = {
    competitionId: record.competitionId ?? null,
    tenantId: record.tenantId ?? null,
    visibility,
    overview,
    participants,
    schedule,
    pools,
    standings,
    qualification,
    bracket,
    matchCenter,
    finalResults,
    archive,
  };

  return deepFreeze({
    ...payload,
    experienceFingerprint: computePublicFingerprint(payload, "e2e05-experience"),
  });
}
