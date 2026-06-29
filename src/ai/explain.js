/*
==========================================================
AI Explanation Helpers
Creates human-readable reasoning for each court result.
==========================================================
*/

export function buildCourtExplanation(courtResult = {}, context = {}) {
  const messages = [];

  if (courtResult.diff <= 0.3) {
    messages.push("Mức chênh lệch đội rất cân bằng.");
  } else if (courtResult.diff <= 0.7) {
    messages.push("Mức chênh lệch đội ở mức chấp nhận được.");
  } else {
    messages.push("Mức chênh lệch đội khá lớn.");
  }

  if (courtResult.score >= 90) {
    messages.push("Đánh giá AI ở mức rất tốt.");
  } else if (courtResult.score >= 70) {
    messages.push("Đánh giá AI ở mức tốt.");
  } else {
    messages.push("Đánh giá AI cần cải thiện.");
  }

  const waitingScore = courtResult.detailScore?.waitingScore;
  if (typeof waitingScore === "number") {
    if (waitingScore >= 80) {
      messages.push("Ưu tiên người chờ lâu được xếp sân.");
    } else if (waitingScore <= 40) {
      messages.push("Nhóm này ít được ưu tiên theo lịch sử chờ.");
    }
  }

  if ((context.policies || []).length > 0) {
    messages.push("Có policy được áp dụng để điều chỉnh kết quả.");
  }

  return messages.join(" ");
}
