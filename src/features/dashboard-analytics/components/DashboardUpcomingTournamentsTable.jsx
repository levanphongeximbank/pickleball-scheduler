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
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

import DashboardEmptyState from "./DashboardEmptyState.jsx";
import {
  dashboardCardContentSx,
  dashboardCardSx,
  dashboardSectionTitleSx,
} from "../constants/dashboardLayout.js";

const STATUS_META = {
  upcoming: { label: "Sắp diễn ra", color: "warning" },
  registration: { label: "Mở đăng ký", color: "success" },
  live: { label: "Đang diễn ra", color: "info" },
};

export default function DashboardUpcomingTournamentsTable({ rows = [] }) {
  return (
    <Card variant="outlined" sx={dashboardCardSx}>
      <CardContent sx={dashboardCardContentSx}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.75 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <EmojiEventsIcon color="primary" sx={{ fontSize: 18 }} />
            <Typography sx={dashboardSectionTitleSx}>Giải đấu sắp tới</Typography>
          </Stack>
          <Button
            component={RouterLink}
            to="/tournament"
            size="small"
            sx={{ textTransform: "none", fontWeight: 600, fontSize: 13, minWidth: 0 }}
          >
            Xem tất cả
          </Button>
        </Stack>

        {!rows.length ? (
          <DashboardEmptyState
            title="Chưa có giải sắp tới"
            description="Tạo giải mới để theo dõi lịch thi đấu."
          />
        ) : (
          <TableContainer sx={{ maxHeight: 280 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: 12, py: 1 }}>Giải đấu</TableCell>
                  <TableCell sx={{ fontSize: 12, py: 1 }}>Ngày</TableCell>
                  <TableCell align="right" sx={{ fontSize: 12, py: 1 }}>Đội</TableCell>
                  <TableCell sx={{ fontSize: 12, py: 1 }}>Trạng thái</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.slice(0, 5).map((row) => {
                  const status = STATUS_META[row.status] || STATUS_META.upcoming;
                  return (
                    <TableRow key={row.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {row.name}
                        </Typography>
                      </TableCell>
                      <TableCell>{row.date}</TableCell>
                      <TableCell align="right">{row.teams}</TableCell>
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
