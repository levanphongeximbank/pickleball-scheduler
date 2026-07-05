import { Link as RouterLink } from "react-router-dom";

import {
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import BookOnlineIcon from "@mui/icons-material/BookOnline";

import DashboardEmptyState from "./DashboardEmptyState.jsx";
import {
  dashboardCardContentSx,
  dashboardCardSx,
  dashboardSectionTitleSx,
} from "../constants/dashboardLayout.js";

const STATUS_META = {
  confirmed: { label: "Đã xác nhận", color: "success" },
  pending: { label: "Chờ xác nhận", color: "info" },
  cancelled: { label: "Đã hủy", color: "default" },
};

export default function DashboardRecentBookingsTable({ rows = [] }) {
  return (
    <Card variant="outlined" sx={dashboardCardSx}>
      <CardContent sx={dashboardCardContentSx}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.75 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <BookOnlineIcon color="primary" sx={{ fontSize: 18 }} />
            <Typography sx={dashboardSectionTitleSx}>Đặt sân gần đây</Typography>
          </Stack>
          <Button
            component={RouterLink}
            to="/court-management/bookings"
            size="small"
            sx={{ textTransform: "none", fontWeight: 600, fontSize: 13, minWidth: 0 }}
          >
            Xem tất cả
          </Button>
        </Stack>

        {!rows.length ? (
          <DashboardEmptyState
            title="Chưa có đặt sân"
            description="Lịch đặt sân mới sẽ hiển thị tại đây."
          />
        ) : (
          <TableContainer sx={{ maxHeight: 280 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: 12, py: 1 }}>Mã</TableCell>
                  <TableCell sx={{ fontSize: 12, py: 1 }}>Hội viên</TableCell>
                  <TableCell sx={{ fontSize: 12, py: 1 }}>Sân</TableCell>
                  <TableCell sx={{ fontSize: 12, py: 1 }}>Giờ</TableCell>
                  <TableCell sx={{ fontSize: 12, py: 1 }}>Trạng thái</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.slice(0, 5).map((row) => {
                  const status = STATUS_META[row.status] || STATUS_META.pending;
                  return (
                    <TableRow key={row.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {row.id}
                        </Typography>
                      </TableCell>
                      <TableCell>{row.member}</TableCell>
                      <TableCell>{row.court}</TableCell>
                      <TableCell>{row.time}</TableCell>
                      <TableCell>
                        <Chip size="small" label={status.label} color={status.color} variant="outlined" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
