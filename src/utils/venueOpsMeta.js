import { computeCourtDashboardStats } from "./courtHelpers.js";
import { getTodayCheckedInPlayerIds } from "./playerHelpers.js";
import { loadCourtManagementData } from "../domain/bookingService.js";
import { loadCourts } from "../pages/courts.logic.js";

/** Thống kê vận hành sân hôm nay — dùng cho context bar & dashboard. */
export function buildVenueOpsMeta(activeClubId, summary) {
  const courts = loadCourts([], activeClubId);
  const bookings = loadCourtManagementData(activeClubId).bookings;
  const courtStats = computeCourtDashboardStats(courts, bookings);
  const checkedInIds = getTodayCheckedInPlayerIds(activeClubId);

  return {
    playerCount: summary?.totals?.players ?? 0,
    courtCount: summary?.totals?.courts ?? 0,
    playingNow: courtStats.playing ?? 0,
    waitingNow: courtStats.waiting ?? 0,
    checkedInToday: checkedInIds.size,
    isLive: (courtStats.playing ?? 0) > 0,
  };
}
