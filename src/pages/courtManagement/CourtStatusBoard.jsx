import { useMemo, useState } from "react";

import { Box, Grid } from "@mui/material";

import { setCourtOperationalStatus, updateBookingStatus } from "../../domain/bookingService.js";
import { buildCourtBoardData } from "../../utils/courtHelpers.js";
import { todayIsoDate } from "./courtManagement.constants.js";
import CourtCard from "../../components/courts/CourtCard.jsx";
import BookingForm from "./BookingForm.jsx";
import BookingDetail from "./BookingDetail.jsx";

export default function CourtStatusBoard({
  clubId,
  courts = [],
  bookings = [],
  onRefresh,
}) {
  const [formDefaults, setFormDefaults] = useState(null);
  const [detailBooking, setDetailBooking] = useState(null);
  const today = todayIsoDate({ clubId });
  const now = useMemo(() => new Date(), [bookings, courts]);

  const boardData = useMemo(
    () => buildCourtBoardData(courts, bookings, now, { clubId }),
    [courts, bookings, now, clubId]
  );

  const handleLockToggle = (court) => {
    const nextStatus = court.status === "locked" ? "active" : "locked";
    setCourtOperationalStatus(court.id, nextStatus, clubId);
    onRefresh?.();
  };

  const handleMaintenanceToggle = (court) => {
    const nextStatus = court.status === "maintenance" ? "active" : "maintenance";
    setCourtOperationalStatus(court.id, nextStatus, clubId);
    onRefresh?.();
  };

  const handleQuickStatus = (booking, status) => {
    const result = updateBookingStatus(booking.id, status, clubId);
    if (result.ok) onRefresh?.();
  };

  return (
    <Box>
      <Grid container spacing={2}>
        {boardData.map((courtData) => (
          <Grid
            key={courtData.court.id}
            size={{ xs: 12, sm: 6, md: 4, xl: 3 }}
          >
            <CourtCard
              courtData={courtData}
              onCreateBooking={(court) => setFormDefaults({ courtId: court.id, date: today })}
              onDetail={setDetailBooking}
              onQuickStatus={handleQuickStatus}
              onLockToggle={handleLockToggle}
              onMaintenanceToggle={handleMaintenanceToggle}
            />
          </Grid>
        ))}
      </Grid>

      <BookingForm
        open={Boolean(formDefaults)}
        onClose={() => setFormDefaults(null)}
        clubId={clubId}
        courts={courts}
        initialValues={formDefaults || {}}
        onSaved={() => {
          setFormDefaults(null);
          onRefresh?.();
        }}
      />

      <BookingDetail
        open={Boolean(detailBooking)}
        booking={detailBooking}
        clubId={clubId}
        courts={courts}
        onClose={() => setDetailBooking(null)}
        onUpdated={() => {
          onRefresh?.();
          setDetailBooking(null);
        }}
      />
    </Box>
  );
}
