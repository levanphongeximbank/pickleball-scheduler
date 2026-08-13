import { useState } from "react";

import {
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";

import { isCaptainAccessEnabled } from "../../../features/team-tournament/engines/captainAccessPolicy.js";
import {
  isCaptainAccessCloudWriterDeployed,
  setCaptainAccess,
} from "../../../features/team-tournament/services/captainAccessService.js";

/**
 * Organizer control: "Mở Portal đội trưởng".
 * Writes via team_tournament_set_captain_access then canonical silent reload (no F5).
 * Fail closed: keep prior UI state on RPC failure (Switch is controlled by teamData).
 */
export default function CaptainAccessToggle({
  canManage = false,
  tournamentId = "",
  teamData = null,
  expectedVersion = null,
  onUpdated = null,
}) {
  const enabled = isCaptainAccessEnabled(teamData);
  const writerReady = isCaptainAccessCloudWriterDeployed();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!canManage) {
    return null;
  }

  async function handleToggle(next) {
    setError("");
    if (!writerReady) {
      setError("Portal đội trưởng chưa sẵn sàng ghi (RPC).");
      return;
    }

    setBusy(true);
    try {
      const result = await setCaptainAccess({
        tournamentId,
        enabled: next,
        expectedVersion,
      });

      if (!result?.ok) {
        setError(result?.error || "Không thể cập nhật Portal đội trưởng.");
        return;
      }

      if (typeof onUpdated === "function") {
        await onUpdated(result);
      }
    } finally {
      setBusy(false);
    }
  }

  const helper = enabled
    ? "Đội trưởng có thể xem lịch của đội và xếp đội hình"
    : "Đội trưởng chưa thể truy cập";

  return (
    <FormControlLabel
      control={
        <Switch
          size="small"
          checked={enabled}
          disabled={busy || !writerReady}
          onChange={(event) => {
            void handleToggle(event.target.checked);
          }}
          inputProps={{ "aria-label": "Mở Portal đội trưởng" }}
        />
      }
      label={
        <Stack spacing={0}>
          <Typography variant="body2" fontWeight={600}>
            Mở Portal đội trưởng
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {helper}
          </Typography>
          {error ? (
            <Typography variant="caption" color="error">
              {error}
            </Typography>
          ) : null}
        </Stack>
      }
      sx={{ mr: 0, alignItems: "flex-start" }}
    />
  );
}
