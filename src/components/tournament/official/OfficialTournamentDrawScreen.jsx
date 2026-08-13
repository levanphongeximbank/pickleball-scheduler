import { useMemo, useState } from "react";
import { Alert, Button, Chip, Stack, Typography } from "@mui/material";

import {
  buildOfficialDrawBlockMessage,
  summarizeOfficialEntries,
} from "../../../features/individual-tournament/engines/officialOrganizerWorkflowEngine.js";
import {
  getOfficialCompetitionSettings,
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_REGISTRATION_MODE_LABELS,
} from "../../../features/individual-tournament/engines/officialTournamentSettingsEngine.js";
import { OFFICIAL_MODE } from "../../../models/tournament/constants.js";

/**
 * Professional one-button draw surface.
 * PAIR: group draw only. INDIVIDUAL: pair formation then group draw (caller orchestrates).
 */
export default function OfficialTournamentDrawScreen({
  tournament,
  eventId = "",
  groupCount = 1,
  canManage = true,
  onStartDraw,
  drawBusy = false,
}) {
  const competition = useMemo(() => getOfficialCompetitionSettings(tournament), [tournament]);
  const summary = useMemo(
    () => summarizeOfficialEntries(tournament, eventId),
    [tournament, eventId]
  );
  const entries =
    tournament?.events?.find((e) => String(e.id) === String(eventId))?.entries ||
    tournament?.events?.[0]?.entries ||
    [];
  const gate = buildOfficialDrawBlockMessage(entries, tournament, 2);
  const isIndividual = competition.registrationMode === OFFICIAL_REGISTRATION_MODE.INDIVIDUAL;
  const strategy =
    tournament?.officialMode === OFFICIAL_MODE.AI_BALANCE
      ? "AI Balance (seed/rating)"
      : "Open (random có điều kiện)";
  const [localError, setLocalError] = useState(null);

  const handleClick = async () => {
    setLocalError(null);
    if (!gate.ok) {
      setLocalError(gate.error);
      return;
    }
    const result = await onStartDraw?.({
      registrationMode: competition.registrationMode,
      eligible: gate.eligible,
    });
    if (result && result.ok === false) {
      setLocalError(result.error || "Bốc thăm thất bại.");
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip color="primary" label={OFFICIAL_REGISTRATION_MODE_LABELS[competition.registrationMode]} />
        <Chip label={strategy} variant="outlined" />
        <Chip label={`${summary.drawEligibleCount} đủ điều kiện`} />
        <Chip label={`${groupCount} bảng`} />
      </Stack>

      {isIndividual ? (
        <Typography variant="body2">
          Tiến trình: <strong>1. Ghép cặp</strong> → <strong>2. Chia bảng</strong>
        </Typography>
      ) : (
        <Typography variant="body2">
          Cặp đã cố định — chỉ <strong>chia bảng</strong>, không tách cặp.
        </Typography>
      )}

      {!gate.ok ? <Alert severity="warning">{gate.error}</Alert> : (
        <Alert severity="success">
          {summary.drawEligibleCount} đơn vị sẵn sàng bốc thăm.
        </Alert>
      )}
      {localError ? <Alert severity="error">{localError}</Alert> : null}

      <Button
        variant="contained"
        size="large"
        disabled={!canManage || !gate.ok || drawBusy}
        onClick={handleClick}
      >
        {drawBusy ? "Đang bốc thăm…" : "Bắt đầu bốc thăm"}
      </Button>
    </Stack>
  );
}
