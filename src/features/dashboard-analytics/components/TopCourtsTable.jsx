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

export default function TopCourtsTable({ rows = [], title = "Top sân", compact = false }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2.5, height: "100%" }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
          <StadiumIcon color="primary" fontSize="small" />
          <Typography variant="h6" fontWeight={700}>
            {title}
          </Typography>
        </Stack>

        {!rows.length ? (
          <DashboardEmptyState
            title="Chưa có dữ liệu sân"
            description="Thêm sân và booking để phân tích hiệu suất."
          />
        ) : (
          <TableContainer sx={{ maxHeight: compact ? 320 : 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {!compact && <TableCell>Hạng</TableCell>}
                  <TableCell>Sân</TableCell>
                  <TableCell align="right">Lượt đặt</TableCell>
                  {!compact && <TableCell align="right">Giờ SD</TableCell>}
                  <TableCell align="right">Doanh thu</TableCell>
                  <TableCell align="right">Lấp đầy</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.slice(0, compact ? 5 : rows.length).map((court) => (
                  <TableRow key={court.courtId || court.name} hover>
                    {!compact && (
                      <TableCell>
                        <Typography fontWeight="bold">#{court.rank}</Typography>
                      </TableCell>
                    )}
                    <TableCell>
                      <Typography fontWeight={court.isTopPerformer ? 700 : 500}>
                        {court.name}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{court.bookings}</TableCell>
                    {!compact && <TableCell align="right">{court.hours}h</TableCell>}
                    <TableCell align="right">{formatCurrency(court.revenue)}</TableCell>
                    <TableCell align="right">
                      {court.utilization}%
                      {court.isTopPerformer && (
                        <Chip size="small" color="success" label="Tốt" sx={{ ml: 0.5 }} />
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
