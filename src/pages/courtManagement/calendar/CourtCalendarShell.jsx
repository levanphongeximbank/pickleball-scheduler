import { useMemo, useState } from "react";

import { Alert, Box, Snackbar, Typography } from "@mui/material";

import { loadCourtManagementSettings } from "../../../domain/courtManagementSettings.js";
import {
  getWeekDates,
  shiftIsoDate,
  shiftIsoMonth,
  timeToMinutes,
} from "../../../domain/courtBookingEngine.js";
import { filterCourtsByCluster } from "../../../features/court-cluster/services/courtClusterService.js";
import { isCourtClustersEnabled } from "../../../features/court-cluster/config/clusterFlags.js";
import BookingForm from "../BookingForm.jsx";
import BookingDetail from "../BookingDetail.jsx";
import { formatDisplayDate, todayIsoDate } from "../courtManagement.constants.js";
import CourtCalendarToolbar from "./CourtCalendarToolbar.jsx";
import CourtCalendarDayGrid from "./CourtCalendarDayGrid.jsx";
import CourtCalendarWeekMatrix from "./CourtCalendarWeekMatrix.jsx";
import CourtCalendarMonthBoard from "./CourtCalendarMonthBoard.jsx";

const MONTH_LABELS = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

function formatWeekdayDate(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);
  const weekdays = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  return `${weekdays[date.getDay()]}, ${formatDisplayDate(isoDate)}`;
}

export default function CourtCalendarShell({
  clubId,
  courts = [],
  bookings = [],
  revision = 0,
  onRefresh,
  clusters = [],
  previewMode = false,
  initialView = "day",
  initialDate = todayIsoDate(),
}) {
  const [view, setView] = useState(initialView);
  const [anchorDate, setAnchorDate] = useState(initialDate);
  const [activeClusterId, setActiveClusterId] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [formDefaults, setFormDefaults] = useState({});
  const [detailBooking, setDetailBooking] = useState(null);
  const [previewToast, setPreviewToast] = useState("");

  const settings = useMemo(
    () => loadCourtManagementSettings(clubId),
    [clubId, revision]
  );

  const filteredCourts = useMemo(() => {
    if (!isCourtClustersEnabled() || activeClusterId === "all") {
      return courts;
    }
    return filterCourtsByCluster(courts, activeClusterId);
  }, [courts, activeClusterId]);

  const clusterNameById = useMemo(() => {
    const map = {};
    clusters.forEach((cluster) => {
      map[cluster.id] = cluster.name;
    });
    return map;
  }, [clusters]);

  const dateLabel = useMemo(() => {
    if (view === "month") {
      const [year, month] = anchorDate.split("-").map(Number);
      return `${MONTH_LABELS[month - 1]} ${year}`;
    }

    if (view === "week") {
      const weekDates = getWeekDates(anchorDate);
      return `${formatDisplayDate(weekDates[0])} – ${formatDisplayDate(weekDates[6])}`;
    }

    return formatWeekdayDate(anchorDate);
  }, [anchorDate, view]);

  const kpiDate = view === "day" ? anchorDate : todayIsoDate();
  const isToday = anchorDate === todayIsoDate() && view === "day";
  const now = new Date();
  const nowSlotIndex = useMemo(() => {
    if (!isToday) {
      return -1;
    }
    const slots = [];
    for (let hour = settings.openHour; hour < settings.closeHour; hour += 1) {
      slots.push(`${String(hour).padStart(2, "0")}:00`);
    }
    const current = `${String(now.getHours()).padStart(2, "0")}:00`;
    return slots.findIndex((slot) => timeToMinutes(slot) <= timeToMinutes(current));
  }, [isToday, settings.openHour, settings.closeHour, now.getHours()]);

  const openCreateForm = (defaults = {}) => {
    if (previewMode) {
      setPreviewToast("Preview: mở form tạo booking (chưa ghi dữ liệu).");
      return;
    }
    setFormDefaults({
      date: view === "day" ? anchorDate : defaults.date || anchorDate,
      ...defaults,
    });
    setFormOpen(true);
  };

  const handlePrev = () => {
    if (view === "month") {
      setAnchorDate(shiftIsoMonth(anchorDate, -1));
      return;
    }
    if (view === "week") {
      setAnchorDate(shiftIsoDate(anchorDate, -7));
      return;
    }
    setAnchorDate(shiftIsoDate(anchorDate, -1));
  };

  const handleNext = () => {
    if (view === "month") {
      setAnchorDate(shiftIsoMonth(anchorDate, 1));
      return;
    }
    if (view === "week") {
      setAnchorDate(shiftIsoDate(anchorDate, 7));
      return;
    }
    setAnchorDate(shiftIsoDate(anchorDate, 1));
  };

  const handleToday = () => {
    setAnchorDate(todayIsoDate());
  };

  const handleEmptyCell = (court, slotTime) => {
    const endHour = String(Number(slotTime.slice(0, 2)) + 1).padStart(2, "0");
    openCreateForm({
      courtId: court.id,
      startTime: slotTime,
      endTime: `${endHour}:00`,
    });
  };

  const handleBookingClick = (booking) => {
    if (previewMode) {
      setPreviewToast(`Preview: ${booking.customerName} · ${booking.startTime}–${booking.endTime}`);
      return;
    }
    setDetailBooking(booking);
  };

  return (
    <Box>
      {previewMode && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight={700}>
            Bản xem trước thiết kế V5 — chưa áp dụng production
          </Typography>
          <Typography variant="caption">
            Dữ liệu giả trong bộ nhớ. Dùng để duyệt layout, màu sắc và tương tác.
          </Typography>
        </Alert>
      )}

      <CourtCalendarToolbar
        view={view}
        onViewChange={setView}
        anchorDate={anchorDate}
        dateLabel={dateLabel}
        onPrev={handlePrev}
        onToday={handleToday}
        onNext={handleNext}
        courts={filteredCourts}
        bookings={bookings}
        openHour={settings.openHour}
        closeHour={settings.closeHour}
        clusters={clusters}
        activeClusterId={activeClusterId}
        onClusterChange={setActiveClusterId}
        onCreateBooking={() => openCreateForm()}
        kpiDate={kpiDate}
      />

      {view === "month" ? (
        <CourtCalendarMonthBoard
          bookings={bookings}
          anchorDate={anchorDate}
          onEmptyDayClick={(date) => openCreateForm({ date })}
          onBookingClick={handleBookingClick}
        />
      ) : view === "week" ? (
        <CourtCalendarWeekMatrix
          courts={filteredCourts}
          bookings={bookings}
          anchorDate={anchorDate}
          openHour={settings.openHour}
          closeHour={settings.closeHour}
          onOpenDay={(date) => {
            setAnchorDate(date);
            setView("day");
          }}
          onBookingClick={handleBookingClick}
        />
      ) : (
        <CourtCalendarDayGrid
          courts={filteredCourts}
          bookings={bookings}
          selectedDate={anchorDate}
          openHour={settings.openHour}
          closeHour={settings.closeHour}
          slotMinutes={settings.slotMinutes}
          clusterNameById={clusterNameById}
          isToday={isToday}
          nowSlotIndex={nowSlotIndex}
          onEmptyCellClick={handleEmptyCell}
          onBookingClick={handleBookingClick}
        />
      )}

      {!previewMode && (
        <>
          <BookingForm
            open={formOpen}
            onClose={() => setFormOpen(false)}
            clubId={clubId}
            courts={filteredCourts}
            initialValues={formDefaults}
            onSaved={() => onRefresh?.()}
          />

          <BookingDetail
            open={Boolean(detailBooking)}
            booking={detailBooking}
            clubId={clubId}
            courts={filteredCourts}
            onClose={() => setDetailBooking(null)}
            onUpdated={() => {
              onRefresh?.();
              setDetailBooking(null);
            }}
          />
        </>
      )}

      <Snackbar
        open={Boolean(previewToast)}
        autoHideDuration={3000}
        onClose={() => setPreviewToast("")}
        message={previewToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
