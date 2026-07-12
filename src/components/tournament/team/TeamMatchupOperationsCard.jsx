import { useMemo, useState } from "react";
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
import EditIcon from "@mui/icons-material/Edit";
import LockIcon from "@mui/icons-material/Lock";
import PublishIcon from "@mui/icons-material/Publish";
import ShuffleIcon from "@mui/icons-material/Shuffle";
import SportsIcon from "@mui/icons-material/Sports";
import SyncIcon from "@mui/icons-material/Sync";

import { getLineup } from "../../../features/team-tournament/models/index.js";
import { computeMatchupTieProgress } from "../../../features/team-tournament/engines/matchupTieEngine.js";
import {
  LINEUP_SOURCE,
  LINEUP_STATUS,
  DREAMBREAKER_STATUS,
  MATCHUP_STATUS,
} from "../../../features/team-tournament/constants.js";
import {
  NORMALIZED_MISSING_LINEUP_POLICY,
  resolveMatchupMissingLineupState,
} from "../../../features/team-tournament/engines/missingLineupPolicyEngine.js";
import {
  resolvePublishReadiness,
} from "../../../features/team-tournament/engines/atomicPublishWorkflowEngine.js";
import { isRepublishPending } from "../../../features/team-tournament/engines/overrideLineupWorkflowEngine.js";
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
    [LINEUP_STATUS.LOCKED, LINEUP_STATUS.PUBLISHED, LINEUP_STATUS.SUBMITTED].includes(
      lineup?.status
    );
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

function policyLabel(policy) {
  if (policy === NORMALIZED_MISSING_LINEUP_POLICY.FORFEIT_PENDING) {
    return "Chờ xử thua (TT-4)";
  }
  if (policy === NORMALIZED_MISSING_LINEUP_POLICY.MANUAL_PENDING) {
    return "Chờ BTC xử lý thủ công";
  }
  return "Random khi thiếu lineup";
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
  mutationBusy = false,
  serverTime = null,
  missingLineupPolicy,
  onLock,
  onRandomize,
  onPublish,
  onRequestOverride,
  onUpdateMatchup,
  onMessage,
  onError,
  onSyncDreambreaker,
  onLockDreambreaker,
}) {
  const [copyOk, setCopyOk] = useState(false);
  const [randomizingTeamId, setRandomizingTeamId] = useState("");
  const [clientNowMs] = useState(() => Date.now());
  const statusMeta = getMatchupStatusMeta(matchup.status);
  const tieProgress = computeMatchupTieProgress(teamData, matchup);
  const dreambreakerMeta = getDreambreakerStatusMeta(tieProgress.dreambreakerStatus);

  const serverTimeMs = serverTime ? new Date(serverTime).getTime() : clientNowMs;
  const lineupState = useMemo(
    () =>
      resolveMatchupMissingLineupState({
        teamData,
        matchup,
        policy: missingLineupPolicy ?? teamData.settings?.missingLineupPolicy,
        serverTimeMs,
      }),
    [teamData, matchup, missingLineupPolicy, serverTimeMs]
  );

  const canLockFromServer = matchup.canLock;
  const canLock =
    typeof canLockFromServer === "boolean"
      ? canLockFromServer
      : lineupState.canLock;
  const canRandomizeTeamIds = Array.isArray(matchup.canRandomizeTeamIds)
    ? matchup.canRandomizeTeamIds
    : lineupState.canRandomizeTeamIds;

  const publishReadiness = useMemo(
    () =>
      resolvePublishReadiness({
        teamData,
        matchup,
        policy: missingLineupPolicy ?? teamData.settings?.missingLineupPolicy,
      }),
    [teamData, matchup, missingLineupPolicy]
  );

  const canPublishFromServer = matchup.canPublish;
  const canPublish =
    typeof canPublishFromServer === "boolean"
      ? canPublishFromServer
      : publishReadiness.canPublish;
  const publishBlockMessage =
    matchup.publishBlockMessage || publishReadiness.blockMessage || null;
  const republishPending = isRepublishPending(matchup);
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

  async function handleRandomizeClick(teamId, teamName) {
    if (mutationBusy || randomizingTeamId) {
      return;
    }
    setRandomizingTeamId(teamId);
    try {
      await onRandomize?.(matchup.id, teamId, teamName);
    } finally {
      setRandomizingTeamId("");
    }
  }

  const missingTeamNames = lineupState.missingTeamIds.map((teamId) => {
    if (teamId === matchup.teamAId) {
      return teamA?.name || teamId;
    }
    if (teamId === matchup.teamBId) {
      return teamB?.name || teamId;
    }
    return teamId;
  });

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

        {canManage && republishPending ? (
          <Alert severity="warning">
            Lineup đã bị BTC thay đổi — cần công bố lại trước khi đội trưởng/trọng tài thấy đội hình mới.
          </Alert>
        ) : null}

        {canManage && matchup.status === MATCHUP_STATUS.LOCKED && !republishPending ? (
          <Alert severity={canPublish ? "success" : "warning"}>
            <Typography variant="body2">
              {canPublish
                ? "Sẵn sàng công bố — cả hai đội hình đã locked."
                : publishBlockMessage || "Chưa đủ điều kiện công bố."}
            </Typography>
          </Alert>
        ) : null}

        {canManage && republishPending && canPublish ? (
          <Alert severity="success">
            Sẵn sàng công bố lại — cả hai đội hình đã sẵn sàng sau override.
          </Alert>
        ) : null}

        {canManage && (matchup.status === MATCHUP_STATUS.LOCKED || republishPending) && !canPublish && republishPending ? (
          <Alert severity="warning">
            {publishBlockMessage || "Chưa đủ điều kiện công bố lại."}
          </Alert>
        ) : null}

        {isPublished && matchup.publishedAt && !republishPending ? (
          <Typography variant="body2" color="text.secondary">
            Đã công bố lúc: {formatTeamTournamentDateTime(matchup.publishedAt)}
          </Typography>
        ) : null}

        {canManage ? (
          <Alert severity={lineupState.deadlinePassed ? "warning" : "info"}>
            <Typography variant="body2">
              Chính sách thiếu lineup: <strong>{policyLabel(lineupState.policy)}</strong>
              {" · "}
              Hạn nộp: {formatTeamTournamentDateTime(matchup.lineupLockAt)}
              {lineupState.deadlinePassed ? " · Đã hết hạn" : " · Còn hạn"}
            </Typography>
            {missingTeamNames.length > 0 ? (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Đội chưa nộp: {missingTeamNames.join(", ")}
              </Typography>
            ) : (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Cả hai đội đã nộp đội hình.
              </Typography>
            )}
          </Alert>
        ) : null}

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
            {[matchup.teamAId, matchup.teamBId].map((teamId) => {
              const teamName =
                teamId === matchup.teamAId
                  ? teamA?.name || teamId
                  : teamB?.name || teamId;
              if (!onRequestOverride) {
                return null;
              }
              return (
                <Tooltip
                  key={`override-${teamId}`}
                  title="BTC thay đổi lineup (TT-3) — quyền do server quyết định"
                >
                  <span>
                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      startIcon={<EditIcon />}
                      disabled={mutationBusy}
                      onClick={() => onRequestOverride(matchup.id, teamId)}
                    >
                      Thay đổi {teamName}
                    </Button>
                  </span>
                </Tooltip>
              );
            })}
            {canRandomizeTeamIds.map((teamId) => {
              const teamName =
                teamId === matchup.teamAId
                  ? teamA?.name || teamId
                  : teamB?.name || teamId;
              const busy = mutationBusy || randomizingTeamId === teamId;
              return (
                <Tooltip
                  key={`random-${teamId}`}
                  title="Random đội hình trên server (TT-2D) — chỉ sau hạn nộp"
                >
                  <span>
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      startIcon={<ShuffleIcon />}
                      disabled={busy}
                      onClick={() => handleRandomizeClick(teamId, teamName)}
                    >
                      Random {teamName}
                    </Button>
                  </span>
                </Tooltip>
              );
            })}
            <Tooltip
              title={
                lineupState.policy === NORMALIZED_MISSING_LINEUP_POLICY.RANDOM
                  ? "Khóa khi đủ điều kiện server (canLock). Thiếu lineup sẽ được xử lý theo chính sách."
                  : "Khóa theo trạng thái server canLock"
              }
            >
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<LockIcon />}
                  onClick={() => onLock?.(matchup.id)}
                  disabled={!canLock || mutationBusy}
                >
                  Khóa đội hình
                </Button>
              </span>
            </Tooltip>
            <Tooltip
              title={
                canPublish
                  ? "Công bố đồng thời đội hình hai đội (atomic publish trên server)"
                  : publishBlockMessage || "Chưa đủ điều kiện công bố"
              }
            >
              <span>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<PublishIcon />}
                  onClick={() => onPublish?.(matchup.id)}
                  disabled={!canPublish || mutationBusy}
                >
                  {republishPending ? "Công bố lại" : "Công bố"}
                </Button>
              </span>
            </Tooltip>
          </Stack>
        ) : null}
      </Stack>
    </TournamentSectionCard>
  );
}
