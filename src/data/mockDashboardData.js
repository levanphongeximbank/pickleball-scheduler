/**
 * Mock analytics data — tách riêng để sau này thay bằng API thật.
 * Seed ổn định theo khoảng ngày (deterministic).
 */

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const HOUR_SLOTS = Array.from({ length: 16 }, (_, index) => 6 + index);

const MOCK_PLAYERS = [
  { id: "p1", name: "Nguyễn Văn An", club: "CLB Pickle Pro", level: 4.5, elo: 1580, gender: "male" },
  { id: "p2", name: "Trần Thị Bình", club: "CLB Smash", level: 4.0, elo: 1520, gender: "female" },
  { id: "p3", name: "Lê Hoàng Cường", club: "CLB Pickle Pro", level: 3.5, elo: 1450, gender: "male" },
  { id: "p4", name: "Phạm Minh Đức", club: "CLB Dink Master", level: 3.0, elo: 1380, gender: "male" },
  { id: "p5", name: "Hoàng Thị Em", club: "CLB Smash", level: 3.5, elo: 1410, gender: "female" },
  { id: "p6", name: "Vũ Quốc Huy", club: "CLB Pickle Pro", level: 5.0, elo: 1650, gender: "male" },
  { id: "p7", name: "Đặng Lan Hương", club: "CLB Dink Master", level: 2.5, elo: 1280, gender: "female" },
  { id: "p8", name: "Bùi Văn Khánh", club: "CLB Smash", level: 4.0, elo: 1490, gender: "male" },
];

const MOCK_COURTS = [
  { id: "c1", name: "Sân 1", courtId: "c1" },
  { id: "c2", name: "Sân 2", courtId: "c2" },
  { id: "c3", name: "Sân 3", courtId: "c3" },
  { id: "c4", name: "Sân 4", courtId: "c4" },
  { id: "c5", name: "Sân VIP", courtId: "c5" },
];

function hashSeed(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededValue(seed, min, max) {
  const range = max - min + 1;
  return min + (hashSeed(String(seed)) % range);
}

function listDates(from, to) {
  const dates = [];
  const [sy, sm, sd] = from.split("-").map(Number);
  const [ey, em, ed] = to.split("-").map(Number);
  const cursor = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function buildRevenueSeries(from, to) {
  const dates = listDates(from, to);
  const bucketSize = dates.length > 60 ? 7 : dates.length > 14 ? 1 : 1;

  if (bucketSize === 7) {
    const buckets = [];
    for (let index = 0; index < dates.length; index += 7) {
      const slice = dates.slice(index, index + 7);
      const booking = slice.reduce((sum, date) => sum + seededValue(`${date}-booking`, 800000, 2200000), 0);
      const tournament = slice.reduce((sum, date) => sum + seededValue(`${date}-tournament`, 200000, 900000), 0);
      const membership = slice.reduce((sum, date) => sum + seededValue(`${date}-member`, 100000, 500000), 0);
      const other = slice.reduce((sum, date) => sum + seededValue(`${date}-other`, 50000, 200000), 0);
      buckets.push({
        date: slice[0],
        label: slice[0],
        booking,
        tournament,
        membership,
        other,
        total: booking + tournament + membership + other,
      });
    }
    return buckets;
  }

  return dates.map((date) => {
    const booking = seededValue(`${date}-booking`, 120000, 380000);
    const tournament = seededValue(`${date}-tournament`, 30000, 180000);
    const membership = seededValue(`${date}-member`, 20000, 90000);
    const other = seededValue(`${date}-other`, 10000, 50000);
    return {
      date,
      label: date.slice(5),
      booking,
      tournament,
      membership,
      other,
      total: booking + tournament + membership + other,
    };
  });
}

function sumSeries(series, key) {
  return series.reduce((sum, row) => sum + (row[key] || 0), 0);
}

export function buildMockDashboardPayload(from, to, previousFrom, previousTo) {
  const revenueSeries = buildRevenueSeries(from, to);
  const prevSeries = buildRevenueSeries(previousFrom, previousTo);

  const totalRevenue = sumSeries(revenueSeries, "total");
  const bookingRevenue = sumSeries(revenueSeries, "booking");
  const tournamentRevenue = sumSeries(revenueSeries, "tournament");
  const membershipRevenue = sumSeries(revenueSeries, "membership");
  const prevTotalRevenue = sumSeries(prevSeries, "total");

  const dayCount = listDates(from, to).length;
  const totalCustomers = seededValue(`${from}-${to}-customers`, 180, 420);
  const newCustomers = Math.round(totalCustomers * 0.22);
  const returningCustomers = totalCustomers - newCustomers;
  const activePlayers = Math.round(totalCustomers * 0.68);
  const inactivePlayers = Math.max(0, totalCustomers - activePlayers - seededValue("inactive", 5, 30));
  const returnRate = totalCustomers > 0 ? Math.round((returningCustomers / totalCustomers) * 100) : 0;

  const totalClubs = seededValue("clubs", 4, 12);
  const activeClubs = Math.max(1, totalClubs - 1);
  const newClubs = seededValue("new-clubs", 0, 2);
  const clubMembers = seededValue("club-members", 80, 260);

  const totalCourts = MOCK_COURTS.length;
  const bookingCount = seededValue(`${from}-bookings`, 120, 380) * Math.max(1, Math.round(dayCount / 7));
  const fillRate = seededValue("fill", 52, 78);
  const usedHours = Math.round((bookingCount * 1.5) / totalCourts);
  const availableHours = totalCourts * 14 * dayCount;
  const emptyHours = Math.max(0, availableHours - usedHours);

  const topPlayers = MOCK_PLAYERS.map((player, index) => {
    const matches = seededValue(`${player.id}-matches`, 18, 64);
    const wins = Math.round(matches * (0.45 + index * 0.03));
    const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
    const trend = seededValue(`${player.id}-trend`, -8, 15);
    return {
      rank: index + 1,
      id: player.id,
      name: player.name,
      club: player.club,
      level: player.level,
      elo: player.elo,
      matches,
      wins,
      winRate,
      points: player.elo,
      trend,
    };
  }).sort((a, b) => b.points - a.points);

  topPlayers.forEach((player, index) => {
    player.rank = index + 1;
  });

  const topCourts = MOCK_COURTS.map((court, index) => {
    const bookings = seededValue(`${court.id}-${from}`, 20, 90);
    const hours = Math.round(bookings * 1.4);
    const revenue = seededValue(`${court.id}-rev`, 8000000, 28000000);
    const utilization = seededValue(`${court.id}-util`, 35, 92);
    const peakHour = `${seededValue(`${court.id}-peak`, 17, 20)}:00 - ${seededValue(`${court.id}-peak2`, 20, 22)}:00`;
    return {
      rank: index + 1,
      courtId: court.courtId,
      name: court.name,
      bookings,
      hours,
      revenue,
      utilization,
      peakHour,
      isTopPerformer: false,
      isUnderused: utilization < 45,
    };
  })
    .sort((a, b) => b.revenue - a.revenue)
    .map((row, index) => ({
      ...row,
      rank: index + 1,
      isTopPerformer: index === 0,
    }));

  const heatmapCells = [];
  WEEKDAY_LABELS.forEach((weekday, dayIndex) => {
    HOUR_SLOTS.forEach((hour) => {
      const intensity = seededValue(`${weekday}-${hour}`, 0, 100);
      let level = "low";
      if (intensity >= 75) level = "very_high";
      else if (intensity >= 55) level = "high";
      else if (intensity >= 35) level = "medium";

      const bookingsInSlot = Math.round(intensity / 8);
      const fillPercent = Math.min(100, intensity);
      const slotRevenue = bookingsInSlot * seededValue(`${weekday}${hour}`, 80000, 150000);

      heatmapCells.push({
        weekday,
        dayIndex,
        hour,
        hourLabel: `${String(hour).padStart(2, "0")}:00`,
        bookings: bookingsInSlot,
        fillPercent,
        revenue: slotRevenue,
        level,
      });
    });
  });

  const peakSlots = [...heatmapCells]
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 5)
    .map((cell) => ({
      label: `${cell.weekday} ${cell.hourLabel}`,
      bookings: cell.bookings,
      fillPercent: cell.fillPercent,
      severity: cell.level === "very_high" ? "Rất đông" : "Đông",
    }));

  const quietSlots = [...heatmapCells]
    .sort((a, b) => a.bookings - b.bookings)
    .slice(0, 5)
    .map((cell) => ({
      label: `${cell.weekday} ${cell.hourLabel}`,
      bookings: cell.bookings,
      fillPercent: cell.fillPercent,
      severity: "Thấp điểm",
    }));

  const revenueByHour = HOUR_SLOTS.map((hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    revenue: seededValue(`rev-hour-${hour}`, 500000, 4500000),
  })).sort((a, b) => b.revenue - a.revenue);

  const weekdayRevenue = WEEKDAY_LABELS.map((weekday, index) => ({
    weekday,
    revenue: seededValue(`wd-rev-${weekday}`, 2000000, 12000000),
    dayIndex: index,
  })).sort((a, b) => b.revenue - a.revenue);

  const newCustomersSeries = revenueSeries.map((row) => ({
    date: row.date,
    label: row.label,
    newCustomers: seededValue(`${row.date}-new`, 2, 12),
    returningCustomers: seededValue(`${row.date}-ret`, 8, 28),
  }));

  const skillDistribution = [
    { label: "2.0 - 2.5", count: seededValue("sk1", 8, 24) },
    { label: "3.0 - 3.5", count: seededValue("sk2", 18, 48) },
    { label: "4.0 - 4.5", count: seededValue("sk3", 12, 36) },
    { label: "5.0+", count: seededValue("sk4", 4, 14) },
  ];

  const genderDistribution = [
    { label: "Nam", count: seededValue("male", 55, 120) },
    { label: "Nữ", count: seededValue("female", 40, 95) },
    { label: "Khác / chưa rõ", count: seededValue("other", 2, 12) },
  ];

  return {
    isMock: true,
    summary: {
      revenue: {
        total: totalRevenue,
        booking: bookingRevenue,
        tournament: tournamentRevenue,
        membership: membershipRevenue,
        other: sumSeries(revenueSeries, "other"),
        transactions: bookingCount + seededValue("tx", 10, 40),
        trendPercent: prevTotalRevenue
          ? Math.round(((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100)
          : 0,
      },
      customers: {
        total: totalCustomers,
        new: newCustomers,
        returning: returningCustomers,
        activePlayers,
        inactivePlayers,
        returnRate,
        trendPercent: seededValue("cust-trend", -5, 22),
      },
      clubs: {
        total: totalClubs,
        active: activeClubs,
        new: newClubs,
        members: clubMembers,
        mostActive: "CLB Pickle Pro",
        trendPercent: seededValue("club-trend", 0, 18),
      },
      courts: {
        total: totalCourts,
        bookings: bookingCount,
        fillRate,
        usedHours,
        emptyHours,
        trendPercent: seededValue("court-trend", -3, 15),
      },
    },
    revenueSeries,
    newCustomersSeries,
    skillDistribution,
    genderDistribution,
    topPlayers,
    topCourts,
    heatmap: {
      weekdays: WEEKDAY_LABELS,
      hours: HOUR_SLOTS,
      cells: heatmapCells,
    },
    peakHours: {
      busiest: peakSlots,
      quietest: quietSlots,
      topRevenueHour: revenueByHour[0],
      busiestWeekday: weekdayRevenue[0],
      quietestWeekday: weekdayRevenue[weekdayRevenue.length - 1],
    },
  };
}
