/**
 * Remediation 10 — optimistic match hook: ACK replace / CAS / network rollback.
 */
import { describe, expect, it, vi } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import React from "react";

import { useCanonicalRefereeMatch } from "../../src/features/referee-production-ui/hooks/useCanonicalRefereeMatch.js";
import { projectCanonicalCourtView } from "../../src/features/referee-production-ui/projection/projectCanonicalCourtView.js";
import { buildRefereeMatchView } from "../../src/features/referee-production-ui/projection/buildRefereeMatchView.js";
import {
  SCORING_SYSTEM,
  createScoringFormat,
} from "../../src/features/competition-core/scoring/index.js";
import { REFEREE_ADAPTER_ERROR_CODE } from "../../src/features/competition-engine/integration/referee/constants.js";

const RALLY = createScoringFormat({
  scoringSystem: SCORING_SYSTEM.RALLY,
  pointsToWin: 21,
  winBy: 2,
  bestOfGames: 1,
  sideSwitchAt: 11,
});

const NAMES = { p1: "An", p2: "Bình", p3: "Chi", p4: "Dũng" };

function fixtureView({ a = 5, b = 3 } = {}) {
  const court = projectCanonicalCourtView({
    participants: {
      sides: [
        { sideKey: "A", participantIds: ["p1", "p2"], displayName: "Đội A" },
        { sideKey: "B", participantIds: ["p3", "p4"], displayName: "Đội B" },
      ],
    },
    participantNames: NAMES,
    scoringRules: RALLY,
    currentScore: {
      points: { SIDE_A: a, SIDE_B: b },
      serve: { servingSide: "SIDE_A", serverNumber: 1, serverPlayerId: "p1" },
      currentGameIndex: 0,
    },
    courtState: {
      serverPlayerId: "p1",
      servingSide: "SIDE_A",
      playerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
      homePlayerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
      lineupConfigured: true,
      sideChangeThreshold: 11,
    },
  });
  const built = buildRefereeMatchView({
    matchId: "m-opt",
    competitionMode: "TEAM",
    competitionContext: { competitionName: "Opt", competitionId: "c1" },
    matchContext: { status: "IN_PROGRESS", courtLabel: "Sân 1" },
    participants: {
      sides: [
        { sideKey: "A", participantIds: ["p1", "p2"], displayName: "Đội A" },
        { sideKey: "B", participantIds: ["p3", "p4"], displayName: "Đội B" },
      ],
    },
    participantNames: NAMES,
    scoringRules: RALLY,
    capabilities: { scoring: true, changeEnds: true },
    expectedVersion: 7,
    assignedMatch: {
      lifecycleState: "IN_PROGRESS",
      scoreProjection: {
        points: { SIDE_A: a, SIDE_B: b },
        serve: { servingSide: "SIDE_A", serverNumber: 1, serverPlayerId: "p1" },
        currentGameIndex: 0,
        format: RALLY,
      },
      match: {
        court: {
          serverPlayerId: "p1",
          playerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
          homePlayerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
          lineupConfigured: true,
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

function mountHook(client, { matchId = "m-opt", actor = { actorId: "u1", authUid: "u1", role: "REFEREE" } } = {}) {
  let api;
  function Probe(props) {
    api = useCanonicalRefereeMatch({
      client,
      matchId: props.matchId,
      tenantId: "t1",
      actor: props.actor,
      competitionId: "c1",
      competitionMode: "TEAM",
    });
    return null;
  }
  const utils = render(React.createElement(Probe, { matchId, actor }));
  return {
    get api() {
      return api;
    },
    rerender: (next) => utils.rerender(React.createElement(Probe, next)),
  };
}

describe("remediation10 optimistic hook", () => {
  it("optimistic immediate; authoritative unchanged; duplicate blocked; ACK; CAS/network rollback", async () => {
    const authView = fixtureView({ a: 5, b: 3 });
    const ackView = {
      ...authView,
      expectedVersion: 8,
      diagnostics: { expectedVersion: 8 },
      currentScore: {
        ...authView.currentScore,
        points: { SIDE_A: 6, SIDE_B: 3 },
      },
    };

    const resolvers = [];
    const client = {
      getMatchView: vi.fn(async () => ({ view: authView })),
      submitPoint: vi.fn(
        (cmd) =>
          new Promise((resolve) => {
            resolvers.push({ resolve, cmd });
          })
      ),
      startMatch: vi.fn(async () => ({ view: authView })),
      suspendMatch: vi.fn(async () => ({ view: authView })),
      resumeMatch: vi.fn(async () => ({ view: authView })),
      confirmChangeEnds: vi.fn(async () => ({ view: authView })),
      switchPositions: vi.fn(async () => ({ view: authView })),
      configureLineup: vi.fn(async () => ({ view: authView })),
      submitResult: vi.fn(async () => ({ view: authView })),
      correctResult: vi.fn(async () => ({ view: authView })),
    };

    const mounted = mountHook(client);
    await waitFor(() => expect(mounted.api.authoritativeView).toBeTruthy());

    let firstPromise;
    await act(async () => {
      firstPromise = mounted.api.submitPoint("SIDE_A");
    });
    await waitFor(() => expect(mounted.api.optimisticView).toBeTruthy());
    expect(mounted.api.authoritativeView.currentScore.points.SIDE_A).toBe(5);
    expect(mounted.api.view.currentScore.points.SIDE_A).toBe(6);
    expect(mounted.api.pendingCommand).toBe("point:SIDE_A");
    expect(resolvers[0].cmd.expectedVersion).toBe(7);

    const blocked = await mounted.api.submitPoint("SIDE_B");
    expect(blocked.duplicateBlocked).toBe(true);

    await act(async () => {
      resolvers[0].resolve({ ok: true, view: ackView });
      await firstPromise;
    });
    await waitFor(() => expect(mounted.api.optimisticView).toBeNull());
    expect(mounted.api.authoritativeView.expectedVersion).toBe(8);
    expect(mounted.api.view.currentScore.points.SIDE_A).toBe(6);

    let stalePromise;
    await act(async () => {
      stalePromise = mounted.api.submitPoint("SIDE_A");
    });
    await waitFor(() => expect(mounted.api.optimisticView).toBeTruthy());
    const authBefore = mounted.api.authoritativeView;
    await act(async () => {
      resolvers[1].resolve({
        ok: false,
        stale: true,
        code: REFEREE_ADAPTER_ERROR_CODE.STALE_WRITE,
        view: authBefore,
      });
      await stalePromise;
    });
    await waitFor(() => expect(mounted.api.optimisticView).toBeNull());
    expect(mounted.api.authoritativeView).toBe(authBefore);
    expect(String(mounted.api.error || "")).toMatch(/Trạng thái trận đã thay đổi|thử lại/);

    let rejectNet;
    client.submitPoint.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectNet = reject;
        })
    );
    let netPromise;
    await act(async () => {
      netPromise = mounted.api.submitPoint("SIDE_B");
    });
    await waitFor(() => expect(mounted.api.optimisticView).toBeTruthy());
    await act(async () => {
      rejectNet(new Error("Failed to fetch"));
      await netPromise;
    });
    await waitFor(() => expect(mounted.api.optimisticView).toBeNull());
    expect(String(mounted.api.error || "")).toMatch(/Không thể xác nhận điểm/);
  }, 15000);

  it("clears optimistic on matchId change (route) and actor logout", async () => {
    const authView = fixtureView();
    const resolvers = [];
    const client = {
      getMatchView: vi.fn(async () => ({ view: authView })),
      submitPoint: vi.fn(
        () =>
          new Promise((resolve) => {
            resolvers.push(resolve);
          })
      ),
      startMatch: vi.fn(),
      suspendMatch: vi.fn(),
      resumeMatch: vi.fn(),
      confirmChangeEnds: vi.fn(),
      switchPositions: vi.fn(),
      configureLineup: vi.fn(),
      submitResult: vi.fn(),
      correctResult: vi.fn(),
    };

    const actor = { actorId: "u1", authUid: "u1", role: "REFEREE" };
    const mounted = mountHook(client, { matchId: "m1", actor });
    await waitFor(() => expect(mounted.api.authoritativeView).toBeTruthy());

    await act(async () => {
      mounted.api.submitPoint("SIDE_A");
    });
    await waitFor(() => expect(mounted.api.optimisticView).toBeTruthy());

    await act(async () => {
      mounted.rerender({ matchId: "m2", actor });
    });
    await waitFor(() => expect(mounted.api.optimisticView).toBeNull());
    await waitFor(() => expect(mounted.api.authoritativeView).toBeTruthy());

    await act(async () => {
      mounted.api.submitPoint("SIDE_A");
    });
    await waitFor(() => expect(mounted.api.optimisticView).toBeTruthy());

    await act(async () => {
      mounted.rerender({ matchId: "m2", actor: null });
    });
    await waitFor(() => expect(mounted.api.optimisticView).toBeNull());

    await act(async () => {
      for (const resolve of resolvers) {
        resolve({ ok: true, view: authView });
      }
    });
  }, 15000);
});
