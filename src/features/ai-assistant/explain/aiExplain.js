export function explainGroupBalance(groups = []) {
  if (!groups.length) {
    return "Chưa có bảng đấu để phân tích.";
  }

  const avgs = groups.map((g) => g.averageElo || g.strengthScore || 0);
  const maxAvg = Math.max(...avgs);
  const minAvg = Math.min(...avgs);
  const maxGroup = groups.find((g) => (g.averageElo || g.strengthScore) === maxAvg);
  const minGroup = groups.find((g) => (g.averageElo || g.strengthScore) === minAvg);

  if (maxAvg - minAvg < 30) {
    return `Các bảng cân bằng tốt — chênh lệch trung bình chỉ ${Math.round(maxAvg - minAvg)} điểm.`;
  }

  const pct = minAvg > 0 ? Math.round(((maxAvg - minAvg) / minAvg) * 100) : 0;
  return `Bảng ${maxGroup?.groupName || "?"} có trung bình ${Math.round(maxAvg)}, cao hơn Bảng ${minGroup?.groupName || "?"} (${Math.round(minAvg)}) khoảng ${pct}%.`;
}

export function explainSeedChoice(participant, rank, total) {
  const parts = [];
  if (participant.elo != null) {
    parts.push(`ELO ${Math.round(participant.elo)}`);
  } else if (participant.skillLevel != null) {
    parts.push(`trình độ ${participant.skillLevel}`);
  } else {
    parts.push("chưa có dữ liệu lịch sử");
  }
  if (participant.matchesPlayed > 0) {
    parts.push(`${participant.matchesPlayed} trận đã chơi`);
  }
  return `Hạt giống #${rank}/${total}: ${participant.name} — ${parts.join(", ")}.`;
}

export function explainTimePrediction({
  matchCount,
  courtCount,
  estimatedMinutes,
  endTime,
  exceedsWindow,
}) {
  const hours = Math.floor(estimatedMinutes / 60);
  const mins = estimatedMinutes % 60;
  let text = `Với ${matchCount} trận, ${courtCount} sân, giải dự kiến kéo dài ${hours ? `${hours} giờ ` : ""}${mins} phút.`;
  if (exceedsWindow && endTime) {
    text += ` Thời gian vượt khung thuê sân (${endTime}).`;
  }
  return text;
}

export function explainRuleSuggestion(title, reason) {
  return `${title}: ${reason}`;
}

export function buildAiSummaryBullets({
  balanceScore,
  timeWarnings = [],
  scheduleIssues = [],
  unknownPlayers = 0,
}) {
  const bullets = [];
  if (balanceScore >= 80) {
    bullets.push("Chia bảng tương đối cân bằng.");
  } else if (balanceScore >= 60) {
    bullets.push("Chia bảng khá cân bằng, có vài bảng hơi lệch.");
  } else {
    bullets.push("Chia bảng chưa cân bằng — nên xem lại phân bổ.");
  }

  const critical = scheduleIssues.filter((i) => i.severity === "critical").length;
  const warning = scheduleIssues.filter((i) => i.severity === "warning").length;
  if (critical > 0) {
    bullets.push(`${critical} lỗi lịch nghiêm trọng cần sửa.`);
  }
  if (warning > 0) {
    bullets.push(`${warning} cảnh báo lịch nên xem lại.`);
  }

  timeWarnings.forEach((w) => bullets.push(w));
  if (unknownPlayers > 0) {
    bullets.push(`${unknownPlayers} vận động viên chưa có dữ liệu ELO.`);
  }

  return bullets;
}
