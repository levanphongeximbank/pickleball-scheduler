import { Alert, Chip, Stack, Typography } from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";
import WifiIcon from "@mui/icons-material/Wifi";
import WifiOffIcon from "@mui/icons-material/WifiOff";

import { TT_REALTIME_CONNECTION } from "../realtime/realtimeConnectionState.js";
import { isTeamTournamentRealtimeEnabled } from "../realtime/realtimeFlags.js";
import {
  formatLastUpdateLabel,
  getRealtimeConnectionLabel,
  getRealtimeConnectionSeverity,
  shouldShowRealtimeBanner,
} from "./realtimeConnectionLabels.js";

/**
 * Shared TT realtime connection badge / banner (Vietnamese, no stack traces).
 */
export default function RealtimeConnectionStatus({
  connectionState = TT_REALTIME_CONNECTION.IDLE,
  isRealtime = false,
  isDegraded = false,
  pollingFallbackActive = false,
  lastSnapshotAt = null,
  subscriptionError = null,
  onReconnect,
  variant = "chip",
  showWhenConnected = false,
}) {
  const flagOn = isTeamTournamentRealtimeEnabled();
  const pollingOnly = !flagOn || pollingFallbackActive;
  const label = getRealtimeConnectionLabel(connectionState, { pollingOnly });
  const lastUpdate = formatLastUpdateLabel(lastSnapshotAt);
  const showBanner = variant === "banner" && shouldShowRealtimeBanner(connectionState, pollingOnly);
  const showChip =
    variant === "chip" &&
    (showWhenConnected ||
      pollingOnly ||
      connectionState !== TT_REALTIME_CONNECTION.CONNECTED ||
      isDegraded);

  if (!showBanner && !showChip) {
    return null;
  }

  const severity = subscriptionError?.code
    ? "error"
    : getRealtimeConnectionSeverity(connectionState);

  const icon =
    pollingOnly || isDegraded ? (
      <SyncIcon fontSize="small" />
    ) : connectionState === TT_REALTIME_CONNECTION.CONNECTED ? (
      <WifiIcon fontSize="small" />
    ) : (
      <WifiOffIcon fontSize="small" />
    );

  const meta = (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
      {lastUpdate ? (
        <Typography variant="caption" color="text.secondary">
          Cập nhật lần cuối: {lastUpdate}
        </Typography>
      ) : null}
      {subscriptionError?.error && !subscriptionError.error.includes("at ") ? (
        <Typography variant="caption" color="error">
          {subscriptionError.error}
        </Typography>
      ) : null}
    </Stack>
  );

  if (showBanner) {
    return (
      <Alert
        severity={severity}
        icon={icon}
        data-testid="tt-realtime-connection-banner"
        data-realtime-state={connectionState}
        data-realtime-active={isRealtime ? "true" : "false"}
        action={
          onReconnect ? (
            <Typography
              component="button"
              type="button"
              variant="caption"
              onClick={onReconnect}
              sx={{ cursor: "pointer", border: 0, background: "none", textDecoration: "underline" }}
            >
              Thử lại
            </Typography>
          ) : null
        }
        sx={{ mb: 1 }}
      >
        <Stack spacing={0.5}>
          <span>{label}</span>
          {meta}
        </Stack>
      </Alert>
    );
  }

  return (
    <Chip
      size="small"
      icon={icon}
      label={lastUpdate ? `${label} · ${lastUpdate}` : label}
      color={severity === "success" ? "success" : severity === "error" ? "error" : "default"}
      variant={connectionState === TT_REALTIME_CONNECTION.CONNECTED ? "outlined" : "filled"}
      data-testid="tt-realtime-connection-status"
      data-realtime-state={connectionState}
      data-realtime-active={isRealtime ? "true" : "false"}
      onClick={onReconnect && isDegraded ? onReconnect : undefined}
      sx={{ maxWidth: "100%" }}
    />
  );
}
