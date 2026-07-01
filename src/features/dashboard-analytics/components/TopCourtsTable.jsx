import {
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
import StadiumIcon from "@mui/icons-material/Stadium";

import { formatCurrency } from "../services/dashboardService.js";
import DashboardEmptyState from "./DashboardEmptyState.jsx";

export default function TopCourtsTable({ rows = [] }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
          <StadiumIcon color="primary" />
          <Typography variant="h6" fontWeight="bold">
            Top Courts
          </Typography>
        </Stack>

        {!rows.length ? (
          <DashboardEmptyState
            title="Chưa có dữ liệu sân"
            description="Thêm sân và booking để phân tích hiệu suất."
          />
        ) : (
          <TableContainer sx={{ maxHeight: 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Hạng</TableCell>
                  <TableCell>Sân</TableCell>
                  <TableCell align="right">Lượt đặt</TableCell>
                  <TableCell align="right">Giờ SD</TableCell>
                  <TableCell align="right">Doanh thu</TableCell>
                  <TableCell align="right">Lấp đầy</TableCell>
                  <TableCell>Giờ đông</TableCell>
                  <TableCell>Trạng thái</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((court) => (
                  <TableRow
                    key={court.courtId || court.name}
                    hover
                    sx={{
                      bgcolor: court.isTopPerformer
                        ? "success.50"
                        : court.isUnderused
                          ? "warning.50"
                          : undefined,
                    }}
                  >
                    <TableCell>
                      <Typography fontWeight="bold">#{court.rank}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={court.isTopPerformer ? "bold" : "medium"}>
                        {court.name}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{court.bookings}</TableCell>
                    <TableCell align="right">{court.hours}h</TableCell>
                    <TableCell align="right">{formatCurrency(court.revenue)}</TableCell>
                    <TableCell align="right">{court.utilization}%</TableCell>
                    <TableCell>{court.peakHour}</TableCell>
                    <TableCell>
                      {court.isTopPerformer && (
                        <Chip size="small" color="success" label="Tốt nhất" />
                      )}
                      {!court.isTopPerformer && court.isUnderused && (
                        <Chip size="small" color="warning" label="Ít dùng" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
