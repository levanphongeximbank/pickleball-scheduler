#!/usr/bin/env node
/**
 * Smoke verify Phase 29 VPR — local store + optional Supabase RPC probe.
 */
import { flattenDefaultPointConfig } from "../src/features/vpr-ranking/constants/defaultPointConfig.js";
import { calculateVprPoints } from "../src/features/vpr-ranking/engines/vprCalculationEngine.js";
import { resetVprLocalStoreForTests, getVprPointConfig } from "../src/features/vpr-ranking/storage/vprLocalStore.js";

const errors = [];

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

resetVprLocalStoreForTests();
const config = getVprPointConfig();
assert(config?.champion?.vpt_250 === 250, "Default point config seed missing vpt_250 champion");
assert(
  calculateVprPoints({ tournamentLevel: "vpt_250", placement: "champion" }) === 250,
  "calculateVprPoints champion vpt_250"
);
assert(flattenDefaultPointConfig().length === 36, "Expected 36 default config rows");

if (errors.length) {
  console.error("Phase 29 verify FAILED:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(1);
}

console.log("Phase 29 local verify OK (" + flattenDefaultPointConfig().length + " config rows)");
