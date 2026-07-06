import { useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LockIcon from "@mui/icons-material/Lock";
import PublishIcon from "@mui/icons-material/Publish";
import SportsIcon from "@mui/icons-material/Sports";
import SyncIcon from "@mui/icons-material/Sync";

import { getLineup } from "../../../features/team-tournament/models/index.js";
import { computeMatchupTieProgress } from "../../../features/team-tournament/engines/matchupTieEngine.js";
import {
  LINEUP_SOURCE,
  LINEUP_STATUS,
  DREAMBREAKER_STATUS,
  MATCHUP_STATUS,
  MISSING_LINEUP_POLICY,
} from "../../../features/team-tournament/constants.js";
import TournamentSectionCard from "../TournamentSectionCard.jsx";
import {
  buildCaptainPortalUrl,
  buildRefereePortalUrl,
  copyTextToClipboard,
} from "./copyPortalLink.js";
import {
  formatTeamTournamentDateTime,
  getDreambreakerStatusMeta,
  getLineupStatusMeta,
  getMatchupStatusMeta,
  MLP_TIE_RESOLUTION_LEGEND,
} from "./teamTournamentLabels.js";

function LineupProgressChip({ teamData, matchupId, teamId, teamName }) {
  const lineup = getLineup(teamData, matchupId, teamId);
  const meta = getLineupStatusMeta(lineup?.status);
  const isAutoRandom =
    lineup?.source === LINEUP_SOURCE.RANDOM &&
    [LINEUP_STATUS.LOCKED, LINEUP_STATUS.PUBLISHED].includes(lineup?.status);
  const statusLabel = isAutoRandom ? "Tự động sắp xếp" : meta.label;
  return (
    <Chip
      size="small"
      label={`${teamName}: ${statusLabel}`}
      color={isAutoRandom ? "warning" : meta.color}
      variant="outlined"
    />
  );
}

function toLocalInputValue(isoString) {
  if (!isoString) {
    return "";
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalInputValue(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function TeamMatchupOperationsCard({
  matchup,
  teamData,
  teamA,
  teamB,
  tournamentId,
  canManage,
  onLock,
  onPublish,
  onUpdateMatchup,
  onMessage,
  onError,
  onSyncDreambreaker,
  onLockDreambreaker,
}) {
  const [copyOk, setCopyOk] = useState(false);
  const statusMeta = getMatchupStatusMeta(matchup.status);
  const tieProgress = computeMatchupTieProgress(teamData, matchup);
  const dreambreakerMeta = getDreambreakerStatusMeta(tieProgress.dreambreakerStatus);
  const autoRandomizeMissingLineups =
    teamData.settings?.missingLineupPolicy !== MISSING_LINEUP_POLICY.FORFEIT;
  const canLock = [
    MATCHUP_STATUS.LINEUP_OPEN,
    MATCHUP_STATUS.SCHEDULED,
  ].includes(matchup.status);
  const canPublish = matchup.status === MATCHUP_STATUS.LOCKED;
  const isPublished = [
    MATCHUP_STATUS.PUBLISHED,
    MATCHUP_STATUS.IN_PROGRESS,
    MATCHUP_STATUS.COMPLETED,
  ].includes(matchup.status);
  const needsDreambreakerSync =
    tieProgress.needsDreambreaker &&
    (!matchup.dreambreaker ||
      matchup.dreambreaker.status === DREAMBREAKER_STATUS.PENDING);
  const canLockDreambreaker =
    matchup.dreambreaker?.status === DREAMBREAKER_STATUS.LINEUP_OPEN &&
    !matchup.dreambreaker?.ordersLockedAt;

  async function handleCopyPortalLink() {
    const url = buildCaptainPortalUrl(tournamentId);
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setCopyOk(true);
      onMessage?.("Đã sao chép link portal đội trưởng.");
      setTimeout(() => setCopyOk(false), 2000);
    } else {
      onError?.("Không sao chép được link.");
    }
  }

  function handleFieldChange(field, rawValue) {
    const value = field === "courtLabel" ? rawValue : fromLocalInputValue(rawValue);
    onUpdateMatchup?.(matchup.id, { [field]: value ?? (field === "courtLabel" ? "" : matchup[field]) });
  }

  return (
    <TournamentSectionCard
      title={`${teamA?.name || matchup.teamAId} vs ${teamB?.name || matchup.teamBId}`}
      badge={<Chip size="small" label={statusMeta.label} color={statusMeta.color} />}
      headerAction={
        isPublished ? (
          <Button
            size="small"
            variant="outlined"
            startIcon={<SportsIcon />}
            href={buildRefereePortalUrl(tournamentId, matchup.id)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Mở trọng tài
          </Button>
        ) : null
      }
    >
      <Stack spacing={2}>
        {canManage ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap flexWrap="wrap">
            <TextField
              size="small"
              label="Giờ thi đấu"
              type="datetime-local"
              value={toLocalInputValue(matchup.scheduledAt)}
              onChange={(event) => handleFieldChange("scheduledAt", event.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 200 }}
            />
            <TextField
              size="small"
              label="Hạn nộp đội hình"
              type="datetime-local"
              value={toLocalInputValue(matchup.lineupLockAt)}
              onChange={(event) => handleFieldChange("lineupLockAt", event.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 200 }}
            />
            <TextField
              size="small"
              label="Sân"
              value={matchup.courtLabel || ""}
              onChange={(event) => handleFieldChange("courtLabel", event.target.value)}
              sx={{ minWidth: 120 }}
            />
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Giờ thi đấu: {formatTeamTournamentDateTime(matchup.scheduledAt)}
            {" · "}
            Hạn nộp: {formatTeamTournamentDateTime(matchup.lineupLockAt)}
            {matchup.courtLabel ? ` · Sân ${matchup.courtLabel}` : ""}
          </Typography>
        )}

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <Tooltip title="Trận con thắng trong tie (đôi nữ, đôi nam, mixed×2)">
            <Chip
              size="small"
              variant="outlined"
              label={`Trận con ${tieProgress.scoreLabel}`}
              color={
                tieProgress.needsDreambreaker
                  ? "warning"
                  : tieProgress.tieDecided
                    ? "success"
                    : "default"
              }
            />
          </Tooltip>
          {tieProgress.dreambreakerEnabled && tieProgress.needsDreambreaker ? (
            <Chip
              size="small"
              label={dreambreakerMeta.label}
              color={dreambreakerMeta.color}
            />
          ) : null}
          {tieProgress.tieClinchedEarly ? (
            <Chip size="small" color="success" variant="outlined" label="Đã chốt tie" />
          ) : null}
        </Stack>

        {tieProgress.needsDreambreaker && !tieProgress.dreambreakerFinished ? (
          <Alert severity="warning">
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Bước tiếp theo: Dreambreaker — trận quyết định (đấu đơn luân lưu)
            </Typography>
            <Typography variant="body2">
              Tỷ số trận con 2–2. Đội trưởng nộp thứ tự 4 VĐV trên portal; trọng tài mở và ghi
              điểm Dreambreaker để chốt tie.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              <Button
                size="small"
                variant="outlined"
                href={buildCaptainPortalUrl(tournamentId)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Portal đội trưởng
              </Button>
              <Button
                size="small"
                variant="contained"
                href={buildRefereePortalUrl(tournamentId, matchup.id)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Dreambreaker — trọng tài
              </Button>
              {canManage && needsDreambreakerSync && onSyncDreambreaker ? (
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  startIcon={<SyncIcon />}
                  onClick={() => onSyncDreambreaker(matchup.id)}
                >
                  Đồng bộ Dreambreaker
                </Button>
              ) : null}
              {canManage && canLockDreambreaker && onLockDreambreaker ? (
                <Tooltip title="Đội chưa nộp thứ tự 4 VĐV sẽ được hệ thống tự sắp xếp">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<LockIcon />}
                    onClick={() => onLockDreambreaker(matchup.id)}
                  >
                    Khóa thứ tự DB
                  </Button>
                </Tooltip>
              ) : null}
            </Stack>
          </Alert>
        ) : tieProgress.dreambreakerEnabled && isPublished && !tieProgress.allMainDone ? (
          <Typography variant="caption" color="text.secondary">
            {MLP_TIE_RESOLUTION_LEGEND}
          </Typography>
        ) : null}

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <LineupProgressChip
            teamData={teamData}
            matchupId={matchup.id}
            teamId={matchup.teamAId}
            teamName={teamA?.name || "Đội A"}
          />
          <LineupProgressChip
            teamData={teamData}
            matchupId={matchup.id}
            teamId={matchup.teamBId}
            teamName={teamB?.name || "Đội B"}
          />
        </Stack>

        {canManage ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={handleCopyPortalLink}
            >
              {copyOk ? "Đã sao chép" : "Link đội trưởng"}
            </Button>
            <Tooltip
              title={
                autoRandomizeMissingLineups
                  ? "Đội chưa nộp đội hình sẽ được hệ thống tự sắp xếp VĐV theo nội dung thi đấu"
                  : "Đội chưa nộp đội hình sẽ bị từ chối khóa"
              }
            >
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<LockIcon />}
                  onClick={() => onLock?.(matchup.id)}
                  disabled={!canLock}
                >
                  Khóa đội hình
                </Button>
              </span>
            </Tooltip>
            <Button
              size="small"
              variant="contained"
              startIcon={<PublishIcon />}
              onClick={() => onPublish?.(matchup.id)}
              disabled={!canPublish}
            >
              Công bố
            </Button>
            {import.meta.env.DEV ? (
              <Tooltip title="Chỉ hiện khi dev — nộp demo nhanh">
                <Typography variant="caption" color="text.secondary">
                  Dùng portal đội trưởng thay vì demo
                </Typography>
              </Tooltip>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </TournamentSectionCard>
  );
}
