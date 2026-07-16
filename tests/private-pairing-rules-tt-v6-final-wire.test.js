import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTeamDrawLegacyPayload,
  wrapTeamDrawLegacyResult,
} from "../src/features/competition-core/draw/adapters/teamDrawAdapter.js";
import { buildTournamentNotFoundMessage } from "../src/features/club/services/clubTournamentBridge.js";
import {
  COMPETITION_CLASS,
  PRIVATE_PAIRING_RUNTIME_CODE,
  buildPrivatePairingRuntimeError,
} from "../src/features/private-pairing-rules/index.js";

describe("TT-V6-FINAL — UI wire helpers (no player-pool fixtures)", () => {
  it("team draw adapter payload forwards privatePairingRules + competitionClass", () => {
    const payload = buildTeamDrawLegacyPayload({
      teamData: { teams: [], groups: [] },
      players: [],
      seedingMode: "off",
      groupCount: 2,
      privatePairingRules: [{ id: "r1" }],
      competitionClass: COMPETITION_CLASS.INTERNAL,
      clubId: "club-1",
      tournamentId: "t-1",
    });

    assert.equal(payload.options.competitionClass, COMPETITION_CLASS.INTERNAL);
    assert.equal(payload.options.clubId, "club-1");
    assert.equal(payload.options.tournamentId, "t-1");
    assert.equal(payload.options.privatePairingRules.length, 1);
    assert.equal(payload.options.privatePairingRules[0].id, "r1");
  });

  it("team draw wrap does not treat existing groups as success when engine ok:false", () => {
    const wrapped = wrapTeamDrawLegacyResult({
      ok: false,
      teamData: {
        groups: [{ id: "g1", teamIds: ["t1"] }],
      },
      privatePairingError: buildPrivatePairingRuntimeError({
        errorCode: PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_GROUP_PLAN,
      }),
    });

    assert.equal(wrapped.ok, false);
    assert.equal(
      wrapped.privatePairingError?.code,
      PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_GROUP_PLAN
    );
  });

  it("maps NO_FEASIBLE_TEAM_FORMATION alias to Vietnamese message", () => {
    const err = buildPrivatePairingRuntimeError({
      errorCode: "NO_FEASIBLE_TEAM_FORMATION",
    });
    assert.equal(err.ok, false);
    assert.match(err.message, /ghép cặp\/đội|hard rules/i);
  });

  it("Internal not-found helper includes Preview / stale-id guidance", () => {
    const message = buildTournamentNotFoundMessage("old-id-123", {
      kind: "giải nội bộ",
    });
    assert.match(message, /giải nội bộ/);
    assert.match(message, /old-id-123/);
    assert.match(message, /Preview/i);
  });
});
