import { useMemo } from "react";

import { Box, Typography } from "@mui/material";

import CourtCalendarShell from "./CourtCalendarShell.jsx";
import {
  PREVIEW_BOOKINGS,
  PREVIEW_CLUSTERS,
  PREVIEW_COURTS,
  getPreviewAnchorDate,
} from "./courtCalendarPreviewData.js";

export default function CourtCalendarPreviewPage() {
  const anchorDate = getPreviewAnchorDate();

  const bookings = useMemo(() => [...PREVIEW_BOOKINGS], []);
  const courts = useMemo(() => [...PREVIEW_COURTS], []);
  const clusters = useMemo(() => [...PREVIEW_CLUSTERS], []);

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5 }}>
        Lịch sân — Preview thiết kế V5
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Theo ngày / tuần / tháng với dữ liệu mẫu. Route: /court-management/calendar/preview
      </Typography>

      <CourtCalendarShell
        clubId="preview-club"
        courts={courts}
        bookings={bookings}
        clusters={clusters}
        previewMode
        initialDate={anchorDate}
      />
    </Box>
  );
}
