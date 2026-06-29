import { useOutletContext } from "react-router-dom";

import BookingList from "./BookingList.jsx";

export default function CourtManagementBookingsPage() {
  const { clubId, courts, bookings, onRefresh } = useOutletContext();

  return (
    <BookingList
      clubId={clubId}
      courts={courts}
      bookings={bookings}
      onRefresh={onRefresh}
    />
  );
}
