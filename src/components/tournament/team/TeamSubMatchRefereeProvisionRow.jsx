import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Button,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SportsIcon from "@mui/icons-material/Sports";
import SyncIcon from "@mui/icons-material/Sync";

import {
  buildProvisionCommandPayload,
  buildResyncLinkPayload,
  buildRevokeLinkPayload,
  canProvisionRefereeLink,
  canResyncRefereeLink,
  canRevokeRefereeLink,
  summarizeRefereeLinkStatus,
} from "../../../features/team-tournament/engines/teamRefereeV5BridgeEngine.js";

export default function TeamSubMatchRefereeProvisionRow({
  subMatch,
  matchupId,
  busy = false,
  onProvision,
  onResync,
  onRevoke,
  onError,
}) {
  const linkOps = subMatch.refereeLinkOps || {};
  const statusMeta = summarizeRefereeLinkStatus(linkOps);
  const assignmentId =
    linkOps.suggestedAssignmentId ||
    linkOps.refereeAssignmentId ||
    linkOps.eligibility?.suggestedAssignmentId ||
    null;

  async function handleProvision() {
    if (!canProvisionRefereeLink(linkOps)) {
      onError?.(linkOps.blockMessage || "Chưa đủ điều kiện provision.");
      return;
    }
    if (!assignmentId) {
      onError?.("Cần phân công trọng tài trước khi tạo phiên Referee V5.");
      return;
    }
    await onProvision?.(
      buildProvisionCommandPayload({
        matchupId,
        subMatchId: subMatch.id,
        refereeAssignmentId: assignmentId,
        subMatchVersion: subMatch.version,
      })
    );
  }

  async function handleResync() {
    if (!canResyncRefereeLink(linkOps)) {
      return;
    }
    await onResync?.(
      buildResyncLinkPayload({
        subMatchId: subMatch.id,
        linkVersion: linkOps.version,
      })
    );
  }

  async function handleRevoke() {
    if (!canRevokeRefereeLink(linkOps)) {
      return;
    }
    await onRevoke?.(
      buildRevokeLinkPayload({
        subMatchId: subMatch.id,
        reason: "TT-5C BTC revoke",
        linkVersion: linkOps.version,
      })
    );
  }

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      alignItems={{ xs: "stretch", sm: "center" }}
      sx={{ py: 0.75, borderTop: "1px dashed", borderColor: "divider" }}
    >
      <Typography variant="body2" sx={{ minWidth: 120, fontWeight: 600 }}>
        {subMatch.disciplineId || subMatch.id}
      </Typography>
      <Chip size="small" label={statusMeta.label} color={statusMeta.tone === "error" ? "error" : statusMeta.tone === "warning" ? "warning" : statusMeta.tone === "success" ? "success" : "default"} />
      {linkOps.blockMessage && !linkOps.hasLink ? (
        <Typography variant="caption" color="text.secondary">
          {linkOps.blockMessage}
        </Typography>
      ) : null}
      {linkOps.hasLink && linkOps.snapshotStale ? (
        <Alert severity="warning" sx={{ py: 0, flex: 1 }}>
          Lineup đã thay đổi — cần resync trước khi tiếp tục.
        </Alert>
      ) : null}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {canProvisionRefereeLink(linkOps) ? (
          <Button
            size="small"
            variant="contained"
            startIcon={<SportsIcon />}
            disabled={busy || !assignmentId}
            onClick={handleProvision}
          >
            Tạo phiên trọng tài
          </Button>
        ) : null}
        {linkOps.canOpenWorkspace && linkOps.route ? (
          <Button
            size="small"
            variant="outlined"
            component={RouterLink}
            to={linkOps.route}
            target="_blank"
            startIcon={<OpenInNewIcon />}
          >
            Mở Referee V5
          </Button>
        ) : null}
        {canResyncRefereeLink(linkOps) ? (
          <Button
            size="small"
            variant="outlined"
            color="warning"
            startIcon={<SyncIcon />}
            disabled={busy}
            onClick={handleResync}
          >
            Resync
          </Button>
        ) : null}
        {canRevokeRefereeLink(linkOps) ? (
          <Button size="small" variant="text" color="inherit" disabled={busy} onClick={handleRevoke}>
            Revoke
          </Button>
        ) : null}
      </Stack>
    </Stack>
  );
}
