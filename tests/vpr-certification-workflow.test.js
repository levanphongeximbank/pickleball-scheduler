import test from "node:test";
import assert from "node:assert/strict";

import {
  CERTIFICATION_STATUS,
  TOURNAMENT_LEVEL,
  TOURNAMENT_STATUS,
  VPR_AWARD_STATUS,
} from "../src/models/tournament/constants.js";
import { resolveCertificationForLevel } from "../src/models/tournament/tournament.js";
import { canAwardVprPoints } from "../src/features/vpr-ranking/utils/vprEligibility.js";
import {
  syncCertificationRequest,
} from "../src/features/vpr-ranking/services/tournamentCertificationService.js";
import { resetVprLocalStoreForTests } from "../src/features/vpr-ranking/storage/vprLocalStore.js";

test("resolveCertificationForLevel sets pending for VPR levels", () => {
  const result = resolveCertificationForLevel(TOURNAMENT_LEVEL.VPT_250, {});
  assert.equal(result.certificationStatus, CERTIFICATION_STATUS.PENDING);
  assert.equal(result.rankingEnabled, false);
});

test("resolveCertificationForLevel not_required for community", () => {
  const result = resolveCertificationForLevel(TOURNAMENT_LEVEL.COMMUNITY, {});
  assert.equal(result.certificationStatus, CERTIFICATION_STATUS.NOT_REQUIRED);
});

test("canAwardVprPoints requires all gates", () => {
  const base = {
    rankingEnabled: true,
    certificationStatus: CERTIFICATION_STATUS.APPROVED,
    status: TOURNAMENT_STATUS.COMPLETED,
    resultsConfirmation: { confirmed: true },
    vprAward: { status: VPR_AWARD_STATUS.PENDING },
  };
  assert.equal(canAwardVprPoints(base).ok, true);
  assert.equal(canAwardVprPoints({ ...base, rankingEnabled: false }).reason, "ranking-disabled");
  assert.equal(
    canAwardVprPoints({ ...base, certificationStatus: CERTIFICATION_STATUS.PENDING }).reason,
    "not-certified"
  );
});

test("certification sync upserts pending row", async () => {
  resetVprLocalStoreForTests();
  const tournament = {
    id: "t-vpr-1",
    name: "VPT Test",
    mode: "official_tournament",
    tournamentLevel: TOURNAMENT_LEVEL.VPT_250,
    certificationStatus: CERTIFICATION_STATUS.PENDING,
    rankingEnabled: false,
    certification: { requestedAt: new Date().toISOString() },
  };

  const sync = await syncCertificationRequest("club-1", tournament);
  assert.equal(sync.ok, true);
  assert.equal(sync.certification.certificationStatus, CERTIFICATION_STATUS.PENDING);
  assert.equal(sync.certification.clubId, "club-1");
});
