/**
 * CORE-09 Phase 1C — deterministic circle-method (Berger) round-robin pairings.
 * No Math.random / Date.now / localeCompare. Pure structural transform.
 */

/**
 * @typedef {{ participantId: string, placementRef: string }} RrParticipant
 */

/**
 * @typedef {{
 *   participantId: string|null,
 *   placementRef: string|null,
 *   isVirtualBye: boolean,
 * }} CircleSlot
 */

/**
 * @typedef {{
 *   slotA: CircleSlot,
 *   slotB: CircleSlot,
 *   isBye: boolean,
 * }} CirclePairing
 */

/**
 * @typedef {{
 *   roundIndex: number,
 *   pairings: ReadonlyArray<CirclePairing>,
 * }} CircleRound
 */

/**
 * Canonical circle-method single-leg pairings.
 *
 * Even N: rounds = N - 1, matches/round = N / 2.
 * Odd N: one virtual bye slot; rounds = N; active matches/round = (N - 1) / 2.
 * Virtual bye never appears as a played participant — pairings involving it
 * are marked isBye=true for bye-slot representation upstream.
 *
 * A/B balancing: deterministic swap by (roundIndex + pairIndex) % 2 so no
 * participant is permanently stuck on one side across the leg.
 *
 * @param {ReadonlyArray<RrParticipant>} participants Ordered Draw placement order.
 * @returns {ReadonlyArray<CircleRound>}
 */
export function generateCircleRoundRobinPairings(participants) {
  const list = Array.isArray(participants) ? participants : [];
  const n = list.length;
  if (n < 2) {
    return Object.freeze([]);
  }

  /** @type {CircleSlot[]} */
  const slots = list.map((p) =>
    Object.freeze({
      participantId: String(p.participantId),
      placementRef: String(p.placementRef),
      isVirtualBye: false,
    })
  );

  if (n % 2 === 1) {
    slots.push(
      Object.freeze({
        participantId: null,
        placementRef: null,
        isVirtualBye: true,
      })
    );
  }

  const m = slots.length;
  const roundCount = m - 1;
  const half = m / 2;

  /** @type {number[]} */
  let circle = [];
  for (let i = 0; i < m; i += 1) circle.push(i);

  /** @type {CircleRound[]} */
  const rounds = [];

  for (let r = 0; r < roundCount; r += 1) {
    /** @type {CirclePairing[]} */
    const pairings = [];
    for (let i = 0; i < half; i += 1) {
      const left = slots[circle[i]];
      const right = slots[circle[m - 1 - i]];
      const swap = (r + i) % 2 === 1;
      const slotA = swap ? right : left;
      const slotB = swap ? left : right;
      const isBye = slotA.isVirtualBye === true || slotB.isVirtualBye === true;
      pairings.push(
        Object.freeze({
          slotA,
          slotB,
          isBye,
        })
      );
    }
    rounds.push(
      Object.freeze({
        roundIndex: r,
        pairings: Object.freeze(pairings),
      })
    );

    // Keep index 0 fixed; rotate remaining clockwise by one.
    const fixed = circle[0];
    const moving = circle.slice(1);
    const last = moving[moving.length - 1];
    const head = moving.slice(0, moving.length - 1);
    circle = [fixed, last, ...head];
  }

  return Object.freeze(rounds);
}

/**
 * Expected played-match count for a single round-robin leg.
 * @param {number} participantCount
 * @returns {number}
 */
export function expectedSingleRoundRobinPlayedMatches(participantCount) {
  const n = participantCount;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 2) return 0;
  return (n * (n - 1)) / 2;
}

/**
 * Expected round count for a single round-robin leg.
 * @param {number} participantCount
 * @returns {number}
 */
export function expectedSingleRoundRobinRounds(participantCount) {
  const n = participantCount;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 2) return 0;
  return n % 2 === 0 ? n - 1 : n;
}
