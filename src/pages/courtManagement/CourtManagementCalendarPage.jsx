import { useOutletContext } from "react-router-dom";

import { useCluster } from "../../context/ClusterContext.jsx";
import CourtCalendarShell from "./calendar/CourtCalendarShell.jsx";

export default function CourtManagementCalendarPage() {
  const { clubId, courts, bookings, revision, onRefresh } = useOutletContext();
  const { clusters } = useCluster();

  return (
    <CourtCalendarShell
      clubId={clubId}
      courts={courts}
      bookings={bookings}
      revision={revision}
      onRefresh={onRefresh}
      clusters={clusters}
    />
  );
}
