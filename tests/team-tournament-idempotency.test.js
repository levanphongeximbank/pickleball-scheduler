import test from "node:test";
import assert from "node:assert/strict";

import {
  hashTeamTournamentPayload,
  resolveIdempotencyReplay,
} from "../src/features/team-tournament/repositories/teamTournamentIdempotency.js";

test("idempotency: same key same payload replays stored result", () => {
  const payload = { matchupId: "m1", teamId: "t1", selections: { d1: ["p1"] } };
  const hash = hashTeamTournamentPayload(payload);
  const stored = {
    payloadHash: hash,
    result: { ok: true, version: 2 },
  };

  const resolution = resolveIdempotencyReplay(
    { idempotencyKey: "key-1", payload },
    stored
  );

  assert.equal(resolution.action, "replay");
  assert.deepEqual(resolution.result, { ok: true, version: 2 });
});

test("idempotency: same key different payload rejects", () => {
  const hash = hashTeamTournamentPayload({ a: 1 });
  const resolution = resolveIdempotencyReplay(
    { idempotencyKey: "key-1", payload: { a: 2 } },
    { payloadHash: hash, result: { ok: true } }
  );

  assert.equal(resolution.action, "reject");
  assert.equal(resolution.code, "idempotency_payload_mismatch");
});

test("idempotency: no key always executes", () => {
  const resolution = resolveIdempotencyReplay({ payload: { x: 1 } }, null);
  assert.equal(resolution.action, "execute");
});

test("idempotency: hash is stable for key order", () => {
  const h1 = hashTeamTournamentPayload({ b: 2, a: 1 });
  const h2 = hashTeamTournamentPayload({ a: 1, b: 2 });
  assert.equal(h1, h2);
});

test("idempotency: nested object key order is canonicalized", () => {
  const h1 = hashTeamTournamentPayload({
    matchupId: "m1",
    selections: { "disc-women": ["p4", "p5"], "disc-men": ["p1", "p2"] },
  });
  const h2 = hashTeamTournamentPayload({
    selections: { "disc-men": ["p1", "p2"], "disc-women": ["p4", "p5"] },
    matchupId: "m1",
  });
  assert.equal(h1, h2);
});

test("idempotency: array order changes the hash", () => {
  const h1 = hashTeamTournamentPayload({ players: ["p1", "p2"] });
  const h2 = hashTeamTournamentPayload({ players: ["p2", "p1"] });
  assert.notEqual(h1, h2);
});

test("idempotency: null boolean and number hash stably", () => {
  const payload = { flag: true, count: 3, note: null, nested: { ok: false, qty: 0 } };
  const h1 = hashTeamTournamentPayload(payload);
  const h2 = hashTeamTournamentPayload({
    nested: { qty: 0, ok: false },
    note: null,
    count: 3,
    flag: true,
  });
  assert.equal(h1, h2);
  assert.match(h1, /^[a-f0-9]{64}$/);
});

test("idempotency: key-order-only payload replays not mismatch", () => {
  const storedPayload = {
    teamId: "t1",
    matchupId: "m1",
    selections: { d1: ["p1", "p2"] },
  };
  const replayPayload = {
    selections: { d1: ["p1", "p2"] },
    matchupId: "m1",
    teamId: "t1",
  };

  const stored = {
    payloadHash: hashTeamTournamentPayload(storedPayload),
    result: { ok: true, version: 4 },
  };

  const resolution = resolveIdempotencyReplay(
    { idempotencyKey: "canonical-key", payload: replayPayload },
    stored
  );

  assert.equal(resolution.action, "replay");
  assert.notEqual(resolution.code, "idempotency_payload_mismatch");
  assert.deepEqual(resolution.result, { ok: true, version: 4 });
});
