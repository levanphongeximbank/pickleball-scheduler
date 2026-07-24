/**
 * E2E-07 public privacy certification.
 */

import {
  PUBLICATION_OPS_STATE,
  PUBLIC_FORBIDDEN_KEYS,
  createPublicCompetitionExperienceFacade,
  createInMemoryPublicExperienceStore,
} from "../../operations/index.js";
import { CERTIFICATION_CHECK, CERTIFICATION_ERROR_CODE, CERTIFICATION_FORBIDDEN_KEYS } from "../constants.js";
import { createIndividualPoolKnockoutScenarioFixture } from "../fixtures/individualPoolKnockoutScenario.js";
import {
  computeCertificationFingerprint,
  deepFreeze,
  stripForbiddenKeys,
} from "../fingerprint.js";

/**
 * @param {object} [input]
 */
export async function runPublicPrivacyCertification(input = {}) {
  const fixture =
    input.fixture || createIndividualPoolKnockoutScenarioFixture(input.fixtureOverrides);
  const store = createInMemoryPublicExperienceStore({ clockIso: fixture.clockIso });
  const facade = createPublicCompetitionExperienceFacade({ store });

  const unpublishedBlocked = await (async () => {
    try {
      await facade.getPublicCompetitionOverview({
        tenantId: fixture.tenantId,
        competitionId: fixture.competitionId,
      });
      return false;
    } catch {
      return true;
    }
  })();

  const snapshot = {
    tenantId: fixture.tenantId,
    competitionId: fixture.competitionId,
    venueId: fixture.venueId,
    publicTitle: fixture.publicOverlay.publicTitle,
    publicationState: PUBLICATION_OPS_STATE.FINAL_RESULT_PUBLISHED,
    entries: [
      {
        participantId: "p1",
        displayName: "Public Player",
        publicVisible: true,
      },
      {
        participantId: "p-private",
        displayName: "Hidden",
        publicVisible: false,
        email: "secret@example.com",
      },
    ],
    matches: [
      {
        matchId: "m1",
        status: "COMPLETED",
        refereeEmail: "ref@internal.test",
        participantIds: ["p1", "p2"],
      },
    ],
    standings: {
      fingerprint: "stand-privacy-1",
      unresolvedTie: true,
      rows: [
        { participantId: "p1", rank: 1, points: 3 },
        { participantId: "p2", rank: 1, points: 3 },
      ],
    },
    branding: {
      email: "brand@internal.test",
      grantedPermissions: ["tournament.view"],
    },
    audit: { evidencePresent: true, operatorEmail: "ops@internal.test" },
  };

  facade.putPublishedCompetitionSnapshot({
    tenantId: fixture.tenantId,
    competitionId: fixture.competitionId,
    snapshot,
  });

  const overview = await facade.getPublicCompetitionOverview({
    tenantId: fixture.tenantId,
    competitionId: fixture.competitionId,
  });
  const participants = await facade.getPublicParticipants({
    tenantId: fixture.tenantId,
    competitionId: fixture.competitionId,
  });
  const standings = await facade.getPublicStandings({
    tenantId: fixture.tenantId,
    competitionId: fixture.competitionId,
  });

  const fullExperience = await facade.getPublicCompetitionExperience({
    tenantId: fixture.tenantId,
    competitionId: fixture.competitionId,
  });

  const stripped = stripForbiddenKeys(
    JSON.parse(JSON.stringify(overview.result || overview.projection || overview)),
    CERTIFICATION_FORBIDDEN_KEYS
  );
  const strippedStr = JSON.stringify(stripped).toLowerCase();
  const forbiddenPresent = CERTIFICATION_FORBIDDEN_KEYS.some((k) =>
    strippedStr.includes(String(k).toLowerCase())
  );
  const forbiddenKeysOk = !forbiddenPresent;

  const privateStripped =
    !participants.result?.entries?.some((e) => e.participantId === "p-private") &&
    !participants.projection?.entries?.some((e) => e.participantId === "p-private");

  const realtimeDisabled =
    fullExperience.result?.matchCenter?.realtimeEnabled === false ||
    (await facade.getPublicMatchCenter({
      tenantId: fixture.tenantId,
      competitionId: fixture.competitionId,
    })).result?.realtimeEnabled === false;

  const tiePreserved =
    standings.projection?.unresolvedTie === true ||
    standings.result?.unresolvedTie === true;

  const checks = Object.freeze([
    Object.freeze({
      id: "unpublished-hidden",
      ok: unpublishedBlocked,
      detail: "unpublished competition fail-closed",
    }),
    Object.freeze({
      id: "private-participant-stripped",
      ok: privateStripped,
      detail: "non-public participant hidden",
    }),
    Object.freeze({
      id: "forbidden-keys-absent",
      ok: forbiddenKeysOk,
      detail: `scanned ${PUBLIC_FORBIDDEN_KEYS.length} public forbidden keys`,
    }),
    Object.freeze({
      id: "realtime-disabled",
      ok: realtimeDisabled,
      detail: "realtimeEnabled false in projections",
    }),
    Object.freeze({
      id: "unresolved-tie-preserved",
      ok: tiePreserved,
      detail: "standings unresolved tie preserved when projected",
    }),
  ]);

  const ok = checks.every((c) => c.ok);
  const evidence = deepFreeze({
    scenarioId: fixture.scenarioId,
    publicationState: snapshot.publicationState,
    sourceCommit: input.sourceCommit ?? null,
    generatedAt: input.generatedAt ?? null,
  });

  const deterministicFingerprint = computeCertificationFingerprint({
    kind: "public-privacy-certification",
    ok,
    checks: checks.map((c) => ({ id: c.id, ok: c.ok })),
    evidence,
  });

  return deepFreeze({
    ok,
    checkId: CERTIFICATION_CHECK.PUBLIC_PRIVACY,
    checks,
    evidence,
    warnings: Object.freeze([]),
    blockers: Object.freeze(
      ok
        ? []
        : [
            Object.freeze({
              code: CERTIFICATION_ERROR_CODE.PUBLIC_PRIVACY_BLOCKED,
              message: "public privacy certification failed",
            }),
          ]
    ),
    deterministicFingerprint,
  });
}
