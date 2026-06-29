export function buildSeasonStandingsCsv(rows = [], meta = {}) {
  const headers = [
    "Hang",
    "VDV",
    "Diem mua",
    "Tran",
    "Thang",
    "Thua",
    "Hoa",
    "Ty le thang",
    "Elo",
  ];

  const escapeCsvCell = (value) => {
    const text = String(value ?? "");
    if (text.includes(",") || text.includes('"') || text.includes("\n")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const bodyRows = rows.map((row, index) => {
    const decided = row.wins + row.losses;
    const winRate = decided ? `${Math.round((row.wins / decided) * 1000) / 10}%` : "";

    return [
      index + 1,
      row.name,
      row.points,
      row.matches,
      row.wins,
      row.losses,
      row.draws,
      winRate,
      row.rating ?? "",
    ];
  });

  const metaLines = [];
  if (meta.seasonName) {
    metaLines.push(`Mua: ${meta.seasonName}`);
  }
  if (meta.leagueName) {
    metaLines.push(`Giai: ${meta.leagueName}`);
  }

  return [
    ...metaLines,
    headers.join(","),
    ...bodyRows.map((row) => row.map(escapeCsvCell).join(",")),
  ]
    .filter(Boolean)
    .join("\n");
}
