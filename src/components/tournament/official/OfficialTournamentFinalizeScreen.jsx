import { useMemo } from "react";
import { Alert, Button, Chip, Stack, Typography } from "@mui/material";

import {
  summarizeOfficialEntries,
  buildOfficialDrawBlockMessage,
} from "../../../features/individual-tournament/engines/officialOrganizerWorkflowEngine.js";
import {
  getOfficialCompetitionSettings,
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_REGISTRATION_MODE_LABELS,
} from "../../../features/individual-tournament/engines/officialTournamentSettingsEngine.js";
import { isRegistrationLocked } from "../../../features/individual-tournament/engines/registrationEngine.js";

/**
 * Participant finalization — derived projection, no duplicate persisted list.
 */
export default function OfficialTournamentFinalizeScreen({
  tournament,
  eventId = "",
  canManage = true,
  onLockRegistration,
}) {
  const competition = useMemo(() => getOfficialCompetitionSettings(tournament), [tournament]);
  const summary = useMemo(
    () => summarizeOfficialEntries(tournament, eventId),
    [tournament, eventId]
  );
  const locked = isRegistrationLocked(tournament);
  const gate = buildOfficialDrawBlockMessage(
    tournament?.events?.find((e) => String(e.id) === String(eventId))?.entries ||
      tournament?.events?.[0]?.entries ||
      [],
    tournament,
    2
  );
  const unitLabel =
    competition.registrationMode === OFFICIAL_REGISTRATION_MODE.PAIR ? "cặp" : "VĐV";

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip label={OFFICIAL_REGISTRATION_MODE_LABELS[competition.registrationMode]} />
        <Chip color="success" label={`Hợp lệ: ${summary.drawEligibleCount} ${unitLabel}`} />
        <Chip color="warning" label={`Chờ duyệt: ${summary.pending}`} />
        <Chip label={`Không hợp lệ/rút: ${summary.rejected + summary.withdrawn + summary.cancelled}`} />
      </Stack>

      <Typography variant="body2" color="text.secondary">
        Đăng ký nhận được: {summary.total} · Đủ điều kiện: {summary.drawEligibleCount} · Chưa hoàn tất:{" "}
        {summary.pending + summary.waitlisted}
      </Typography>

      {!gate.ok ? <Alert severity="warning">{gate.error}</Alert> : null}
      {locked ? (
        <Alert severity="success">Đã chốt đăng ký. Có thể chuyển sang bốc thăm.</Alert>
      ) : (
        <Alert severity="info">
          Chốt VĐV khóa hồ sơ mới và dùng danh sách đủ điều kiện làm đầu vào bốc thăm.
        </Alert>
      )}

      <Button
        variant="contained"
        disabled={!canManage || locked || !gate.ok}
        onClick={onLockRegistration}
      >
        {locked ? "Đã chốt" : "Chốt vận động viên"}
      </Button>
    </Stack>
  );
}
