/**
 * Remediation 10 — PURE optimistic submitPoint projection.
 * Side-loaded via E2E-04 (no new unit-test-files.json row).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { deriveOptimisticSubmitPointView } from "../src/features/referee-production-ui/projection/deriveOptimisticSubmitPointView.js";
import { projectCanonicalCourtView } from "../src/features/referee-production-ui/projection/projectCanonicalCourtView.js";
import { buildRefereeMatchView } from "../src/features/referee-production-ui/projection/buildRefereeMatchView.js";
import {
  SCORING_SYSTEM,
  createScoringFormat,
} from "../src/features/competition-core/scoring/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const SIDE_OUT = createScoringFormat({
  scoringSystem: SCORING_SYSTEM.SIDE_OUT,
  pointsToWin: 11,
  winBy: 2,
  bestOfGames: 3,
  sideSwitchAt: 6,
  metadata: { changeEndPolicyLabel: "Tại 6" },
});

const RALLY = createScoringFormat({
  scoringSystem: SCORING_SYSTEM.RALLY,
  pointsToWin: 21,
  winBy: 2,
  bestOfGames: 1,
  sideSwitchAt: 11,
});

const NAMES = { p1: "An", p2: "Bình", p3: "Chi", p4: "Dũng" };

function fixtureView({ system = RALLY, a = 5, b = 3, sideChangeRequired = false } = {}) {
  const court = projectCanonicalCourtView({
    participants: {
      sides: [
        { sideKey: "A", participantIds: ["p1", "p2"], displayName: "Đội A" },
        { sideKey: "B", participantIds: ["p3", "p4"], displayName: "Đội B" },
      ],
    },
    participantNames: NAMES,
    scoringRules: system,
    currentScore: {
      points: { SIDE_A: a, SIDE_B: b },
      serve: {
        servingSide: "SIDE_A",
        serverNumber: system.scoringSystem === SCORING_SYSTEM.SIDE_OUT ? 2 : 1,
        serverPlayerId: "p1",
        receiverPlayerId: "p4",
      },
      currentGameIndex: 0,
    },
    courtState: {
      serverPlayerId: "p1",
      receiverPlayerId: "p4",
      servingSide: "SIDE_A",
      serverNumber: system.scoringSystem === SCORING_SYSTEM.SIDE_OUT ? 2 : 1,
      playerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
      homePlayerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
      lineupConfigured: true,
      sideChangeRequired,
      sideChangeThreshold: system.sideSwitchAt ?? null,
      courtOrientation: "STANDARD",
    },
    lifecyclePolicy: { changeEndPolicyLabel: "Tại ngưỡng" },
  });

  const built = buildRefereeMatchView({
    matchId: "m-opt",
    competitionMode: "TEAM",
    competitionContext: { competitionName: "Opt", competitionId: "c1" },
    matchContext: { stage: "KO", round: 1, courtLabel: "Sân 1", status: "IN_PROGRESS" },
    participants: {
      sides: [
        { sideKey: "A", participantIds: ["p1", "p2"], displayName: "Đội A" },
        { sideKey: "B", participantIds: ["p3", "p4"], displayName: "Đội B" },
      ],
    },
    participantNames: NAMES,
    scoringRules: system,
    lifecyclePolicy: { changeEndPolicyLabel: "Tại ngưỡng" },
    capabilities: { changeEnds: true, switchPositions: true, scoring: true },
    expectedVersion: 7,
    assignedMatch: {
      lifecycleState: "IN_PROGRESS",
      scoreProjection: {
        points: { SIDE_A: a, SIDE_B: b },
        serve: { servingSide: "SIDE_A", serverNumber: 1, serverPlayerId: "p1" },
        gamesWonInCurrentSet: { SIDE_A: 0, SIDE_B: 0 },
        currentGameIndex: 0,
        completedGames: [],
        format: system,
      },
      match: {
        court: {
          serverPlayerId: "p1",
          receiverPlayerId: "p4",
          playerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
          homePlayerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
          lineupConfigured: true,
          sideChangeRequired,
          sideChangeThreshold: system.sideSwitchAt ?? null,
        },
      },
    },
  });

  return {
    ...built,
    courtProjection: court,
    expectedVersion: 7,
    diagnostics: { expectedVersion: 7 },
  };
}

test("remediation10: submitPoint optimistic presentation bumps Rally score", () => {
  const auth = fixtureView({ system: RALLY, a: 5, b: 3 });
  const opt = deriveOptimisticSubmitPointView(auth, "SIDE_A");
  assert.ok(opt);
  assert.equal(opt.isOptimisticPresentation, true);
  assert.equal(opt.currentScore.points.SIDE_A, 6);
  assert.equal(opt.currentScore.points.SIDE_B, 3);
  assert.equal(opt.courtPresentation.leftScore, 6);
});

test("remediation10: authoritativeView version unchanged; optimistic is non-authoritative", () => {
  const auth = fixtureView({ system: RALLY, a: 5, b: 3 });
  const opt = deriveOptimisticSubmitPointView(auth, "SIDE_B");
  assert.equal(auth.expectedVersion, 7);
  assert.equal(opt.expectedVersion, 7);
  assert.equal(opt.diagnostics.expectedVersion, 7);
  assert.notEqual(opt.currentScore.points.SIDE_B, auth.currentScore.points.SIDE_B);
  assert.equal(auth.currentScore.points.SIDE_B, 3);
});

test("remediation10: Rally optimistic score + serve side to winner", () => {
  const auth = fixtureView({ system: RALLY, a: 5, b: 3 });
  const opt = deriveOptimisticSubmitPointView(auth, "SIDE_B");
  assert.equal(opt.currentScore.points.SIDE_B, 4);
  assert.equal(opt.servingSideNow, "SIDE_B");
  assert.equal(opt.optimisticAwardedPoint, true);
});

test("remediation10: Side-Out does not create second scoring authority", () => {
  const auth = fixtureView({ system: SIDE_OUT, a: 4, b: 2 });
  assert.equal(auth.servingSideNow, "SIDE_A");
  const serveWin = deriveOptimisticSubmitPointView(auth, "SIDE_A");
  assert.equal(serveWin.currentScore.points.SIDE_A, 5);
  assert.equal(serveWin.optimisticAwardedPoint, true);

  const recvWin = deriveOptimisticSubmitPointView(auth, "SIDE_B");
  assert.equal(recvWin.currentScore.points.SIDE_A, 4);
  assert.equal(recvWin.currentScore.points.SIDE_B, 2);
  assert.equal(recvWin.optimisticAwardedPoint, false);
  assert.equal(recvWin.servingSideNow, "SIDE_A");
});

test("remediation10: change-end optimistic warning blocks confirm before ACK", () => {
  const auth = fixtureView({ system: RALLY, a: 10, b: 3 });
  const opt = deriveOptimisticSubmitPointView(auth, "SIDE_A");
  assert.equal(opt.optimisticChangeEndDue, true);
  assert.equal(opt.courtProjection.sideChangeRequired, true);
  assert.equal(opt.changeEndConfirmBlocked, true);
  assert.equal(opt.canChangeEnds, false);
});

test("remediation10: confirmChangeEnds remains ACK-before-swap; no storage persistence", () => {
  const hook = readFileSync(
    path.join(root, "src/features/referee-production-ui/hooks/useCanonicalRefereeMatch.js"),
    "utf8"
  );
  const screen = readFileSync(
    path.join(root, "src/features/referee-production-ui/components/RefereeMatchScreen.jsx"),
    "utf8"
  );
  const deriveSrc = readFileSync(
    path.join(
      root,
      "src/features/referee-production-ui/projection/deriveOptimisticSubmitPointView.js"
    ),
    "utf8"
  );
  assert.match(hook, /confirmChangeEnds:\s*\(\)\s*=>\s*run\("change-ends"/);
  assert.match(hook, /expectedVersion:\s*extra\.expectedVersion\s*\?\?\s*auth\?\.expectedVersion/);
  assert.match(hook, /matchId, actor\?\.actorId/);
  assert.match(hook, /if \(!actor\)/);
  assert.match(hook, /clearOptimistic/);
  assert.doesNotMatch(hook, /localStorage|sessionStorage/);
  assert.doesNotMatch(deriveSrc, /localStorage|sessionStorage/);
  assert.match(screen, /changeEndConfirmBlocked/);
  assert.match(screen, /Đang chờ máy chủ xác nhận/);
});

test("remediation10: pure derive does not mutate authoritative view", () => {
  const auth = fixtureView({ system: RALLY, a: 5, b: 3 });
  const before = JSON.stringify(auth.currentScore.points);
  deriveOptimisticSubmitPointView(auth, "SIDE_A");
  assert.equal(JSON.stringify(auth.currentScore.points), before);
});
