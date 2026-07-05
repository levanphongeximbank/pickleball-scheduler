import { useState } from "react";

import { Alert, Box, Stack, Typography } from "@mui/material";

import PermissionGate from "../../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { useClub } from "../../../context/ClubContext.jsx";
import BookingNotificationPanel from "../../../pages/courtManagement/BookingNotificationPanel.jsx";

export default function CrmBookingReminderPage() {
  const { activeClubId, revision, refreshClubs } = useClub();
  const clubId = activeClubId || "demo-club";
  const [message, setMessage] = useState(null);

  return (
    <PermissionGate permissions={[PERMISSIONS.BOOKING_VIEW, PERMISSIONS.CUSTOMER_VIEW]}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ mb: 1 }}>
          Nhắc booking
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Cấu hình nhắc booking sắp tới — dùng chung cài đặt với Vận hành sân.
        </Typography>

        {message && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message}
          </Alert>
        )}

        <Stack spacing={2}>
          <BookingNotificationPanel
            clubId={clubId}
            revision={revision}
            onSaved={() => {
              refreshClubs?.();
              setMessage("Đã lưu cài đặt nhắc booking.");
            }}
          />
        </Stack>
      </Box>
    </PermissionGate>
  );
}
