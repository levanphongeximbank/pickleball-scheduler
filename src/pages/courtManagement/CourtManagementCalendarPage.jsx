import { useOutletContext } from "react-router-dom";
import { Box } from "@mui/material";

import { useCluster } from "../../context/ClusterContext.jsx";
import { AuthPageHeader } from "../../features/web-app-ui/index.js";
import CourtCalendarShell from "./calendar/CourtCalendarShell.jsx";

export default function CourtManagementCalendarPage() {
  const { clubId, courts, bookings, revision, onRefresh } = useOutletContext();
  const { clusters } = useCluster();

  return (
    <Box>
      <AuthPageHeader
        title="Lịch sân"
        subtitle="Theo dõi lịch theo ngày, tuần hoặc tháng trong đúng phạm vi cụm sân và sân vật lý."
      />
      <CourtCalendarShell
        clubId={clubId}
        courts={courts}
        bookings={bookings}
        revision={revision}
        onRefresh={onRefresh}
        clusters={clusters}
        adoptAuthPatterns
      />
    </Box>
  );
}
