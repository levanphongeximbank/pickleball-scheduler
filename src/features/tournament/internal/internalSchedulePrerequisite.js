/**
 * Internal schedule stage validation — one current prerequisite, no downstream noise.
 */
export function resolveInternalSchedulePrerequisite({
  hasGroups,
  hasDate,
  hasMatches,
} = {}) {
  if (!hasGroups) {
    return {
      ok: false,
      message: "Chia bảng trước khi tạo lịch.",
      showReschedule: false,
    };
  }
  if (!hasDate) {
    return {
      ok: false,
      message: "Chọn ngày thi đấu trước khi tạo lịch.",
      showReschedule: false,
    };
  }
  return {
    ok: true,
    message: hasMatches ? null : "Chọn ngày thi đấu và tạo lịch.",
    showReschedule: Boolean(hasMatches),
  };
}
