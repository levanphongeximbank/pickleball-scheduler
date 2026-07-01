import {
  Box,
  Grid,
} from "@mui/material";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import GroupsIcon from "@mui/icons-material/Groups";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import StadiumIcon from "@mui/icons-material/Stadium";

import KpiCard, { KpiSection } from "./KpiCard.jsx";
import { formatCurrency } from "./kpiCardUtils.js";

export default function DashboardKpiPanels({ summary, sections }) {
  if (!summary) return null;

  return (
    <Box sx={{ mb: 3 }}>
      {sections.revenue && (
        <KpiSection title="Doanh thu">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard
                label="Tổng doanh thu"
                value={formatCurrency(summary.revenue.total)}
                trendPercent={summary.revenue.trendPercent}
                icon={AttachMoneyIcon}
                accent="#2e7d32"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard
                label="Đặt sân"
                value={formatCurrency(summary.revenue.booking)}
                icon={AttachMoneyIcon}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard
                label="Giải đấu"
                value={formatCurrency(summary.revenue.tournament)}
                icon={AttachMoneyIcon}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard
                label="Hội viên / CLB"
                value={formatCurrency(summary.revenue.membership)}
                icon={AttachMoneyIcon}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard
                label="Số giao dịch"
                value={summary.revenue.transactions}
                hint={`Khác: ${formatCurrency(summary.revenue.other)}`}
                icon={AttachMoneyIcon}
              />
            </Grid>
          </Grid>
        </KpiSection>
      )}

      {sections.customers && (
        <KpiSection title="Khách / Người chơi">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard
                label="Tổng khách"
                value={summary.customers.total}
                trendPercent={summary.customers.trendPercent}
                icon={GroupsIcon}
                accent="#1565c0"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard label="Khách mới" value={summary.customers.new} icon={GroupsIcon} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard label="Khách quay lại" value={summary.customers.returning} icon={GroupsIcon} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard label="Đang hoạt động" value={summary.customers.activePlayers} icon={GroupsIcon} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard label="Vắng lâu ngày" value={summary.customers.inactivePlayers} icon={GroupsIcon} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <KpiCard
                label="Tỷ lệ quay lại"
                value={`${summary.customers.returnRate}%`}
                icon={GroupsIcon}
              />
            </Grid>
          </Grid>
        </KpiSection>
      )}

      {sections.clubs && (
        <KpiSection title="CLB">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
              <KpiCard
                label="Tổng CLB"
                value={summary.clubs.total}
                trendPercent={summary.clubs.trendPercent}
                icon={SportsTennisIcon}
                accent="#6a1b9a"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
              <KpiCard label="CLB hoạt động" value={summary.clubs.active} icon={SportsTennisIcon} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
              <KpiCard label="CLB mới" value={summary.clubs.new} icon={SportsTennisIcon} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
              <KpiCard label="Thành viên CLB" value={summary.clubs.members} icon={SportsTennisIcon} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
              <KpiCard
                label="CLB nổi bật"
                value={summary.clubs.mostActive}
                icon={SportsTennisIcon}
              />
            </Grid>
          </Grid>
        </KpiSection>
      )}

      {sections.courts && (
        <KpiSection title="Sân">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
              <KpiCard
                label="Tổng sân"
                value={summary.courts.total}
                trendPercent={summary.courts.trendPercent}
                icon={StadiumIcon}
                accent="#ef6c00"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
              <KpiCard label="Lượt đặt sân" value={summary.courts.bookings} icon={StadiumIcon} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
              <KpiCard label="Tỷ lệ lấp đầy" value={`${summary.courts.fillRate}%`} icon={StadiumIcon} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
              <KpiCard label="Giờ sử dụng" value={summary.courts.usedHours} icon={StadiumIcon} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
              <KpiCard label="Giờ trống" value={summary.courts.emptyHours} icon={StadiumIcon} />
            </Grid>
          </Grid>
        </KpiSection>
      )}
    </Box>
  );
}
