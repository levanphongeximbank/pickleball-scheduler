import { useState } from "react";

import { Alert, Box, Stack, Typography } from "@mui/material";

import PermissionGate from "../../../components/auth/PermissionGate.jsx";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { useClub } from "../../../context/ClubContext.jsx";
import BookingNotificationPanel from "../../../pages/courtManagement/BookingNotificationPanel.jsx";
import { CRM_LEGACY_RUNTIME_MODE } from "../runtime/constants.js";
import {
  CrmLegacyDemoBanner,
  CrmLegacyMissingClubState,
  CrmLegacyUnavailableState,
} from "../runtime/CrmLegacyStateViews.jsx";
import { useCrmLegacyRuntime } from "../runtime/useCrmLegacyRuntime.js";

export default function CrmBookingReminderPage() {
  const { activeClubId, revision, refreshClubs } = useClub();
  const { runtime, retry } = useCrmLegacyRuntime(activeClubId);
  const [message, setMessage] = useState(null);

  return (
    <PermissionGate permissions={[PERMISSIONS.BOOKING_VIEW, PERMISSIONS.CUSTOMER_VIEW]}>
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h5" sx={{ mb: 1 }}>
          Nhắc booking
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Cấu hình nhắc booking sắp tới — dùng chung cài đặt với Vận hành sân.
        </Typography>

        {runtime.mode === CRM_LEGACY_RUNTIME_MODE.UNAVAILABLE ? (
          <CrmLegacyUnavailableState
            message={runtime.userMessage}
            code={runtime.code}
            onRetry={retry}
          />
        ) : null}

        {runtime.mode === CRM_LEGACY_RUNTIME_MODE.MISSING_SCOPE ? (
          <CrmLegacyMissingClubState message={runtime.userMessage} />
        ) : null}

        {runtime.mode === CRM_LEGACY_RUNTIME_MODE.LEGACY_LOCAL ? (
          <>
            <CrmLegacyDemoBanner text={runtime.demoBanner} />

            {message && (
              <Alert severity="info" sx={{ mb: 2 }} onClose={() => setMessage(null)}>
                {message}
              </Alert>
            )}

            <Stack spacing={2}>
              <BookingNotificationPanel
                clubId={runtime.clubId}
                revision={revision}
                onSaved={() => {
                  refreshClubs?.();
                  setMessage("Đã lưu cài đặt nhắc booking (theo CLB đang chọn — chế độ tương thích).");
                }}
              />
            </Stack>
          </>
        ) : null}
      </Box>
    </PermissionGate>
  );
}
