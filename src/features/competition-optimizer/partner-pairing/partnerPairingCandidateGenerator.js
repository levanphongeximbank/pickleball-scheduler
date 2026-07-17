import { generateTeamPairingCandidates } from "../../private-pairing-rules/runtime/generateTeamCandidates.js";
import { createSeededRng, seededShuffle } from "../core/seededRandom.js";

/**
 * Seeded initial population around the established private-pairing generator.
 */
export function generatePartnerPairingInitialCandidates(input = {}) {
  const maxCandidates = Math.max(1, Number(input.maxCandidates) || 128);
  const seed = input.randomSeed ?? input.seed ?? 1;
  const baseline = generateTeamPairingCandidates({
    ...input,
    seed,
    maxCandidates,
    maxIterations: Math.max(maxCandidates, Number(input.maxIterations) || maxCandidates * 2),
  });
  const unique = new Map();
  const add = (candidate, strategy) => {
    const signature = (candidate.teams || [])
      .map((team) => [...(team.playerIds || [])].map(String).sort().join("+"))
      .sort()
      .join("|");
    if (signature && !unique.has(signature)) {
      unique.set(signature, { ...candidate, strategy });
    }
  };
  baseline.candidates.forEach((candidate, index) => add(candidate, index ? "seeded_baseline" : "baseline"));

  const rng = createSeededRng(`${seed}:variants`);
  const players = Array.isArray(input.players) ? input.players : [];
  for (let index = unique.size; index < maxCandidates; index += 1) {
    const variant = generateTeamPairingCandidates({
      ...input,
      players: seededShuffle(players, rng),
      seed: `${seed}:variant:${index}`,
      maxCandidates: 1,
      maxIterations: 2,
    });
    variant.candidates.forEach((candidate) => add(candidate, `seeded_variant_${index}`));
  }
  return [...unique.values()].slice(0, maxCandidates);
}
