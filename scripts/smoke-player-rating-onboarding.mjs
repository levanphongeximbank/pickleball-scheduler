/**
 * Smoke test — Player Rating Assessment onboarding (local, no browser).
 * Run: node scripts/smoke-player-rating-onboarding.mjs
 */

import assert from "node:assert/strict";

import { calculatePlayerAssessment } from "../src/features/player-rating/playerSkillAssessmentEngine.js";
import { completePickVnOnboarding, getPickVnRatingByAuthUserId, needsPickVnOnboarding } from "../src/features/pick-vn-rating/services/pickVnRatingService.js";
import { resetPickVnRatingLocalStoreForTests } from "../src/features/pick-vn-rating/storage/pickVnRatingLocalStore.js";
import { resetPlayerRatingAssessmentStoreForTests } from "../src/features/player-rating/playerRatingAssessmentLocalStore.js";
import { getPlayerAssessmentByAuthUserId } from "../src/features/player-rating/playerRatingAssessmentLocalStore.js";

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

globalThis.localStorage = createLocalStorageMock();
resetPickVnRatingLocalStoreForTests();
resetPlayerRatingAssessmentStoreForTests();

const authUserId = "smoke-test-player-1";

const sampleAnswers = {
  gender: "male",
  birth_year: 1992,
  playing_duration: "1_3yr",
  sessions_per_week: "3",
  has_coach: "yes",
  tournament_level: "club_internal",
  best_result: "quarter",
  was_seed: "no",
  prior_sports: ["badminton"],
  prior_sport_level: "club",
  rally_consistency: "pct_80",
  return_stability: "pct_50",
  dink_ability: "10",
  volley_ability: "basic",
  third_shot_drop: "stable",
  reset_ability: "basic",
  play_style: "all_around",
  kitchen_frequency: "often",
  stacking_knowledge: "know",
  nvz_transition: "basic",
  team_coordination: "medium",
  pace_control: "basic",
  doubles_positioning: "none",
  self_rating: "3.5",
};

console.log("=== Player Rating Assessment — Smoke Test ===\n");

const preview = calculatePlayerAssessment({ answers: sampleAnswers, hasClub: false });
assert.equal(preview.ok, true);

console.log("Kết quả tính thử (bước 7):");
console.log(`  Rating tạm tính:     ${preview.provisional_rating} (thô ${preview.raw_provisional_rating} × ${preview.rating_calibration})`);
console.log(`  Assessment Score:    ${preview.assessment_score}/100`);
console.log(`  Confidence:          ${preview.rating_confidence}%`);
console.log(`  Trạng thái:          ${preview.rating_status}`);
console.log(`  Tự đánh giá:         ${preview.self_declared_rating} (không dùng làm điểm cuối)`);
console.log(`  Nhóm mạnh:           ${(preview.strengths || []).join(", ") || "—"}`);
console.log(`  Cần cải thiện:       ${(preview.weaknesses || []).join(", ") || "—"}`);
console.log(`  Cảnh báo:            ${(preview.warning_flags || []).join(", ") || "không"}`);
console.log("\n  Giải thích:");
for (const line of preview.explanation || []) {
  console.log(`    • ${line}`);
}

console.log("\n--- Lưu local ---\n");

const save = await completePickVnOnboarding(authUserId, { answers: sampleAnswers });
assert.equal(save.ok, true);

const record = getPickVnRatingByAuthUserId(authUserId);
const assessmentRow = getPlayerAssessmentByAuthUserId(authUserId);

assert.equal(needsPickVnOnboarding(authUserId), false);
assert.equal(record.currentRating, preview.provisional_rating);
assert.equal(record.assessmentScore, preview.assessment_score);

console.log("Đã lưu vào local store:");
console.log(`  pick-vn record id:   ${record.id}`);
console.log(`  assessment store:    ${assessmentRow ? "OK" : "MISSING"}`);
console.log(`  Gate onboarding:     đã hoàn tất`);

console.log("\n--- Case cảnh báo (tự khai cao) ---\n");

const warnPreview = calculatePlayerAssessment({
  answers: {
    ...sampleAnswers,
    playing_duration: "lt_3mo",
    tournament_level: "none",
    best_result: "none",
    rally_consistency: "no",
    return_stability: "no",
    dink_ability: "no",
    volley_ability: "unknown",
    third_shot_drop: "unknown",
    reset_ability: "unknown",
    kitchen_frequency: "rare",
    stacking_knowledge: "none",
    nvz_transition: "none",
    team_coordination: "low",
    pace_control: "none",
    doubles_positioning: "none",
    self_rating: "5.0plus",
  },
});

console.log(`  Tự khai 5.0+ → rating hệ thống: ${warnPreview.provisional_rating}`);
console.log(`  Trạng thái: ${warnPreview.rating_status}`);
console.log(`  Cảnh báo: ${warnPreview.warning_flags.join(", ")}`);

console.log("\n✅ Smoke test passed.\n");
console.log("Mở trình duyệt: http://localhost:5173/onboarding/pick-vn-rating");
console.log("(Nếu port khác, xem terminal npm run dev — hiện có thể là 5176/5177)");
