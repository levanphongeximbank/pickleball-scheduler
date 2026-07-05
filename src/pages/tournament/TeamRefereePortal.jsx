import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RemoveIcon from "@mui/icons-material/Remove";
import SaveIcon from "@mui/icons-material/Save";
import SportsIcon from "@mui/icons-material/Sports";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClub } from "../../context/ClubContext.jsx";
import { useTenant } from "../../context/TenantContext.jsx";
import { loadPlayersForClub } from "../../domain/clubStorage.js";
import { assertTournamentAccess, getTournament } from "../../domain/tournamentService.js";
import { getPermissionsForRole } from "../../features/identity/matrix/rolePermissions.js";
import {
  MATCHUP_STATUS,
  SUB_MATCH_STATUS,
} from "../../features/team-tournament/constants.js";
import {
  buildRefereeMatchupView,
  canEditSubMatchResult,
  listRefereeMatchupSummaries,
  MATCH_FORMAT,
} from "../../features/team-tournament/engines/teamRefereeEngine.js";
import {
  canManageTeamMatchResult,
  canViewTeamMatchResults,
} from "../../features/team-tournament/engines/teamPermissionEngine.js";
import {
  getStandingsTable,
} from "../../features/team-tournament/engines/teamStandingsEngine.js";
import {
  getTeamData,
  isTeamTournament,
} from "../../features/team-tournament/engines/teamTournamentEngine.js";
import {
  refereeConfirmSubMatch,
  refereeSaveSubMatchDraft,
} from "../../features/team-tournament/services/teamTournamentService.js";

const SUB_MATCH_STATUS_LABEL = {
  [SUB_MATCH_STATUS.WAITING]: { label: "Chờ", color: "default" },
  [SUB_MATCH_STATUS.PLAYING]: { label: "Nháp", color: "warning" },
  [SUB_MATCH_STATUS.COMPLETED]: { label: "Xong", color: "success" },
  [SUB_MATCH_STATUS.FORFEIT]: { label: "Bỏ cuộc", color: "error" },
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

function ScoreStepper({ label, value, disabled, onChange }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        flex: 1,
        textAlign: "center",
        borderRadius: 2,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="h3" fontWeight="bold" sx={{ my: 1, lineHeight: 1 }}>
        {value}
      </Typography>
      <Stack direction="row" spacing={1} justifyContent="center">
        <IconButton
          color="primary"
          disabled={disabled}
          onClick={() => onChange(value + 1)}
          sx={{ bgcolor: "primary.main", color: "primary.contrastText", "&:hover": { bgcolor: "primary.dark" } }}
        >
          <AddIcon />
        </IconButton>
        <IconButton
          disabled={disabled || value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          <RemoveIcon />
        </IconButton>
      </Stack>
    </Paper>
  );
}

function SubMatchScorePanel({
  subMatch,
  teamAName,
  teamBName,
  canEdit,
  onSaveDraft,
  onConfirm,
  busy,
}) {
  const isBestOf3 = subMatch.format === MATCH_FORMAT.BEST_OF_3;
  const [scoreA, setScoreA] = useState(subMatch.score?.teamA || 0);
  const [scoreB, setScoreB] = useState(subMatch.score?.teamB || 0);
  const [games, setGames] = useState(
    subMatch.score?.games?.length
      ? subMatch.score.games
      : [{ teamA: 0, teamB: 0 }]
  );
  const [activeGameIndex, setActiveGameIndex] = useState(0);
  const editable = canEdit && subMatch.hasOfficialLineup;

  useEffect(() => {
    setScoreA(subMatch.score?.teamA || 0);
    setScoreB(subMatch.score?.teamB || 0);
    setGames(
      subMatch.score?.games?.length
        ? subMatch.score.games
        : [{ teamA: 0, teamB: 0 }]
    );
  }, [subMatch]);

  function updateGame(index, side, value) {
    setGames((current) =>
      current.map((game, gameIndex) =>
        gameIndex === index
          ? { ...game, [side]: Math.max(0, value) }
          : game
      )
    );
  }

  function addGame() {
    if (games.length >= 3) {
      return;
    }
    setGames((current) => [...current, { teamA: 0, teamB: 0 }]);
    setActiveGameIndex(games.length);
  }

  const payload = isBestOf3
    ? { score: { teamA: 0, teamB: 0 }, games }
    : { score: { teamA: scoreA, teamB: scoreB }, games: [] };

  return (
    <Box sx={{ mt: 1.5, p: 1.5, bgcolor: "action.hover", borderRadius: 2 }}>
      {!subMatch.hasOfficialLineup && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          Thiếu đội hình chính thức — không thể nhập tỷ số.
        </Alert>
      )}

      {subMatch.status === SUB_MATCH_STATUS.COMPLETED && !canEdit && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Kết quả đã xác nhận. Chỉ BTC/admin mới được sửa.
        </Alert>
      )}

      {isBestOf3 ? (
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {games.map((_, index) => (
              <Chip
                key={`game-tab-${index}`}
                label={`Game ${index + 1}`}
                color={activeGameIndex === index ? "primary" : "default"}
                onClick={() => setActiveGameIndex(index)}
                sx={{ minHeight: 36 }}
              />
            ))}
            {games.length < 3 && editable && (
              <Chip
                label="+ Game"
                variant="outlined"
                onClick={addGame}
                sx={{ minHeight: 36 }}
              />
            )}
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <ScoreStepper
              label={teamAName}
              value={games[activeGameIndex]?.teamA || 0}
              disabled={!editable || !subMatch.hasOfficialLineup}
              onChange={(value) => updateGame(activeGameIndex, "teamA", value)}
            />
            <ScoreStepper
              label={teamBName}
              value={games[activeGameIndex]?.teamB || 0}
              disabled={!editable || !subMatch.hasOfficialLineup}
              onChange={(value) => updateGame(activeGameIndex, "teamB", value)}
            />
          </Stack>
        </Stack>
      ) : (
        <Stack direction="row" spacing={1.5}>
          <ScoreStepper
            label={teamAName}
            value={scoreA}
            disabled={!editable || !subMatch.hasOfficialLineup}
            onChange={setScoreA}
          />
          <ScoreStepper
            label={teamBName}
            value={scoreB}
            disabled={!editable || !subMatch.hasOfficialLineup}
            onChange={setScoreB}
          />
        </Stack>
      )}

      {editable && subMatch.hasOfficialLineup && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<SaveIcon />}
            disabled={busy}
            onClick={() => onSaveDraft(subMatch.subMatchId, payload)}
            sx={{ minHeight: 48 }}
          >
            Lưu nháp
          </Button>
          <Button
            fullWidth
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            disabled={busy}
            onClick={() => onConfirm(subMatch.subMatchId, payload)}
            sx={{ minHeight: 48 }}
          >
            Xác nhận KQ
          </Button>
        </Stack>
      )}

      {subMatch.status === SUB_MATCH_STATUS.COMPLETED && subMatch.winnerTeamId && (
        <Typography variant="body2" color="success.main" sx={{ mt: 1.5, fontWeight: 600 }}>
          Thắng:{" "}
          {subMatch.winnerTeamId === subMatch.teamAId ? teamAName : teamBName}
        </Typography>
      )}
    </Box>
  );
}

function MatchupCard({
  matchup,
  expanded,
  onToggle,
  selectedSubMatchId,
  onSelectSubMatch,
  permissions,
  onSaveDraft,
  onConfirm,
  busy,
}) {
  const statusChip =
    matchup.status === MATCHUP_STATUS.COMPLETED
      ? { label: "Hoàn tất", color: "success" }
      : matchup.status === MATCHUP_STATUS.IN_PROGRESS
        ? { label: "Đang đấu", color: "warning" }
        : { label: "Đã công bố", color: "info" };

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
      <Box
        sx={{
          p: 2,
          cursor: "pointer",
          "&:active": { bgcolor: "action.selected" },
        }}
        onClick={onToggle}
      >
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Box sx={{ flex: 1, pr: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {matchup.teamAName} vs {matchup.teamBName}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {formatDateTime(matchup.scheduledAt)}
              {matchup.courtLabel ? ` · Sân ${matchup.courtLabel}` : ""}
            </Typography>
            {matchup.result && (
              <Typography variant="body2" sx={{ mt: 0.75, fontWeight: 600 }}>
                Chung cuộc: {matchup.teamAName} {matchup.result.teamAWins}–
                {matchup.result.teamBWins} {matchup.teamBName}
              </Typography>
            )}
          </Box>
          <Stack alignItems="flex-end" spacing={0.5}>
            <Chip size="small" label={statusChip.label} color={statusChip.color} />
            <IconButton size="small" aria-label={expanded ? "Thu gọn" : "Mở rộng"}>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ p: 2 }}>
          {matchup.subMatches.map((subMatch) => {
            const statusMeta =
              SUB_MATCH_STATUS_LABEL[subMatch.status] ||
              SUB_MATCH_STATUS_LABEL[SUB_MATCH_STATUS.WAITING];
            const isOpen = selectedSubMatchId === subMatch.subMatchId;

            return (
              <Box key={subMatch.subMatchId} sx={{ mb: 2 }}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    borderColor: isOpen ? "primary.main" : "divider",
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ cursor: "pointer" }}
                    onClick={() => onSelectSubMatch(subMatch.subMatchId)}
                  >
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700}>
                        {subMatch.disciplineName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {subMatch.teamAPlayerNames.join(" / ")} vs{" "}
                        {subMatch.teamBPlayerNames.join(" / ")}
                      </Typography>
                      {subMatch.status === SUB_MATCH_STATUS.COMPLETED && (
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {subMatch.score?.teamA} – {subMatch.score?.teamB}
                          {subMatch.format === MATCH_FORMAT.BEST_OF_3 &&
                            subMatch.score?.games?.length > 0 &&
                            ` (${subMatch.score.games.map((g) => `${g.teamA}-${g.teamB}`).join(", ")})`}
                        </Typography>
                      )}
                    </Box>
                    <Chip size="small" label={statusMeta.label} color={statusMeta.color} />
                  </Stack>

                  {isOpen && (
                    <SubMatchScorePanel
                      subMatch={{
                        ...subMatch,
                        teamAId: matchup.teamAId,
                        teamBId: matchup.teamBId,
                      }}
                      teamAName={matchup.teamAName}
                      teamBName={matchup.teamBName}
                      canEdit={
                        canManageTeamMatchResult({ permissions }) &&
                        canEditSubMatchResult(
                          { status: subMatch.status },
                          { permissions }
                        )
                      }
                      onSaveDraft={onSaveDraft}
                      onConfirm={onConfirm}
                      busy={busy}
                    />
                  )}
                </Paper>
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Paper>
  );
}

export default function TeamRefereePortal() {
  const { tournamentId } = useParams();
  const { activeClubId } = useClub();
  const { rbacEnabled, isAuthenticated, user } = useAuth();
  const { currentTenantId } = useTenant();

  const [tournament, setTournament] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [expandedMatchupId, setExpandedMatchupId] = useState("");
  const [selectedSubMatchId, setSelectedSubMatchId] = useState("");

  const permissions = useMemo(
    () => getPermissionsForRole(user?.role || ""),
    [user?.role]
  );

  const canManage = useMemo(
    () => canManageTeamMatchResult({ permissions }),
    [permissions]
  );

  const canView = useMemo(
    () => canViewTeamMatchResults({ permissions }),
    [permissions]
  );

  const reloadTournament = useCallback(() => {
    const next = getTournament(activeClubId, tournamentId);
    setTournament(next);
    return next;
  }, [activeClubId, tournamentId]);

  useEffect(() => {
    reloadTournament();
  }, [reloadTournament]);

  const access = useMemo(() => {
    if (!tournament) {
      return { allowed: false, error: "Không tìm thấy giải đấu." };
    }

    if (!isTeamTournament(tournament)) {
      return { allowed: false, error: "Giải này không phải giải đồng đội." };
    }

    if (rbacEnabled && isAuthenticated) {
      const tenantCheck = assertTournamentAccess(activeClubId, tournamentId, {
        tenantId: currentTenantId,
      });
      if (!tenantCheck.ok) {
        return { allowed: false, error: tenantCheck.error };
      }

      if (!canView && !canManage) {
        return {
          allowed: false,
          error: "Bạn không có quyền xem trang trọng tài giải đồng đội.",
        };
      }
    }

    return { allowed: true, error: null };
  }, [
    activeClubId,
    canManage,
    canView,
    currentTenantId,
    isAuthenticated,
    rbacEnabled,
    tournament,
    tournamentId,
  ]);

  const players = useMemo(
    () => (activeClubId ? loadPlayersForClub(activeClubId) : []),
    [activeClubId]
  );

  const teamData = useMemo(
    () => (tournament ? getTeamData(tournament) : null),
    [tournament]
  );

  const matchups = useMemo(
    () => (teamData ? listRefereeMatchupSummaries(teamData, players) : []),
    [teamData, players]
  );

  const standings = useMemo(
    () => (teamData ? getStandingsTable(teamData) : []),
    [teamData]
  );

  const activeMatchup = useMemo(() => {
    if (!teamData || !expandedMatchupId) {
      return null;
    }
    const view = buildRefereeMatchupView(teamData, expandedMatchupId, players);
    return view.ok ? view.matchup : null;
  }, [teamData, expandedMatchupId, players]);

  async function handleSaveDraft(matchupId, subMatchId, payload) {
    setBusy(true);
    setError(null);
    setMessage(null);

    const result = refereeSaveSubMatchDraft(activeClubId, tournamentId, {
      matchupId,
      subMatchId,
      ...payload,
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setTournament(result.tournament);
    setMessage("Đã lưu nháp tỷ số.");
  }

  async function handleConfirm(matchupId, subMatchId, payload) {
    setBusy(true);
    setError(null);
    setMessage(null);

    const result = refereeConfirmSubMatch(activeClubId, tournamentId, {
      matchupId,
      subMatchId,
      ...payload,
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setTournament(result.tournament);

    if (result.matchupResult?.winnerTeamId) {
      const winnerName =
        result.matchupResult.winnerTeamId === activeMatchup?.teamAId
          ? activeMatchup?.teamAName
          : activeMatchup?.teamBName;
      setMessage(
        `Đã xác nhận. Chung cuộc: ${activeMatchup?.teamAName} ${result.matchupResult.teamAWins}–${result.matchupResult.teamBWins} ${activeMatchup?.teamBName}${winnerName ? ` (${winnerName} thắng)` : ""}`
      );
    } else {
      setMessage("Đã xác nhận kết quả trận con.");
    }
  }

  if (!access.allowed) {
    return (
      <Box sx={{ p: 2, maxWidth: 640, mx: "auto" }}>
        <Alert severity="error">{access.error}</Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        maxWidth: 640,
        mx: "auto",
        px: 1.5,
        py: 2,
        pb: 10,
        minHeight: "100dvh",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Button
          component={RouterLink}
          to={`/tournament/team/${tournamentId}`}
          startIcon={<ArrowBackIcon />}
          size="small"
        >
          Giải
        </Button>
        <SportsIcon color="primary" />
        <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>
          Trọng tài
        </Typography>
        <Chip
          size="small"
          label={canManage ? "Nhập điểm" : "Chỉ xem"}
          color={canManage ? "primary" : "default"}
        />
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {tournament?.name}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message}
        </Alert>
      )}

      {matchups.length === 0 ? (
        <Alert severity="info">
          Chưa có lượt đối đầu nào được công bố. BTC cần khóa và công bố đội hình trước.
        </Alert>
      ) : (
        <Stack spacing={1.5}>
          {matchups.map((matchup) => (
            <MatchupCard
              key={matchup.id}
              matchup={
                expandedMatchupId === matchup.id && activeMatchup
                  ? activeMatchup
                  : matchup
              }
              expanded={expandedMatchupId === matchup.id}
              onToggle={() => {
                setExpandedMatchupId((current) =>
                  current === matchup.id ? "" : matchup.id
                );
                setSelectedSubMatchId("");
              }}
              selectedSubMatchId={selectedSubMatchId}
              onSelectSubMatch={setSelectedSubMatchId}
              permissions={permissions}
              onSaveDraft={(subMatchId, payload) =>
                handleSaveDraft(matchup.id, subMatchId, payload)
              }
              onConfirm={(subMatchId, payload) =>
                handleConfirm(matchup.id, subMatchId, payload)
              }
              busy={busy}
            />
          ))}
        </Stack>
      )}

      {standings.length > 0 && (
        <Paper variant="outlined" sx={{ mt: 3, p: 2, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
            Bảng xếp hạng
          </Typography>
          <Stack spacing={1}>
            {standings.map((row) => (
              <Stack
                key={row.teamId}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography variant="body2">
                  #{row.rank} {row.teamName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {row.wins}T–{row.losses}B · {row.rankingPoints}đ
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
