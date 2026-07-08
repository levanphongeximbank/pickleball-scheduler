/** Cấu hình bảng hỏi + điểm 0–100 — Player Rating Assessment V1 */

export const WARNING_FLAGS = Object.freeze({
  SELF_RATING_TOO_HIGH: "SELF_RATING_TOO_HIGH",
  HIGH_RATING_WITHOUT_TOURNAMENT_HISTORY: "HIGH_RATING_WITHOUT_TOURNAMENT_HISTORY",
  HIGH_RATING_WITH_LOW_EXPERIENCE: "HIGH_RATING_WITH_LOW_EXPERIENCE",
  TECHNICAL_SCORE_CONFLICT: "TECHNICAL_SCORE_CONFLICT",
});

export const WARNING_FLAG_LABELS = Object.freeze({
  [WARNING_FLAGS.SELF_RATING_TOO_HIGH]: "Tự đánh giá cao hơn điểm hệ thống ≥ 1.0",
  [WARNING_FLAGS.HIGH_RATING_WITHOUT_TOURNAMENT_HISTORY]:
    "Tự khai cao nhưng chưa có lịch sử giải",
  [WARNING_FLAGS.HIGH_RATING_WITH_LOW_EXPERIENCE]:
    "Tự khai cao nhưng kinh nghiệm chơi còn ít",
  [WARNING_FLAGS.TECHNICAL_SCORE_CONFLICT]: "Kỹ thuật thấp nhưng tự khai cao",
});

export const GROUP_CAPS = Object.freeze({
  profile: 20,
  tournament: 25,
  sport_background: 10,
  technique: 25,
  tactics: 15,
  self: 5,
});

/** Hệ số hiệu chuẩn rating tạm tính sau bảng hỏi (tránh khai cao hơn thực tế). */
export const PROVISIONAL_RATING_CALIBRATION = 0.8;

export const ASSESSMENT_STEPS = Object.freeze([
  { id: 1, title: "Hồ sơ", key: "profile" },
  { id: 2, title: "Thi đấu", key: "tournament" },
  { id: 3, title: "Nền tảng", key: "sport_background" },
  { id: 4, title: "Kỹ thuật", key: "technique" },
  { id: 5, title: "Chiến thuật", key: "tactics" },
  { id: 6, title: "Tự đánh giá", key: "self" },
  { id: 7, title: "Kết quả", key: "result" },
]);

export const SCORE_TO_RATING_BANDS = Object.freeze([
  { min: 0, max: 15, rating: 1.5 },
  { min: 16, max: 25, rating: 2.0 },
  { min: 26, max: 35, rating: 2.5 },
  { min: 36, max: 45, rating: 3.0 },
  { min: 46, max: 55, rating: 3.5 },
  { min: 56, max: 68, rating: 4.0 },
  { min: 69, max: 80, rating: 4.5 },
  { min: 81, max: 90, rating: 5.0 },
  { min: 91, max: 96, rating: 5.5 },
  { min: 97, max: 100, rating: 6.0 },
]);

export const PROFILE_DURATION_SCORE = Object.freeze({
  never: 0,
  lt_3mo: 4,
  "3_12mo": 8,
  "1_3yr": 14,
  gt_3yr: 20,
});

export const SESSIONS_WEEKLY_BONUS = Object.freeze({
  "1": 1,
  "2": 2,
  "3": 3,
  "4plus": 4,
  daily: 5,
});

export const COACH_BONUS = 3;

export const TOURNAMENT_LEVEL_SCORE = Object.freeze({
  none: 0,
  club_internal: 5,
  recreational: 10,
  provincial: 15,
  national: 20,
  international: 25,
});

export const BEST_RESULT_BONUS = Object.freeze({
  none: 0,
  group_stage: 1,
  quarter: 3,
  semi: 5,
  runner_up: 7,
  champion: 9,
});

export const SEED_BONUS = Object.freeze({ yes: 3, no: 0 });

export const SPORT_BASE_SCORE = Object.freeze({
  none: 0,
  table_tennis: 3,
  badminton: 4,
  squash: 4.5,
  padel: 5,
  tennis: 6,
});

/** Hệ số trình độ — nén biên để chênh lệch có/không nền tảng không quá lớn. */
export const SPORT_LEVEL_MULTIPLIER = Object.freeze({
  recreational: 0.55,
  club: 0.75,
  semi_pro: 0.9,
  pro: 1.0,
});

export const SELF_RATING_POINTS = Object.freeze({
  "1.5": 0,
  "2.0": 1,
  "2.5": 1.5,
  "3.0": 2,
  "3.5": 2.5,
  "4.0": 3,
  "4.5": 3.5,
  "5.0": 4,
  "5.0plus": 4,
  "5.5": 4.5,
  "6.0": 5,
  "6.0plus": 5,
});

export const GROUP_LABELS = Object.freeze({
  profile: "Hồ sơ & kinh nghiệm",
  tournament: "Kinh nghiệm thi đấu",
  sport_background: "Nền tảng thể thao",
  technique: "Kỹ thuật",
  tactics: "Chiến thuật",
  self: "Tự đánh giá",
});

function opt(id, label, score = 0) {
  return { id, label, score };
}

export const SKILL_ASSESSMENT_QUESTIONS = Object.freeze([
  {
    id: "gender",
    step: 1,
    label: "Giới tính của bạn?",
    type: "single",
    metadataOnly: true,
    options: [opt("male", "Nam"), opt("female", "Nữ"), opt("other", "Khác")],
  },
  {
    id: "birth_year",
    step: 1,
    label: "Năm sinh",
    type: "birth_year",
    metadataOnly: true,
  },
  {
    id: "playing_duration",
    step: 1,
    scoringGroup: "profile",
    label: "Bạn đã chơi pickleball bao lâu?",
    type: "single",
    options: [
      opt("never", "Chưa từng chơi", 0),
      opt("lt_3mo", "Dưới 3 tháng", 4),
      opt("3_12mo", "3–12 tháng", 8),
      opt("1_3yr", "1–3 năm", 14),
      opt("gt_3yr", "Trên 3 năm", 20),
    ],
  },
  {
    id: "sessions_per_week",
    step: 1,
    scoringGroup: "profile",
    label: "Bạn chơi trung bình bao nhiêu buổi/tuần?",
    type: "single",
    options: [
      opt("1", "1 buổi", 1),
      opt("2", "2 buổi", 2),
      opt("3", "3 buổi", 3),
      opt("4plus", "4+ buổi", 4),
      opt("daily", "Gần như mỗi ngày", 5),
    ],
  },
  {
    id: "has_coach",
    step: 1,
    scoringGroup: "profile",
    label: "Bạn có HLV hướng dẫn không?",
    type: "single",
    options: [opt("no", "Không", 0), opt("yes", "Có", 3)],
  },
  {
    id: "tournament_level",
    step: 2,
    scoringGroup: "tournament",
    label: "Bạn đã từng tham gia giải chưa?",
    type: "single",
    options: [
      opt("none", "Chưa", 0),
      opt("club_internal", "Nội bộ CLB", 5),
      opt("recreational", "Phong trào", 10),
      opt("provincial", "Cấp tỉnh/thành", 15),
      opt("national", "Quốc gia", 20),
      opt("international", "Quốc tế", 25),
    ],
  },
  {
    id: "best_result",
    step: 2,
    scoringGroup: "tournament",
    label: "Thành tích cao nhất",
    type: "single",
    options: [
      opt("none", "Chưa từng", 0),
      opt("group_stage", "Vòng bảng", 1),
      opt("quarter", "Tứ kết", 3),
      opt("semi", "Bán kết", 5),
      opt("runner_up", "Á quân", 7),
      opt("champion", "Vô địch", 9),
    ],
  },
  {
    id: "was_seed",
    step: 2,
    scoringGroup: "tournament",
    label: "Bạn từng là hạt giống?",
    type: "single",
    options: [opt("no", "Không", 0), opt("yes", "Có", 3)],
  },
  {
    id: "prior_sports",
    step: 3,
    scoringGroup: "sport_background",
    label: "Bạn từng chơi môn nào?",
    type: "multi",
    options: [
      opt("tennis", "Tennis", 6),
      opt("badminton", "Cầu lông", 4),
      opt("table_tennis", "Bóng bàn", 3),
      opt("squash", "Squash", 4.5),
      opt("padel", "Padel", 5),
      opt("none", "Không", 0),
    ],
  },
  {
    id: "prior_sport_level",
    step: 3,
    scoringGroup: "sport_background",
    label: "Bạn từng đạt trình độ nào?",
    type: "single",
    showWhen: (answers) => {
      const sports = answers?.prior_sports;
      return Array.isArray(sports) && sports.length && !sports.includes("none");
    },
    options: [
      opt("recreational", "Phong trào", 0.55),
      opt("club", "CLB", 0.75),
      opt("semi_pro", "Bán chuyên", 0.9),
      opt("pro", "Chuyên nghiệp", 1.0),
    ],
  },
  {
    id: "rally_consistency",
    step: 4,
    uiGroup: "Giao bóng & rally",
    scoringGroup: "technique",
    label: "Giao bóng / rally ổn định",
    type: "single",
    options: [
      opt("no", "Không", 0),
      opt("pct_50", "Khoảng 50%", 1),
      opt("pct_80", "Khoảng 80%", 2),
      opt("near_perfect", "Gần như không lỗi", 3),
    ],
  },
  {
    id: "return_stability",
    step: 4,
    uiGroup: "Giao bóng & rally",
    scoringGroup: "technique",
    label: "Return ổn định",
    type: "single",
    options: [
      opt("no", "Không", 0),
      opt("pct_50", "Khoảng 50%", 1),
      opt("pct_80", "Khoảng 80%", 2),
      opt("near_perfect", "Gần như không lỗi", 3),
    ],
  },
  {
    id: "dink_ability",
    step: 4,
    uiGroup: "Kitchen & volley",
    scoringGroup: "technique",
    label: "Dink liên tục",
    type: "single",
    options: [
      opt("no", "Không", 0),
      opt("5", "5 lần", 1),
      opt("10", "10 lần", 2),
      opt("20plus", "Trên 20 lần", 3),
    ],
  },
  {
    id: "volley_ability",
    step: 4,
    uiGroup: "Kitchen & volley",
    scoringGroup: "technique",
    label: "Volley",
    type: "single",
    options: [
      opt("unknown", "Chưa biết", 0),
      opt("basic", "Biết sơ", 1),
      opt("stable", "Ổn định", 2),
      opt("mastered", "Thành thạo", 3),
    ],
  },
  {
    id: "third_shot_drop",
    step: 4,
    uiGroup: "Cú bóng",
    scoringGroup: "technique",
    label: "Third Shot Drop",
    type: "single",
    options: [
      opt("unknown", "Chưa biết", 0),
      opt("unstable", "Biết nhưng chưa ổn định", 1),
      opt("stable", "Ổn định", 2),
      opt("mastered", "Thành thạo", 3),
    ],
  },
  {
    id: "reset_ability",
    step: 4,
    uiGroup: "Cú bóng",
    scoringGroup: "technique",
    label: "Reset",
    type: "single",
    options: [
      opt("unknown", "Chưa biết", 0),
      opt("basic", "Biết sơ", 1),
      opt("stable", "Ổn định", 2),
      opt("mastered", "Thành thạo", 3),
    ],
  },
  {
    id: "play_style",
    step: 4,
    uiGroup: "Phong cách",
    scoringGroup: "technique",
    label: "Phong cách chơi",
    type: "single",
    metadataOnly: true,
    optionalBonus: { all_around: 1 },
    options: [
      opt("control", "Control", 0),
      opt("power", "Power", 0),
      opt("all_around", "All-around", 1),
    ],
  },
  {
    id: "kitchen_frequency",
    step: 4,
    uiGroup: "Kitchen & volley",
    scoringGroup: "technique",
    label: "Lên Kitchen / NVZ",
    type: "single",
    options: [
      opt("rare", "Hiếm", 0),
      opt("sometimes", "Thỉnh thoảng", 1),
      opt("often", "Thường xuyên", 2),
    ],
  },
  {
    id: "stacking_knowledge",
    step: 5,
    scoringGroup: "tactics",
    label: "Hiểu stacking",
    type: "single",
    options: [
      opt("none", "Chưa", 0),
      opt("heard", "Có nghe", 1),
      opt("know", "Biết", 2),
      opt("frequent", "Sử dụng thường xuyên", 3),
    ],
  },
  {
    id: "nvz_transition",
    step: 5,
    scoringGroup: "tactics",
    label: "Chuyển từ baseline lên NVZ",
    type: "single",
    options: [
      opt("none", "Chưa", 0),
      opt("basic", "Biết sơ", 1),
      opt("mastered", "Thành thạo", 3),
    ],
  },
  {
    id: "team_coordination",
    step: 5,
    scoringGroup: "tactics",
    label: "Phối hợp với đồng đội",
    type: "single",
    options: [
      opt("low", "Ít", 0),
      opt("medium", "Trung bình", 1.5),
      opt("good", "Tốt", 3),
    ],
  },
  {
    id: "pace_control",
    step: 5,
    scoringGroup: "tactics",
    label: "Kiểm soát tốc độ bóng",
    type: "single",
    options: [
      opt("none", "Chưa", 0),
      opt("basic", "Biết sơ", 1),
      opt("good", "Tốt", 3),
    ],
  },
  {
    id: "doubles_positioning",
    step: 5,
    scoringGroup: "tactics",
    label: "Chọn vị trí khi đánh đôi",
    type: "single",
    options: [
      opt("none", "Chưa", 0),
      opt("basic", "Biết sơ", 1),
      opt("good", "Tốt", 3),
    ],
  },
  {
    id: "self_rating",
    step: 6,
    scoringGroup: "self",
    label: "Bạn tự đánh giá mình ở mức nào?",
    type: "single",
    options: [
      opt("1.5", "1.5", 0),
      opt("2.0", "2.0", 1),
      opt("2.5", "2.5", 1.5),
      opt("3.0", "3.0", 2),
      opt("3.5", "3.5", 2.5),
      opt("4.0", "4.0", 3),
      opt("4.5", "4.5", 3.5),
      opt("5.0plus", "5.0+", 4),
    ],
  },
  {
    id: "dupr_rating",
    step: 6,
    label: "DUPR Rating (nếu biết)",
    type: "optional_number",
    optional: true,
  },
  {
    id: "utrp_rating",
    step: 6,
    label: "UTR-P Rating (nếu có)",
    type: "optional_number",
    optional: true,
  },
]);

export const GENDER_TO_PLAYER_LABEL = Object.freeze({
  male: "Nam",
  female: "Nữ",
  other: "Khác",
});

export function getQuestionsForStep(step) {
  return SKILL_ASSESSMENT_QUESTIONS.filter((q) => q.step === step);
}

export function getQuestionById(id) {
  return SKILL_ASSESSMENT_QUESTIONS.find((q) => q.id === id) || null;
}

export function getTechniqueUiGroups(step = 4) {
  const groups = new Map();
  for (const question of getQuestionsForStep(step)) {
    const key = question.uiGroup || "Khác";
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(question);
  }
  return [...groups.entries()];
}
