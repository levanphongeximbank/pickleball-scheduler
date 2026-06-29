import { useOutletContext } from "react-router-dom";

import RevenueSummary from "./RevenueSummary.jsx";

export default function CourtManagementRevenuePage() {
  const { clubId, courts, bookings, revision, onRefresh } = useOutletContext();

  return (
    <RevenueSummary
      bookings={bookings}
      clubId={clubId}
      courts={courts}
      revision={revision}
      onRefresh={onRefresh}
    />
  );
}
