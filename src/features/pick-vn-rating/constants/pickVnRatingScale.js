/** Thang trình Pick_VN — bước 0.5, phạm vi 1.0–8.0 */
export const PICK_VN_RATING_LEVELS = Object.freeze([
  "1.0",
  "1.5",
  "2.0",
  "2.5",
  "3.0",
  "3.5",
  "4.0",
  "4.5",
  "5.0",
  "5.5",
  "6.0",
  "6.5",
  "7.0",
  "7.5",
  "8.0",
]);

export const PICK_VN_MIN = 1.0;
export const PICK_VN_MAX = 8.0;
export const PICK_VN_STEP = 0.5;
/** Bước mịn 1.0–4.0 — onboarding & trình phong trào */
export const PICK_VN_FINE_STEP = 0.1;
export const PICK_VN_FINE_MAX = 4.0;
export const PICK_VN_ONBOARDING_CONFIRM_MARKS = Object.freeze([
  "1.0",
  "1.5",
  "2.0",
  "2.5",
  "3.0",
  "3.5",
  "4.0",
]);
/** Legacy label — chỉ dùng khi parse dữ liệu cũ */
export const PICK_VN_PLUS_DISPLAY = "6.0+";
export const PICK_VN_PLUS_NUMERIC = 6.5;

function toNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function isPickVnPlusRating(value) {
  const raw = String(value ?? "").trim();
  return raw === PICK_VN_PLUS_DISPLAY || raw === "6.5" || toNumber(value) === PICK_VN_PLUS_NUMERIC;
}

export function parsePickVnRating(value, fallback = 3.5) {
  if (value === null || value === undefined || value === "") {
    return toNumber(fallback, 3.5);
  }
  if (isPickVnPlusRating(value)) {
    return PICK_VN_PLUS_NUMERIC;
  }
  return toNumber(value, toNumber(fallback, 3.5));
}

export function snapPickVnRating(value) {
  const numeric = parsePickVnRating(value, PICK_VN_MIN);
  const step = numeric <= PICK_VN_FINE_MAX ? PICK_VN_FINE_STEP : PICK_VN_STEP;
  const snapped = Math.round(numeric / step) * step;
  return Math.min(PICK_VN_MAX, Math.max(PICK_VN_MIN, Math.round(snapped * 10) / 10));
}

/** Slider bước 7 — chỉ 1.0–4.0, bước 0.1 (chọn được 2.2, 2.3, 2.4…) */
export function snapPickVnOnboardingConfirm(value) {
  const numeric = parsePickVnRating(value, PICK_VN_MIN);
  const clamped = Math.min(PICK_VN_FINE_MAX, Math.max(PICK_VN_MIN, numeric));
  const snapped = Math.round(clamped / PICK_VN_FINE_STEP) * PICK_VN_FINE_STEP;
  return Math.round(snapped * 10) / 10;
}

export function formatPickVnRating(value) {
  const numeric = parsePickVnRating(value);
  return numeric.toFixed(1);
}

export function getPickVnRatingSliderMarks() {
  return PICK_VN_RATING_LEVELS.map((label) => ({
    value: parsePickVnRating(label),
    label,
  }));
}

export function getOnboardingConfirmSliderMarks() {
  return PICK_VN_ONBOARDING_CONFIRM_MARKS.map((label) => ({
    value: parsePickVnRating(label),
    label,
  }));
}

/** Giữ legacy trên thang Pick_VN */
export function migrateLegacyRating(value) {
  const numeric = parsePickVnRating(value, PICK_VN_MIN);
  if (numeric < PICK_VN_MIN) {
    return PICK_VN_MIN;
  }
  return snapPickVnRating(numeric);
}
