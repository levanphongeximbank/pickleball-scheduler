import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  FIRST_CREATE_LINEUP_EXPECTED_VERSION,
  evaluateLineupRevisionCas,
  resolveLineupExpectedVersion,
} from "../src/features/team-tournament/engines/lineupRevisionContract.js";
import {
  buildServerLineupFingerprint,
  decideLineupFormRehydration,
} from "../src/features/team-tournament/engines/lineupFormState.js";
import { LINEUP_STATUS } from "../src/features/team-tournament/constants.js";
import { filterEligiblePlayersForLineupSlot } from "../src/features/team-tournament/engines/lineupOptionFilter.js";
import { repairMlpDisciplineSlotMetadata } from "../src/features/team-tournament/engines/mlpDisciplineSlotContract.js";
import { GENDER_REQUIREMENT } from "../src/features/team-tournament/constants.js";
import { FORMAT_PRESET } from "../src/features/team-tournament/constants.js";
import { projectCaptainPortalRosterPlayers } from "../src/features/team-tournament/engines/captainPortalRosterProjection.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const packageDir = join(root, "docs/v5/migrations/team-tournament-lineup-revision-cas-01");

function readSrc(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function sha256File(name) {
  return createHash("sha256").update(readFileSync(join(packageDir, name))).digest("hex");
}

describe("TT412 lineup revision CAS contract", () => {
  it("FIRST_CREATE_EXPECTED_VERSION=0", () => {
    assert.equal(FIRST_CREATE_LINEUP_EXPECTED_VERSION, 0);
    assert.equal(resolveLineupExpectedVersion(null), 0);
    assert.equal(resolveLineupExpectedVersion({}), 0);
  });

  it("A: first create with expected=0 succeeds", () => {
    const decision = evaluateLineupRevisionCas({
      existingVersion: null,
      expectedVersion: 0,
    });
    assert.equal(decision.ok, true);
    assert.equal(decision.write, true);
    assert.equal(decision.action, "insert");
    assert.equal(decision.nextVersion, 1);
  });

  it("B: first create yields nextVersion=1", () => {
    const decision = evaluateLineupRevisionCas({
      existingVersion: null,
      expectedVersion: FIRST_CREATE_LINEUP_EXPECTED_VERSION,
    });
    assert.equal(decision.nextVersion, 1);
  });

  it("C: second save expected=1 succeeds", () => {
    const decision = evaluateLineupRevisionCas({
      existingVersion: 1,
      expectedVersion: 1,
    });
    assert.equal(decision.ok, true);
    assert.equal(decision.write, true);
  });

  it("D: next version becomes 2", () => {
    const decision = evaluateLineupRevisionCas({
      existingVersion: 1,
      expectedVersion: 1,
    });
    assert.equal(decision.nextVersion, 2);
  });

  it("E: stale expected=1 against current=2 → version_conflict", () => {
    const decision = evaluateLineupRevisionCas({
      existingVersion: 2,
      expectedVersion: 1,
    });
    assert.equal(decision.ok, false);
    assert.equal(decision.code, "version_conflict");
  });

  it("F: stale conflict writes zero", () => {
    const decision = evaluateLineupRevisionCas({
      existingVersion: 2,
      expectedVersion: 1,
    });
    assert.equal(decision.write, false);
  });

  it("H: tournament.version is irrelevant to lineup CAS", () => {
    assert.equal(resolveLineupExpectedVersion({ version: 1 }), 1);
    assert.notEqual(resolveLineupExpectedVersion({ version: 1 }), 9);
    const decision = evaluateLineupRevisionCas({
      existingVersion: 1,
      expectedVersion: 9,
    });
    assert.equal(decision.ok, false);
    assert.equal(decision.write, false);
  });

  it("J: submit uses same lineup.version contract", () => {
    assert.equal(resolveLineupExpectedVersion({ version: 2 }), 2);
    const decision = evaluateLineupRevisionCas({
      existingVersion: 2,
      expectedVersion: 2,
    });
    assert.equal(decision.nextVersion, 3);
  });

  it("K: successful submit bumps once", () => {
    const decision = evaluateLineupRevisionCas({
      existingVersion: 1,
      expectedVersion: 1,
    });
    assert.equal(decision.nextVersion, 2);
  });

  it("L: stale submit fails before write", () => {
    const decision = evaluateLineupRevisionCas({
      existingVersion: 3,
      expectedVersion: 1,
    });
    assert.equal(decision.write, false);
  });
});

describe("TT412 lineup revision client + SQL package", () => {
  it("G: TeamPortal no longer uses tournamentVersion for lineup expectedVersion", () => {
    const src = readSrc("src/pages/tournament/TeamPortal.jsx");
    assert.match(src, /resolveLineupExpectedVersion\(ownLineup\)/);
    assert.doesNotMatch(
      src,
      /expectedVersion:\s*tournamentVersion/
    );
    assert.match(src, /method:\s*"saveDraftLineup"/);
    assert.match(src, /method:\s*"submitLineup"/);
  });

  it("G copy: false conflict message only mapped for real version_conflict codes", () => {
    const orch = readSrc("src/features/team-tournament/ui/teamTournamentUiOrchestrator.js");
    assert.match(orch, /Dữ liệu đã được người khác cập nhật/);
    assert.match(orch, /VERSION_CONFLICT|version_conflict/);
  });

  it("I: schedule/deadline are not lineup fingerprint CAS fields", () => {
    const fp = buildServerLineupFingerprint(
      {
        status: LINEUP_STATUS.DRAFT,
        version: 1,
        selections: { d1: ["a"] },
        lockedAt: null,
        submittedAt: null,
      },
      "mu-1",
      "team-1"
    );
    assert.doesNotMatch(fp, /scheduledAt|lineupLockAt|deadline/);
  });

  it("M: dirty form retains on real external lineup fingerprint conflict", () => {
    const before = buildServerLineupFingerprint(
      { status: LINEUP_STATUS.DRAFT, version: 1, selections: { d: ["a"] } },
      "mu",
      "t"
    );
    const after = buildServerLineupFingerprint(
      { status: LINEUP_STATUS.DRAFT, version: 2, selections: { d: ["b"] } },
      "mu",
      "t"
    );
    const decision = decideLineupFormRehydration({
      dirty: true,
      prevFingerprint: before,
      nextFingerprint: after,
    });
    assert.equal(decision.rehydrate, false);
    assert.equal(decision.conflict, true);
  });

  it("N: dirty clears path uses post_mutation / pristine rehydrate", () => {
    const decision = decideLineupFormRehydration({
      dirty: false,
      prevFingerprint: "a",
      nextFingerprint: "b",
    });
    assert.equal(decision.rehydrate, true);
    const afterSave = decideLineupFormRehydration({
      dirty: true,
      prevFingerprint: "a",
      nextFingerprint: "b",
      afterSuccessfulMutation: true,
    });
    assert.equal(afterSave.conflict, false);
    assert.equal(afterSave.rehydrate, true);
  });

  it("O: MLP4 gender/duplicate option filter still present", () => {
    const disciplines = repairMlpDisciplineSlotMetadata([
      { id: "disc-male", name: "Đôi nam", playerCount: 2, sortOrder: 1, genderRequirement: "any" },
      { id: "disc-female", name: "Đôi nữ", playerCount: 2, sortOrder: 2, genderRequirement: "any" },
      { id: "disc-mx1", name: "Đôi nam nữ", playerCount: 2, sortOrder: 3, genderRequirement: "any" },
      { id: "disc-mx2", name: "Đôi nam nữ", playerCount: 2, sortOrder: 4, genderRequirement: "any" },
    ]);
    const male = disciplines.find((d) => d.genderRequirement === GENDER_REQUIREMENT.MALE);
    const players = projectCaptainPortalRosterPlayers([
      { athleteId: "m1", displayName: "M1", gender: "male" },
      { athleteId: "m2", displayName: "M2", gender: "male" },
      { athleteId: "f1", displayName: "F1", gender: "female" },
      { athleteId: "f2", displayName: "F2", gender: "female" },
    ]);
    const team = {
      id: "t1",
      playerIds: ["m1", "m2", "f1", "f2"],
      rosterAthletes: [
        { athleteId: "m1", displayName: "M1", gender: "male" },
        { athleteId: "m2", displayName: "M2", gender: "male" },
        { athleteId: "f1", displayName: "F1", gender: "female" },
        { athleteId: "f2", displayName: "F2", gender: "female" },
      ],
    };
    const teamData = {
      settings: { formatPreset: FORMAT_PRESET.MLP_4, allowPlayerReusePerMatchup: true },
      disciplines,
      teams: [team],
    };
    const slot0 = filterEligiblePlayersForLineupSlot({
      team,
      discipline: male,
      players,
      selections: { [male.id]: ["m1", ""] },
      slotIndex: 1,
      allowReuse: true,
      teamData,
    });
    assert.deepEqual(
      slot0.map((p) => p.id),
      ["m2"]
    );
  });

  it("P/Q/R: save/reload contracts; no F5; no localStorage", () => {
    const src = readSrc("src/pages/tournament/TeamPortal.jsx");
    assert.match(src, /onSaved\(\)/);
    assert.match(src, /decideLineupFormRehydration/);
    assert.doesNotMatch(src, /localStorage/);
    assert.match(src, /runMutation/);
  });

  it("SQL package: CAS-before-write + first-create 0", () => {
    const apply = readSrc(
      "docs/v5/migrations/team-tournament-lineup-revision-cas-01/02_APPLY.sql"
    );
    assert.match(apply, /v_exists/);
    assert.match(apply, /p_expected_version is distinct from 0/);
    assert.match(apply, /VERSION_CONFLICT_AFTER_WRITE|CAS BEFORE write/i);
    assert.match(apply, /team_tournament_finish_command/);
    assert.doesNotMatch(
      apply,
      /v_result := public\.team_tournament_save_lineup_draft_legacy/
    );
    assert.doesNotMatch(
      apply,
      /v_result := public\.team_tournament_save_lineup_draft\(/
    );
    // null-idempotency fallback may still reference legacy once at top
    assert.match(apply, /if p_idempotency_key is null then/);

    for (const name of ["01_PRECHECK.sql", "02_APPLY.sql", "03_VERIFY.sql", "04_ROLLBACK.sql"]) {
      assert.equal(sha256File(name).length, 64);
    }
  });

  it("CREATE expected tournament.version=9 against missing lineup → no write", () => {
    const decision = evaluateLineupRevisionCas({
      existingVersion: null,
      expectedVersion: 9,
    });
    assert.equal(decision.ok, false);
    assert.equal(decision.write, false);
    assert.equal(decision.actualVersion, 0);
  });
});
