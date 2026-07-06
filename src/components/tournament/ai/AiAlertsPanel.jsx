import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { detectCourtOverload } from "../../../features/ai-assistant/engines/courtOverloadDetector.js";
import { detectScheduleConflicts } from "../../../features/ai-assistant/engines/scheduleConflictDetector.js";
import { isAiEngineEnabled } from "../../../features/ai-assistant/constants/aiConfig.js";
import { loadBookingsForClub, loadCourtsForClub } from "../../../domain/clubStorage.js";
import { useClub } from "../../../context/ClubContext.jsx";
import { useTenant } from "../../../context/TenantContext.jsx";
import { getActiveSession } from "../../../features/court-engine/services/courtSessionService.js";
import { getActiveQueueEntries } from "../../../features/court-engine/services/queueService.js";

export default function AiAlertsPanel({ focus = "" }) {
  const { activeClubId } = useClub();
  const { currentTenantId } = useTenant();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const activeCourts = useMemo(() => {
    if (!activeClubId) {
      return [];
    }
    return loadCourtsForClub(activeClubId).filter((court) => court.active !== false);
  }, [activeClubId]);

  const courtEngineQueue = useMemo(() => {
    if (!activeClubId || !currentTenantId) {
      return [];
    }
    const session = getActiveSession(activeClubId, { tenantId: currentTenantId });
    return session ? getActiveQueueEntries(session) : [];
  }, [activeClubId, currentTenantId]);

  const bookings = useMemo(() => {
    if (!activeClubId) {
      return [];
    }
    return (loadBookingsForClub(activeClubId) || []).filter(
      (item) => String(item.date || "").slice(0, 10) === date
    );
  }, [activeClubId, date]);

  const scheduleResult = useMemo(
    () =>
      detectScheduleConflicts({
        date,
        bookings: bookings.map((b) => ({
          id: b.id,
          date: b.date,
          courtName: b.courtName || b.courtId,
          startTime: b.startTime,
          endTime: b.endTime,
        })),
      }),
    [date, bookings]
  );

  const overloadResult = useMemo(
    () =>
      detectCourtOverload({
        date,
        courtCount: Math.max(activeCourts.length, 1),
        bookings: bookings.map((b) => ({
          date: b.date,
          startTime: b.startTime,
          endTime: b.endTime,
        })),
      }),
    [date, bookings, activeCourts.length]
  );

  if (!isAiEngineEnabled()) {
    return (
      <Alert severity="info">
        Trợ lý thông minh chưa bật. Đặt <code>VITE_ENABLE_AI_ENGINE=true</code> trên môi trường staging/production sau khi QA cloud pass.
      </Alert>
    );
  }

  const showSchedule = !focus || focus === "schedule-conflict";
  const showOverload = !focus || focus === "court-overload";

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Cảnh báo vận hành</Typography>
      <TextField
        label="Ngày kiểm tra"
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
        InputLabelProps={{ shrink: true }}
        size="small"
        sx={{ maxWidth: 220 }}
      />

      {courtEngineQueue.length > 0 && (
        <Alert severity="info">
          Court Engine: {courtEngineQueue.length} người đang chờ sân ({activeCourts.length} sân hoạt động).
        </Alert>
      )}

      {showSchedule && (
        <Box>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Trùng lịch sân
          </Typography>
          {scheduleResult.data.issues.length === 0 ? (
            <Alert severity="success">Không phát hiện trùng lịch.</Alert>
          ) : (
            scheduleResult.data.issues.map((issue) => (
              <Alert key={issue.id || issue.message} severity="warning" sx={{ mb: 1 }}>
                {issue.message || issue.summary}
              </Alert>
            ))
          )}
        </Box>
      )}

      {showOverload && (
        <Box>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Quá tải sân ({activeCourts.length} sân)
          </Typography>
          {overloadResult.data.issues.length === 0 ? (
            <Alert severity="success">Mức sử dụng sân trong ngưỡng an toàn.</Alert>
          ) : (
            overloadResult.data.issues.map((issue) => (
              <Alert key={issue.id || issue.message} severity="error" sx={{ mb: 1 }}>
                {issue.message || issue.summary}
              </Alert>
            ))
          )}
        </Box>
      )}

      <Button variant="outlined" size="small" onClick={() => setDate(new Date().toISOString().slice(0, 10))}>
        Hôm nay
      </Button>
    </Stack>
  );
}
