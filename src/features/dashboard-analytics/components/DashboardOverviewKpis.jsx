import { Grid } from "@mui/material";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import GroupsIcon from "@mui/icons-material/Groups";
import StadiumIcon from "@mui/icons-material/Stadium";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

import KpiCard from "./KpiCard.jsx";
import { formatCurrency } from "./kpiCardUtils.js";
import { SHELL_COLORS } from "../../../components/shell/shellTokens.js";
import { DASHBOARD_LAYOUT } from "../constants/dashboardLayout.js";

export default function DashboardOverviewKpis({ summary, sections }) {
  if (!summary) return null;

  const cards = [];

  if (sections.courts) {
    cards.push({
      key: "bookings",
      label: "Tổng đặt sân",
      value: summary.courts.bookings,
      trendPercent: summary.courts.trendPercent,
      icon: EventAvailableIcon,
    });
  }

  if (sections.customers) {
    cards.push({
      key: "members",
      label: "Hội viên",
      value: summary.customers.total,
      trendPercent: summary.customers.trendPercent,
      icon: GroupsIcon,
    });
  }

  if (sections.courts) {
    cards.push({
      key: "fill-rate",
      label: "Tỷ lệ lấp đầy",
      value: `${summary.courts.fillRate}%`,
      trendPercent: summary.courts.trendPercent,
      icon: StadiumIcon,
    });
  }

  if (sections.revenue) {
    cards.push({
      key: "revenue",
      label: "Doanh thu",
      value: formatCurrency(summary.revenue.total),
      trendPercent: summary.revenue.trendPercent,
      icon: AttachMoneyIcon,
    });
  }

  if (sections.clubs) {
    cards.push({
      key: "tournaments",
      label: "Giải đấu",
      value: summary.clubs.active,
      trendPercent: summary.clubs.trendPercent,
      icon: EmojiEventsIcon,
    });
  }

  if (!cards.length) return null;

  const colSize =
    cards.length >= 5
      ? { xs: 12, sm: 6, md: 4, xl: 2.4 }
      : { xs: 12, sm: 6, md: 4, lg: 3 };

  return (
    <Grid container spacing={DASHBOARD_LAYOUT.gridSpacing} sx={{ mb: DASHBOARD_LAYOUT.sectionGap }}>
      {cards.map((card) => (
        <Grid key={card.key} size={colSize}>
          <KpiCard
            label={card.label}
            value={card.value}
            trendPercent={card.trendPercent}
            icon={card.icon}
            accent={SHELL_COLORS.primaryGreen}
            compactTrend
          />
        </Grid>
      ))}
    </Grid>
  );
}
