import { useMemo, useState } from "react";

import { Box, Grid, Typography } from "@mui/material";

import { setCourtOperationalStatus, updateBookingStatus } from "../../domain/bookingService.js";
import { isCanonicalCourtLiveRuntime } from "../../features/court-resource/constants/canonicalLiveRuntime.js";
import {
  COURT_OPERATIONAL_STATE,
  setCurrentOperationalState,
} from "../../features/court-resource/services/courtOperationsLiveRuntimeApplication.js";
import { buildCourtBoardData } from "../../utils/courtHelpers.js";
import { todayIsoDate } from "./courtManagement.constants.js";
import CourtCard from "../../components/courts/CourtCard.jsx";
import BookingForm from "./BookingForm.jsx";
import BookingDetail from "./BookingDetail.jsx";

/**
 * CourtStatusBoard
 *
 * Canonical path (flag ON + tenantId + physicalCourtId):
 *   lock / out-of-service toggles → Court Live Resource Runtime
 *   (current operational state NOW — not Resource Block, not Reservation)
 *
 * Legacy path (flag OFF or missing identity):
 *   indefinite court.status blob toggles remain compatibility until Batch 8.
 *
 * Durable timed MAINTENANCE / OPERATIONAL_BLOCK still use Resource Block API
 * (MaintenanceBookingPanel) — do not invent infinite Resource Blocks here.
 */
export default function CourtStatusBoard({
  clubId,
  tenantId = null,
  courts = [],
  bookings = [],
  onRefresh,
}) {
  const [formDefaults, setFormDefaults] = useState(null);
  const [detailBooking, setDetailBooking] = useState(null);
  const [canonicalNotice, setCanonicalNotice] = useState("");
  const today = todayIsoDate({ clubId });
  const now = useMemo(() => new Date(), [bookings, courts]);
  const useCanonicalLive =
    isCanonicalCourtLiveRuntime() && Boolean(tenantId);

  const boardData = useMemo(
    () => buildCourtBoardData(courts, bookings, now, { clubId }),
    [courts, bookings, now, clubId]
  );

  const applyCanonicalOperationalState = async (court, state) => {
    const physicalCourtId = court.physicalCourtId || null;
    if (!physicalCourtId || !tenantId) {
      setCanonicalNotice(
        "Canonical current operational state requires tenantId + physicalCourtId."
      );
      return false;
    }
    const result = await setCurrentOperationalState({
      tenantId,
      physicalCourtId,
      state,
      reason: state === COURT_OPERATIONAL_STATE.AVAILABLE
        ? "operator_cleared_current_state"
        : "operator_set_current_state",
      actorId: null,
      forceCanonical: true,
    });
    if (!result.ok) {
      setCanonicalNotice(result.message || result.code || "Live runtime update failed.");
      return false;
    }
    setCanonicalNotice("");
    onRefresh?.();
    return true;
  };

  // Canonical: Set current operational state (NOW only).
  // Legacy: indefinite court.status toggles stay on the blob board path.
  const handleLockToggle = async (court) => {
    if (useCanonicalLive && (court.physicalCourtId || null)) {
      const next =
        court.status === "locked"
          ? COURT_OPERATIONAL_STATE.AVAILABLE
          : COURT_OPERATIONAL_STATE.UNAVAILABLE_NOW;
      await applyCanonicalOperationalState(court, next);
      return;
    }
    const nextStatus = court.status === "locked" ? "active" : "locked";
    setCourtOperationalStatus(court.id, nextStatus, clubId);
    onRefresh?.();
  };

  const handleMaintenanceToggle = async (court) => {
    if (useCanonicalLive && (court.physicalCourtId || null)) {
      const next =
        court.status === "maintenance"
          ? COURT_OPERATIONAL_STATE.AVAILABLE
          : COURT_OPERATIONAL_STATE.OUT_OF_SERVICE_NOW;
      await applyCanonicalOperationalState(court, next);
      return;
    }
    const nextStatus = court.status === "maintenance" ? "active" : "maintenance";
    setCourtOperationalStatus(court.id, nextStatus, clubId);
    onRefresh?.();
  };

  const handleQuickStatus = async (booking, status) => {
    const result = await updateBookingStatus(booking.id, status, clubId);
    if (result.ok) onRefresh?.();
  };

  return (
    <Box>
      {useCanonicalLive ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          Current operational state (NOW) uses Court Live Resource Runtime.
          Schedule a resource block (timed window) via Maintenance / Resource Block — not these toggles.
          {canonicalNotice ? ` ${canonicalNotice}` : ""}
        </Typography>
      ) : null}

      <Grid container spacing={2}>
        {boardData.map((courtData) => (
          <Grid
            key={courtData.court.id}
            size={{ xs: 12, sm: 6, md: 4, xl: 3 }}
          >
            <CourtCard
              courtData={courtData}
              onCreateBooking={(court) =>
                setFormDefaults({
                  courtId: court.id,
                  physicalCourtId: court.physicalCourtId || null,
                  date: today,
                  customerType: "walk_in",
                  bookingType: "walk_in",
                })
              }
              onDetail={setDetailBooking}
              onQuickStatus={handleQuickStatus}
              onLockToggle={handleLockToggle}
              onMaintenanceToggle={handleMaintenanceToggle}
              canonicalCurrentState={useCanonicalLive}
            />
          </Grid>
        ))}
      </Grid>

      <BookingForm
        open={Boolean(formDefaults)}
        onClose={() => setFormDefaults(null)}
        clubId={clubId}
        tenantId={tenantId}
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
