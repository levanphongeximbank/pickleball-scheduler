/**
 * Seeded RNG boundary for competition-optimizer.
 * Reuses private-pairing Mulberry32 — never ambient randomness on optimizer paths.
 */
export {
  createSeededRng,
  hashSeed,
  seededShuffle,
} from "../../private-pairing-rules/runtime/seededRng.js";
