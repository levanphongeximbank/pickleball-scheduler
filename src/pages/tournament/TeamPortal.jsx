import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LockIcon from "@mui/icons-material/Lock";
import SaveIcon from "@mui/icons-material/Save";
import SendIcon from "@mui/icons-material/Send";
import VisibilityIcon from "@mui/icons-material/Visibility";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import { loadPlayersForClub } from "../../domain/clubStorage.js";
import { assertTournamentAccess, getTournament } from "../../domain/tournamentService.js";
import {
  LINEUP_STATUS,
  MATCHUP_STATUS,
} from "../../features/team-tournament/constants.js";
import {
  buildOfficialPairings,
  getVisibleLineup,
} from "../../features/team-tournament/engines/lineupEngine.js";
import {
  filterEligiblePlayersForDiscipline,
  validateLineupSelections,
} from "../../features/team-tournament/engines/lineupValidationEngine.js";
import {
  findTeamForCaptain,
  getOpponentTeamId,
  isTeamCaptain,
  listMatchupsForTeam,
  partitionMatchupsForPortal,
} from "../../features/team-tournament/engines/teamPermissionEngine.js";
import {
  getTeamData,
  isTeamTournament,
} from "../../features/team-tournament/engines/teamTournamentEngine.js";
import { findTeam, getLineup } from "../../features/team-tournament/models/index.js";
import {
  captainSaveLineup,
  captainSubmitLineup,
} from "../../features/team-tournament/services/teamTournamentService.js";

const LINEUP_STATUS_LABEL = {
  [LINEUP_STATUS.NOT_SUBMITTED]: { label: "Chưa nộp", color: "default" },
  [LINEUP_STATUS.DRAFT]: { label: "Nháp", color: "warning" },
  [LINEUP_STATUS.SUBMITTED]: { label: "Đã nộp", color: "info" },
  [LINEUP_STATUS.LOCKED]: { label: "Đã khóa", color: "secondary" },
  [LINEUP_STATUS.PUBLISHED]: { label: "Đã công bố", color: "success" },
};

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isBeforeLock(matchup, now = new Date()) {
  if (!matchup?.lineupLockAt) {
    return true;
  }
  return new Date(now).getTime() < new Date(matchup.lineupLockAt).getTime();
}

function canEditLineup(lineup) {
  if (!lineup) {
    return true;
  }
  return (
    lineup.status === LINEUP_STATUS.NOT_SUBMITTED ||
    lineup.status === LINEUP_STATUS.DRAFT ||
    lineup.status === LINEUP_STATUS.SUBMITTED
  );
}

function useCaptainPortalAccess({ tournament, activeClubId, tournamentId }) {
  const { rbacEnabled, isAuthenticated, user } = useAuth();
  const { currentTenantId } = useTenant();

  return useMemo(() => {
    if (!tournament) {
      return { allowed: false, error: "Không tìm thấy giải đấu." };
    }

    if (rbacEnabled && isAuthenticated) {
      const tenantCheck = assertTournamentAccess(activeClubId, tournamentId, {
        tenantId: currentTenantId,
      });
      if (!tenantCheck.ok) {
        return { allowed: false, error: tenantCheck.error };
      }
    }

    const teamData = getTeamData(tournament);
    const viewerPlayerId = user?.playerId ? String(user.playerId) : null;
    const captainTeam = viewerPlayerId
      ? findTeamForCaptain(teamData, viewerPlayerId)
      : null;

    if (!captainTeam && rbacEnabled && isAuthenticated) {
      return {
        allowed: false,
        error: "Chỉ đội trưởng hoặc đội phó mới truy cập được trang này.",
      };
    }

    if (!captainTeam && (!rbacEnabled || !isAuthenticated)) {
      const fallbackTeam = teamData?.teams?.[0] || null;
      return {
        allowed: Boolean(fallbackTeam),
        captainTeam: fallbackTeam,
        viewerPlayerId: fallbackTeam?.captainPlayerId || null,
        error: fallbackTeam ? null : "Chưa có đội nào trong giải.",
      };
    }

    return {
      allowed: true,
      captainTeam,
      viewerPlayerId,
      error: null,
    };
  }, [
    activeClubId,
    currentTenantId,
    isAuthenticated,
    rbacEnabled,
    tournament,
    tournamentId,
    user?.playerId,
  ]);
}

function buildInitialSelections(teamData, matchupId, teamId) {
  const lineup = getLineup(teamData, matchupId, teamId);
  const selections = {};

  for (const discipline of teamData.disciplines) {
    selections[discipline.id] = [...(lineup?.selections?.[discipline.id] || [])];
  }

  return selections;
}

function playerName(players, playerId) {
  const player = players.find((item) => String(item.id) === String(playerId));
  return player?.name || playerId;
}

function MatchupLineupCard({
  matchup,
  team,
  teamData,
  players,
  clubId,
  tournamentId,
  dataVersion,
  onSaved,
}) {
  const opponentId = getOpponentTeamId(matchup, team.id);
  const opponent = findTeam(teamData, opponentId);
  const ownLineup = getLineup(teamData, matchup.id, team.id);
  const lineupStatus = ownLineup?.status || LINEUP_STATUS.NOT_SUBMITTED;
  const statusMeta = LINEUP_STATUS_LABEL[lineupStatus] || LINEUP_STATUS_LABEL[LINEUP_STATUS.NOT_SUBMITTED];
  const editable = isBeforeLock(matchup) && canEditLineup(ownLineup);
  const isPublished = matchup.status === MATCHUP_STATUS.PUBLISHED;

  const [selections, setSelections] = useState(() =>
    buildInitialSelections(teamData, matchup.id, team.id)
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelections(buildInitialSelections(teamData, matchup.id, team.id));
  }, [teamData, matchup.id, team.id, ownLineup?.status, dataVersion]);

  const allowReuse = teamData.settings?.allowPlayerReusePerMatchup === true;
  const visible = getVisibleLineup(teamData, {
    matchupId: matchup.id,
    viewerTeamId: team.id,
    isOrganizer: false,
  });
  const pairings = isPublished
    ? buildOfficialPairings(teamData, matchup.id)
    : null;

  function getUsedPlayerIds(excludeDisciplineId = null) {
    const used = new Set();
    for (const [disciplineId, playerIds] of Object.entries(selections)) {
      if (disciplineId === excludeDisciplineId) {
        continue;
      }
      playerIds.forEach((playerId) => used.add(String(playerId)));
    }
    return used;
  }

  function handlePlayerChange(disciplineId, slotIndex, playerId, playerCount) {
    setSelections((current) => {
      const next = { ...current };
      const slots = Array.from({ length: playerCount }, (_, index) =>
        current[disciplineId]?.[index] || ""
      );
      slots[slotIndex] = playerId;
      next[disciplineId] = slots.filter(Boolean);
      return next;
    });
    setError("");
  }

  function handleSaveDraft() {
    setBusy(true);
    setError("");
    setMessage("");

    const draftCheck = validateLineupSelections({
      teamData,
      teamId: team.id,
      selections,
      players,
      partial: true,
    });

    if (!draftCheck.ok) {
      setError(draftCheck.errors.join(" "));
      setBusy(false);
      return;
    }

    const result = captainSaveLineup(clubId, tournamentId, {
      matchupId: matchup.id,
      teamId: team.id,
      selections,
      players,
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.error || "Không lưu được nháp.");
      return;
    }

    setMessage("Đã lưu nháp đội hình.");
    onSaved();
  }

  function handleSubmit() {
    setBusy(true);
    setError("");
    setMessage("");

    const validation = validateLineupSelections({
      teamData,
      teamId: team.id,
      selections,
      players,
    });

    if (!validation.ok) {
      setError(validation.errors.join(" "));
      setBusy(false);
      return;
    }

    const result = captainSubmitLineup(clubId, tournamentId, {
      matchupId: matchup.id,
      teamId: team.id,
      selections,
      players,
      now: new Date().toISOString(),
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.error || "Không nộp được đội hình.");
      return;
    }

    setMessage("Đã nộp đội hình.");
    onSaved();
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1}
        >
          <Box>
            <Typography variant="h6" fontWeight={700}>
              vs {opponent?.name || "Đối thủ"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Giờ thi đấu: {formatDateTime(matchup.scheduledAt)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Hạn nộp: {formatDateTime(matchup.lineupLockAt)}
            </Typography>
          </Box>
          <Chip label={statusMeta.label} color={statusMeta.color} />
        </Stack>

        {message ? <Alert severity="success">{message}</Alert> : null}
        {error ? <Alert severity="error">{error}</Alert> : null}

        {!editable ? (
          <Alert severity="info" icon={<LockIcon />}>
            {isBeforeLock(matchup)
              ? "Đội hình đã khóa, không thể chỉnh sửa."
              : "Đã quá hạn nộp đội hình."}
          </Alert>
        ) : null}

        {teamData.disciplines.map((discipline) => {
          const usedPlayerIds = getUsedPlayerIds(discipline.id);
          const eligible = filterEligiblePlayersForDiscipline({
            team,
            discipline,
            players,
            usedPlayerIds,
            allowReuse,
          });
          const selectedIds = Array.from({ length: discipline.playerCount }, (_, index) =>
            selections[discipline.id]?.[index] || ""
          );
          const slots = Array.from({ length: discipline.playerCount }, (_, index) => index);

          return (
            <Box key={discipline.id}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                {discipline.name}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap flexWrap="wrap">
                {slots.map((slotIndex) => (
                  <FormControl
                    key={`${discipline.id}-${slotIndex}`}
                    size="small"
                    sx={{ minWidth: 180 }}
                    disabled={!editable || busy}
                  >
                    <InputLabel>{`VĐV ${slotIndex + 1}`}</InputLabel>
                    <Select
                      label={`VĐV ${slotIndex + 1}`}
                      value={selectedIds[slotIndex] || ""}
                      onChange={(event) =>
                        handlePlayerChange(
                          discipline.id,
                          slotIndex,
                          event.target.value,
                          discipline.playerCount
                        )
                      }
                    >
                      <MenuItem value="">
                        <em>— Chọn —</em>
                      </MenuItem>
                      {eligible.map((player) => (
                        <MenuItem key={player.id} value={player.id}>
                          {player.name}
                        </MenuItem>
                      ))}
                      {selectedIds[slotIndex] &&
                      !eligible.some((player) => player.id === selectedIds[slotIndex]) ? (
                        <MenuItem value={selectedIds[slotIndex]}>
                          {playerName(players, selectedIds[slotIndex])}
                        </MenuItem>
                      ) : null}
                    </Select>
                  </FormControl>
                ))}
              </Stack>
            </Box>
          );
        })}

        {editable ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={handleSaveDraft}
              disabled={busy}
            >
              Lưu nháp
            </Button>
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={handleSubmit}
              disabled={busy}
            >
              Xác nhận nộp
            </Button>
          </Stack>
        ) : null}

        {!isPublished && visible.ok && !visible.opponentLineup ? (
          <Alert severity="warning" icon={<VisibilityIcon />}>
            Đội hình đối phương sẽ hiển thị sau khi BTC công bố.
          </Alert>
        ) : null}

        {isPublished && pairings?.ok ? (
          <Box>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Cặp đấu chính thức
            </Typography>
            <Stack spacing={1}>
              {pairings.pairings.map((pairing) => {
                const isTeamA = team.id === matchup.teamAId;
                const ownPlayerIds = isTeamA ? pairing.teamAPlayerIds : pairing.teamBPlayerIds;
                const opponentPlayerIds = isTeamA
                  ? pairing.teamBPlayerIds
                  : pairing.teamAPlayerIds;

                return (
                  <Paper key={pairing.subMatchId} variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {pairing.disciplineName}
                    </Typography>
                    <Typography variant="body2">
                      {team.name}:{" "}
                      {ownPlayerIds.map((id) => playerName(players, id)).join(" / ") || "—"}
                    </Typography>
                    <Typography variant="body2">
                      {opponent?.name}:{" "}
                      {opponentPlayerIds.map((id) => playerName(players, id)).join(" / ") || "—"}
                    </Typography>
                  </Paper>
                );
              })}
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </Paper>
  );
}

export default function TeamPortal() {
  const { tournamentId } = useParams();
  const { activeClubId, revision, refreshClubs } = useClub();

  const tournament = useMemo(() => {
    if (!activeClubId || !tournamentId) {
      return null;
    }
    return getTournament(activeClubId, tournamentId);
  }, [activeClubId, tournamentId, revision]);

  const access = useCaptainPortalAccess({ tournament, activeClubId, tournamentId });

  const teamData = useMemo(
    () => getTeamData(tournament) || { teams: [], disciplines: [], matchups: [], lineups: {} },
    [tournament]
  );

  const players = useMemo(
    () => (activeClubId ? loadPlayersForClub(activeClubId) : []),
    [activeClubId, revision]
  );

  const matchups = useMemo(() => {
    if (!access.captainTeam) {
      return { upcoming: [], past: [] };
    }

    const teamMatchups = listMatchupsForTeam(teamData, access.captainTeam.id);
    return partitionMatchupsForPortal(teamMatchups);
  }, [access.captainTeam, teamData]);

  if (!tournament || !isTeamTournament(tournament)) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Không tìm thấy giải đồng đội.</Alert>
      </Box>
    );
  }

  if (!access.allowed) {
    return (
      <Box sx={{ p: 3, maxWidth: 480 }}>
        <Stack spacing={2}>
          <LockIcon color="warning" fontSize="large" />
          <Typography variant="h6" fontWeight={700}>
            Không có quyền truy cập
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {access.error}
          </Typography>
          <Button component={RouterLink} to="/tournament" variant="contained">
            Về trang Giải đấu
          </Button>
        </Stack>
      </Box>
    );
  }

  const captainRoleLabel = isTeamCaptain(access.captainTeam, access.viewerPlayerId)
    ? access.captainTeam.captainPlayerId === access.viewerPlayerId
      ? "Đội trưởng"
      : "Đội phó"
    : "";

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 960, mx: "auto" }}>
      <Stack spacing={2}>
        <Button
          startIcon={<ArrowBackIcon />}
          component={RouterLink}
          to="/tournament"
          sx={{ alignSelf: "flex-start" }}
        >
          Quay lại
        </Button>

        <Typography variant="h5">{tournament.name}</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label="Portal đội trưởng" color="primary" />
          {access.captainTeam ? (
            <Chip label={access.captainTeam.name} variant="outlined" />
          ) : null}
          {captainRoleLabel ? <Chip label={captainRoleLabel} size="small" /> : null}
        </Stack>

        <Typography variant="body2" color="text.secondary">
          Chọn VĐV cho từng nội dung thi đấu, lưu nháp hoặc xác nhận nộp trước giờ khóa.
        </Typography>

        {matchups.upcoming.length === 0 && matchups.past.length === 0 ? (
          <Alert severity="info">Chưa có lịch đối đầu cho đội của bạn.</Alert>
        ) : (
          <>
            {matchups.upcoming.length > 0 ? (
              <Stack spacing={2}>
                <Typography variant="subtitle1" fontWeight={700}>
                  Lịch sắp tới ({matchups.upcoming.length})
                </Typography>
                {matchups.upcoming.map((matchup) => (
                  <MatchupLineupCard
                    key={`${matchup.id}-${getLineup(teamData, matchup.id, access.captainTeam.id)?.status || "none"}`}
                    matchup={matchup}
                    team={access.captainTeam}
                    teamData={teamData}
                    players={players}
                    clubId={activeClubId}
                    tournamentId={tournamentId}
                    dataVersion={revision}
                    onSaved={refreshClubs}
                  />
                ))}
              </Stack>
            ) : (
              <Alert severity="info">Không còn lượt đối đầu sắp tới.</Alert>
            )}

            {matchups.past.length > 0 ? (
              <Stack spacing={2}>
                <Typography variant="subtitle1" fontWeight={700} color="text.secondary">
                  Đã qua ({matchups.past.length})
                </Typography>
                {matchups.past.map((matchup) => (
                  <MatchupLineupCard
                    key={`past-${matchup.id}-${getLineup(teamData, matchup.id, access.captainTeam.id)?.status || "none"}`}
                    matchup={matchup}
                    team={access.captainTeam}
                    teamData={teamData}
                    players={players}
                    clubId={activeClubId}
                    tournamentId={tournamentId}
                    dataVersion={revision}
                    onSaved={refreshClubs}
                  />
                ))}
              </Stack>
            ) : null}
          </>
        )}
      </Stack>
    </Box>
  );
}
