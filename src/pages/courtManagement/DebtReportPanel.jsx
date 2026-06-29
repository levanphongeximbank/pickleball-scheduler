import { useMemo } from "react";

import {
  Box,
  Card,
  CardContent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import { computeDebtSummary, formatCurrency } from "../../domain/courtBookingEngine.js";
import { getRemainingAmount } from "../../models/booking.js";
import { formatDisplayDate, formatTimeRange } from "./courtManagement.constants.js";

export default function DebtReportPanel({ bookings = [], onOpenBooking }) {
  const summary = useMemo(() => computeDebtSummary(bookings), [bookings]);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">Công nợ booking</Typography>
            <Typography variant="body2" color="text.secondary">
              {summary.bookingCount} booking còn nợ · Tổng {formatCurrency(summary.totalDebt)} đ
            </Typography>
          </Box>

          {summary.bookings.length === 0 ? (
            <Typography color="text.secondary">Không có công nợ.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Khách</TableCell>
                  <TableCell>Sân</TableCell>
                  <TableCell>Thời gian</TableCell>
                  <TableCell align="right">Còn nợ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summary.bookings.map((booking) => {
                  const remaining = getRemainingAmount(booking.totalAmount, booking.paidAmount);

                  return (
                    <TableRow
                      key={booking.id}
                      hover
                      sx={{ cursor: onOpenBooking ? "pointer" : "default" }}
                      onClick={() => onOpenBooking?.(booking)}
                    >
                      <TableCell>{booking.customerName}</TableCell>
                      <TableCell>{booking.courtName}</TableCell>
                      <TableCell>
                        {formatDisplayDate(booking.date)}
                        {" · "}
                        {formatTimeRange(booking.startTime, booking.endTime)}
                      </TableCell>
                      <TableCell align="right">
                        <Typography color="error.main" fontWeight="medium">
                          {formatCurrency(remaining)} đ
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
