import { useOutletContext } from "react-router-dom";

import BookingList from "./BookingList.jsx";

export default function CourtManagementBookingsPage() {
  const { clubId, tenantId, courts, bookings, onRefresh } = useOutletContext();

  return (
    <BookingList
      clubId={clubId}
      tenantId={tenantId}
      courts={courts}
      bookings={bookings}
      onRefresh={onRefresh}
    />
  );
}
