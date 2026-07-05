export const TIME_RANGE_PRESETS = Object.freeze({
  TODAY: "today",
  LAST_7_DAYS: "7d",
  LAST_30_DAYS: "30d",
  THIS_MONTH: "this_month",
  LAST_MONTH: "last_month",
  THIS_YEAR: "year",
  CUSTOM: "custom",
});

export const TIME_RANGE_OPTIONS = Object.freeze([
  { value: TIME_RANGE_PRESETS.TODAY, label: "Hôm nay" },
  { value: TIME_RANGE_PRESETS.LAST_7_DAYS, label: "7 ngày" },
  { value: TIME_RANGE_PRESETS.LAST_30_DAYS, label: "30 ngày" },
  { value: TIME_RANGE_PRESETS.THIS_MONTH, label: "Tháng này" },
  { value: TIME_RANGE_PRESETS.LAST_MONTH, label: "Tháng trước" },
  { value: TIME_RANGE_PRESETS.THIS_YEAR, label: "Năm nay" },
  { value: TIME_RANGE_PRESETS.CUSTOM, label: "Tùy chọn ngày" },
]);

/** Chip lọc trên dashboard — khớp mockup (4 nút chính). */
export const DASHBOARD_TIME_FILTER_OPTIONS = Object.freeze([
  { value: TIME_RANGE_PRESETS.TODAY, label: "Hôm nay" },
  { value: TIME_RANGE_PRESETS.LAST_7_DAYS, label: "Tuần này" },
  { value: TIME_RANGE_PRESETS.THIS_MONTH, label: "Tháng này" },
  { value: TIME_RANGE_PRESETS.CUSTOM, label: "Tùy chọn" },
]);

function pad(value) {
  return String(value).padStart(2, "0");
}

export function formatIsoDate(date) {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function resolveTimeRange(preset, customFrom, customTo, referenceDate = new Date()) {
  const today = formatIsoDate(referenceDate);
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  switch (preset) {
    case TIME_RANGE_PRESETS.TODAY:
      return { preset, from: today, to: today, label: "Hôm nay" };

    case TIME_RANGE_PRESETS.LAST_7_DAYS: {
      const fromDate = new Date(referenceDate);
      fromDate.setDate(fromDate.getDate() - 6);
      return {
        preset,
        from: formatIsoDate(fromDate),
        to: today,
        label: "7 ngày qua",
      };
    }

    case TIME_RANGE_PRESETS.LAST_30_DAYS: {
      const fromDate = new Date(referenceDate);
      fromDate.setDate(fromDate.getDate() - 29);
      return {
        preset,
        from: formatIsoDate(fromDate),
        to: today,
        label: "30 ngày qua",
      };
    }

    case TIME_RANGE_PRESETS.THIS_MONTH: {
      const from = `${year}-${pad(month + 1)}-01`;
      return { preset, from, to: today, label: "Tháng này" };
    }

    case TIME_RANGE_PRESETS.LAST_MONTH: {
      const lastMonthStart = new Date(year, month - 1, 1);
      const lastMonthEnd = new Date(year, month, 0);
      return {
        preset,
        from: formatIsoDate(lastMonthStart),
        to: formatIsoDate(lastMonthEnd),
        label: "Tháng trước",
      };
    }

    case TIME_RANGE_PRESETS.THIS_YEAR: {
      const from = `${year}-01-01`;
      return { preset, from, to: today, label: "Năm nay" };
    }

    case TIME_RANGE_PRESETS.CUSTOM:
    default:
      return {
        preset: TIME_RANGE_PRESETS.CUSTOM,
        from: customFrom || today,
        to: customTo || today,
        label: "Tùy chọn",
      };
  }
}

export function resolvePreviousPeriod(from, to) {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  const dayCount = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
  );

  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (dayCount - 1));

  return {
    from: formatIsoDate(prevStart),
    to: formatIsoDate(prevEnd),
    dayCount,
  };
}

export function computeTrendPercent(current, previous) {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (prev === 0) {
    return cur > 0 ? 100 : 0;
  }
  return Math.round(((cur - prev) / prev) * 100);
}
