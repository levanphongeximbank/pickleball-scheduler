/**
 * Match score persistence is canonical. Elo/season points are optional enrichment.
 */
export const INTERNAL_OPTIONAL_ELO_SEASON_NOTICE =
  "Kết quả trận đã lưu. Cập nhật Elo/điểm mùa chưa hoàn tất — không ảnh hưởng lịch thi đấu.";

export function classifyCanonicalMatchLifecycleResult(result = {}) {
  if (!result || result.ok === false) {
    return {
      class: "BLOCKING",
      banner: "error",
      message: result?.error || "Không lưu được kết quả trận.",
    };
  }
  if (result.lifecycleOk === false) {
    return {
      class: "OPTIONAL_ENRICHMENT",
      banner: "local-warning",
      message: INTERNAL_OPTIONAL_ELO_SEASON_NOTICE,
      detail: result.lifecycleError || null,
    };
  }
  return { class: "OK", banner: null, message: null };
}
