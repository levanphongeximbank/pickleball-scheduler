import { useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";

import { Box, Tab, Tabs } from "@mui/material";

import CourtCalendarDayView from "./CourtCalendarDayView.jsx";
import CourtCalendarWeekView from "./CourtCalendarWeekView.jsx";
import CourtCalendarMonthView from "./CourtCalendarMonthView.jsx";

export default function CourtManagementCalendarPage() {
  const { clubId, courts, bookings, revision, onRefresh } = useOutletContext();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState("day");
  const focusToday = searchParams.get("date") === "today";

  return (
    <Box>
      <Tabs value={view} onChange={(_, value) => setView(value)} sx={{ mb: 2 }}>
        <Tab value="day" label="Theo ngày" sx={{ textTransform: "none" }} />
        <Tab value="week" label="Theo tuần" sx={{ textTransform: "none" }} />
        <Tab value="month" label="Theo tháng" sx={{ textTransform: "none" }} />
      </Tabs>

      {view === "month" ? (
        <CourtCalendarMonthView
          clubId={clubId}
          courts={courts}
          bookings={bookings}
          onRefresh={onRefresh}
        />
      ) : view === "week" ? (
        <CourtCalendarWeekView
          clubId={clubId}
          courts={courts}
          bookings={bookings}
          onRefresh={onRefresh}
        />
      ) : (
        <CourtCalendarDayView
          clubId={clubId}
          courts={courts}
          bookings={bookings}
          revision={revision}
          onRefresh={onRefresh}
        />
      )}
    </Box>
  );
}
