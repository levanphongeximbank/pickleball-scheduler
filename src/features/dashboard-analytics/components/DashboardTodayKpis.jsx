import { useMemo } from "react";
import { Grid } from "@mui/material";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import StadiumIcon from "@mui/icons-material/Stadium";
import HourglassTopIcon from "@mui/icons-material/HourglassTop";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";

import { useClub } from "../../../context/ClubContext.jsx";
import { loadCourtManagementData } from "../../../domain/bookingService.js";
import { computeRangeRevenue } from "../../../domain/courtBookingEngine.js";
import { formatIsoDate } from "../constants/timeRangePresets.js";
import { buildVenueOpsMeta } from "../../../utils/venueOpsMeta.js";
import KpiCard from "./KpiCard.jsx";
import { formatCurrency } from "./kpiCardUtils.js";
import { SHELL_COLORS } from "../../../components/shell/shellTokens.js";

function countTodayBookings(bookings) {
  const today = formatIsoDate(new Date());
  return (bookings || []).filter((booking) => booking.date === today).length;
}

export default function DashboardTodayKpis({ summary, isMock = false }) {
  const { activeClubId } = useClub();

  const metrics = useMemo(() => {
    const ops = buildVenueOpsMeta(activeClubId, summary);
    const bookings = loadCourtManagementData(activeClubId).bookings;
    const today = formatIsoDate(new Date());
    const todayRevenue = computeRangeRevenue(bookings, today, today);

    if (isMock && ops.playingNow === 0 && ops.waitingNow === 0) {
      return {
        bookingsToday: 18,
        checkinsToday: 12,
        courtsInUse: 4,
        waiting: 3,
        revenueToday: 2450000,
      };
    }

    return {
      bookingsToday: countTodayBookings(bookings),
      checkinsToday: ops.checkedInToday,
      courtsInUse: ops.playingNow,
      waiting: ops.waitingNow,
      revenueToday: todayRevenue.total || 0,
    };
  }, [activeClubId, summary, isMock]);

  const cards = [
    {
      label: "Lượt đặt hôm nay",
      value: metrics.bookingsToday,
      icon: EventAvailableIcon,
    },
    {
      label: "Check-in hôm nay",
      value: metrics.checkinsToday,
      icon: HowToRegIcon,
    },
    {
      label: "Sân đang sử dụng",
      value: metrics.courtsInUse,
      icon: StadiumIcon,
      accent: SHELL_COLORS.primaryGreen,
    },
    {
      label: "Người đang chờ",
      value: metrics.waiting,
      icon: HourglassTopIcon,
    },
    {
      label: "Doanh thu hôm nay",
      value: formatCurrency(metrics.revenueToday),
      icon: AttachMoneyIcon,
    },
  ];

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {cards.map((card) => (
        <Grid key={card.label} size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <KpiCard
            label={card.label}
            value={card.value}
            icon={card.icon}
            accent={card.accent || SHELL_COLORS.primaryGreen}
          />
        </Grid>
      ))}
    </Grid>
  );
}
