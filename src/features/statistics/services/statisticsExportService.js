export function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\n") || text.includes("\"")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function buildFilteredSessionsCsv(filteredSessions = []) {
  const headers = [
    "session_id",
    "date",
    "round",
    "shift",
    "courts",
    "waiting",
    "ai_score",
  ];

  const rows = filteredSessions.map((session) => [
    session.id,
    session.date,
    session.meta?.roundName || "Round tự do",
    session.meta?.shiftLabel || "",
    session.courts?.length || 0,
    session.waiting?.length || 0,
    session.aiScore?.total || 0,
  ]);

  return [headers.join(","), ...rows.map((row) => row.map(escapeCsvCell).join(","))].join("\n");
}

export function buildRoundCompareCsv({
  compareRoundAName,
  compareRoundBName,
  compareRoundAMetrics,
  compareRoundBMetrics,
  compareRoundAGrade,
  compareRoundBGrade,
  waitingAlertThreshold,
}) {
  const headers = [
    "round_label",
    "round_name",
    "session_count",
    "avg_ai_score",
    "avg_waiting",
    "grade",
    "waiting_alert",
  ];

  const rows = [
    [
      "A",
      compareRoundAName,
      compareRoundAMetrics.sessionCount,
      compareRoundAMetrics.avgAIScore,
      compareRoundAMetrics.avgWaiting,
      compareRoundAGrade,
      compareRoundAMetrics.avgWaiting > waitingAlertThreshold ? "YES" : "NO",
    ],
    [
      "B",
      compareRoundBName,
      compareRoundBMetrics.sessionCount,
      compareRoundBMetrics.avgAIScore,
      compareRoundBMetrics.avgWaiting,
      compareRoundBGrade,
      compareRoundBMetrics.avgWaiting > waitingAlertThreshold ? "YES" : "NO",
    ],
  ];

  return [headers.join(","), ...rows.map((row) => row.map(escapeCsvCell).join(","))].join("\n");
}
