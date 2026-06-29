import { useOutletContext } from "react-router-dom";

import { Stack } from "@mui/material";

import TournamentCourtScheduleManager from "../../components/tournament/TournamentCourtScheduleManager.jsx";
import AutoCompleteBookingsPanel from "./AutoCompleteBookingsPanel.jsx";
import BookingNotificationPanel from "./BookingNotificationPanel.jsx";
import CourtAvailabilityPanel from "./CourtAvailabilityPanel.jsx";
import CourtManagementSettingsPanel from "./CourtManagementSettingsPanel.jsx";
import MaintenanceBookingPanel from "./MaintenanceBookingPanel.jsx";
import PeakHourPricingPanel from "./PeakHourPricingPanel.jsx";
import RecurringBookingPanel from "./RecurringBookingPanel.jsx";
import SocialPlayPanel from "./SocialPlayPanel.jsx";
import CourtManagementExportPanel from "./CourtManagementExportPanel.jsx";

export default function CourtManagementFuturePage() {
  const { clubId, courts, bookings, onRefresh, revision } = useOutletContext();

  return (
    <Stack spacing={2}>
      <CourtManagementSettingsPanel clubId={clubId} revision={revision} onSaved={onRefresh} />
      <CourtAvailabilityPanel
        clubId={clubId}
        courts={courts}
        bookings={bookings}
        onSaved={onRefresh}
      />
      <PeakHourPricingPanel clubId={clubId} revision={revision} onSaved={onRefresh} />
      <BookingNotificationPanel clubId={clubId} revision={revision} onSaved={onRefresh} />
      <AutoCompleteBookingsPanel clubId={clubId} onSaved={onRefresh} />
      <MaintenanceBookingPanel clubId={clubId} courts={courts} onSaved={onRefresh} />
      <SocialPlayPanel clubId={clubId} courts={courts} onSaved={onRefresh} />
      <RecurringBookingPanel clubId={clubId} courts={courts} onSaved={onRefresh} />
      <TournamentCourtScheduleManager
        clubId={clubId}
        courts={courts}
        revision={revision}
        onSaved={onRefresh}
      />
      <CourtManagementExportPanel clubId={clubId} onImported={onRefresh} />
    </Stack>
  );
}
