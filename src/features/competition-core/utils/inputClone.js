/**
 * Shallow-clone engine input without mutating caller-owned objects.
 *
 * @typedef {import('../types/index.js').CompetitionEngineInput} CompetitionEngineInput
 * @param {CompetitionEngineInput} input
 * @returns {CompetitionEngineInput}
 */
export function cloneCompetitionEngineInput(input) {
  return {
    engineType: input.engineType,
    tournamentId: input.tournamentId,
    clubId: input.clubId,
    eventId: input.eventId,
    draw: input.draw ? { ...input.draw } : undefined,
    payload: input.payload ? { ...input.payload } : undefined,
    constraints: Array.isArray(input.constraints)
      ? input.constraints.map((item) => ({
          ...item,
          params: item.params ? { ...item.params } : undefined,
        }))
      : undefined,
    metadata: input.metadata ? { ...input.metadata } : undefined,
  };
}

/**
 * Compare business payload references — adapter must not rewrite payload keys.
 * @param {Record<string, unknown>|undefined} before
 * @param {Record<string, unknown>|undefined} after
 * @returns {boolean}
 */
export function isBusinessPayloadPreserved(before, after) {
  if (before === after) {
    return true;
  }
  if (!before || !after) {
    return before === after;
  }

  const beforeKeys = Object.keys(before).sort();
  const afterKeys = Object.keys(after).sort();
  if (beforeKeys.length !== afterKeys.length) {
    return false;
  }

  return beforeKeys.every((key, index) => key === afterKeys[index] && before[key] === after[key]);
}
