import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";

import { formatCurrency } from "../services/dashboardService.js";
import DashboardEmptyState from "./DashboardEmptyState.jsx";

function SlotList({ title, items, icon: Icon, emptyText }) {
  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
        <Icon fontSize="small" color="action" />
        <Typography variant="subtitle2" fontWeight="bold">
          {title}
        </Typography>
      </Stack>
      {!items?.length ? (
        <Typography variant="body2" color="text.secondary">
          {emptyText}
        </Typography>
      ) : (
        <List dense disablePadding>
          {items.map((item) => (
            <ListItem key={item.label} disableGutters sx={{ py: 0.5 }}>
              <ListItemText
                primary={item.label}
                secondary={`${item.bookings} lượt • ${item.fillPercent}% • ${item.severity}`}
                primaryTypographyProps={{ variant: "body2", fontWeight: "medium" }}
                secondaryTypographyProps={{ variant: "caption" }}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}

export default function PeakHoursPanel({ peakHours }) {
  if (!peakHours) {
    return (
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <DashboardEmptyState title="Chưa có phân tích giờ cao điểm" description="" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
          <AccessTimeIcon color="primary" />
          <Typography variant="h6" fontWeight="bold">
            Giờ cao điểm
          </Typography>
        </Stack>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <SlotList
              title="Top 5 khung giờ đông nhất"
              items={peakHours.busiest}
              icon={TrendingUpIcon}
              emptyText="Chưa có dữ liệu."
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <SlotList
              title="Top 5 khung giờ trống nhiều nhất"
              items={peakHours.quietest}
              icon={TrendingDownIcon}
              emptyText="Chưa có dữ liệu."
            />
          </Grid>
        </Grid>

        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
          {peakHours.topRevenueHour && (
            <Chip
              label={`Doanh thu cao nhất: ${peakHours.topRevenueHour.label} (${formatCurrency(peakHours.topRevenueHour.revenue)})`}
              color="primary"
              variant="outlined"
            />
          )}
          {peakHours.busiestWeekday && (
            <Chip
              label={`Ngày đông nhất: ${peakHours.busiestWeekday.weekday}`}
              color="success"
              variant="outlined"
            />
          )}
          {peakHours.quietestWeekday && (
            <Chip
              label={`Ngày vắng nhất: ${peakHours.quietestWeekday.weekday}`}
              variant="outlined"
            />
          )}
        </Stack>

        <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: "grey.50" }}>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.5 }}>
            Gợi ý vận hành nhanh
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Tăng giá giờ cao điểm • Khuyến mãi giờ thấp điểm • Bổ sung ca nhân viên cuối tuần
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
