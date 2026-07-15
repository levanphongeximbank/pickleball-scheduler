import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { useClubPlayerPool } from "../../features/club/hooks/useClubPlayerPool.js";

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";

import { getDirectorState, lockCourt, unlockCourt } from "../../ai/director.js";
import { useClub } from "../../context/ClubContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { canViewPlayerSkillLevel } from "../../auth/rbac.js";
import { loadCourtsForClub } from "../../domain/clubStorage.js";
import {
  getTournament,
  setTournamentStatus,
  updateTournament,
} from "../../domain/tournamentService.js";
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../models/tournament/index.js";
import { getCourtDisplayName } from "../../models/court.js";
import TournamentCourtSchedulePanel from "../../components/tournament/TournamentCourtSchedulePanel.jsx";
import { formatOrganizerPlayerMeta } from "../../utils/skillLevelVisibility.js";
import {
  assignDailyMatchToCourt,
  createFairDailyMatches,
  DAILY_GENDER_FILTER,
  DAILY_MATCH_TYPE,
  getDefaultDailyPlaySettings,
  normalizeDailyPlaySettings,
  partitionDailyMatches,
  submitDailyPlayMatchScore,
  toggleDailyCheckIn,
  buildDailyPlayTournamentPatch,
} from "../../tournament/engines/dailyPlayEngine.js";
import TournamentManageGate from "../../components/tournament/TournamentManageGate.jsx";
import TournamentSetupShell from "../../components/tournament/TournamentSetupShell.jsx";
import { buildCourtRuntimeStates } from "../../tournament/engines/courtEngine.js";
import MatchListPanel from "../../components/tournament/MatchListPanel.jsx";
import RefereeRosterPanel from "../../components/tournament/RefereeRosterPanel.jsx";
import { buildDailyMatchCardProps } from "../../components/tournament/matchCardProps.js";
import TournamentAnimationDialog from "../../components/tournament/animation/TournamentAnimationDialog.jsx";
import {
  ANIMATION_MODES,
} from "../../components/tournament/animation/animationUtils.js";
import { buildDailyFairMatchAnimationPayload } from "../../components/tournament/animation/daily/dailyFairMatchUtils.js";
import { FAIR_MATCH_CONTROL_MODES } from "../../components/tournament/animation/daily/useFairMatchSequence.js";
import { useTournamentAnimation } from "../../components/tournament/animation/useTournamentAnimation.js";
import { buildRefereeSettingsPatch, getRefereeSettings } from "../../tournament/engines/refereeEngine.js";

const MATCH_TYPE_OPTIONS = [
  { value: DAILY_MATCH_TYPE.MEN_DOUBLE, label: "Đôi nam" },
  { value: DAILY_MATCH_TYPE.WOMEN_DOUBLE, label: "Đôi nữ" },
  { value: DAILY_MATCH_TYPE.MIXED_DOUBLE, label: "Đôi nam nữ" },
  { value: DAILY_MATCH_TYPE.AUTO, label: "Tự động nhiều loại" },
];

const GENDER_FILTER_OPTIONS = [
  { value: DAILY_GENDER_FILTER.ALL, label: "Tất cả" },
  { value: DAILY_GENDER_FILTER.MALE, label: "Nam" },
  { value: DAILY_GENDER_FILTER.FEMALE, label: "Nữ" },
];

export default function DailyPlaySetup() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { activeClubId, activeClub, refreshClubs } = useClub();
  const { user, rbacEnabled } = useAuth();
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [scoreDialog, setScoreDialog] = useState(null);
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [localRevision, setLocalRevision] = useState(0);
  const anim = useTournamentAnimation();

  const canViewSkillInSetup = useMemo(
    () =>
      canViewPlayerSkillLevel(
        user,
        { clubId: activeClubId, tournamentId, tournamentContext: true },
        { rbacEnabled }
      ),
    [user, activeClubId, tournamentId, rbacEnabled]
  );

  const tournament = useMemo(
    () => getTournament(activeClubId, tournamentId),
    [activeClubId, tournamentId, localRevision]
  );

  const { players } = useClubPlayerPool(activeClubId, { revision: localRevision });

  const courts = useMemo(
    () => loadCourtsForClub(activeClubId),
    [activeClubId, localRevision]
  );

  const dailySettings = useMemo(
    () =>
      normalizeDailyPlaySettings(
        tournament?.settings?.dailyPlay || getDefaultDailyPlaySettings()
      ),
    [tournament, localRevision]
  );

  const refereeRoster = useMemo(
    () => getRefereeSettings(tournament).roster,
    [tournament, localRevision]
  );

  const lockedCourtIds = useMemo(
    () => getDirectorState(activeClubId).lockedCourts || [],
    [activeClubId, localRevision]
  );

  const enabledCourts = useMemo(() => {
    const activeCourts = courts.filter((court) => court.active !== false);
    if (!dailySettings.enabledCourtIds.length) {
      return activeCourts;
    }
    return activeCourts.filter((court) =>
      dailySettings.enabledCourtIds.includes(String(court.id))
    );
  }, [courts, dailySettings.enabledCourtIds]);

  const courtStates = useMemo(
    () =>
      buildCourtRuntimeStates(enabledCourts, dailySettings.matches, {
        lockedCourtIds,
      }),
    [enabledCourts, dailySettings.matches, lockedCourtIds]
  );

  const { waiting, playing, completed } = useMemo(
    () => partitionDailyMatches(dailySettings.matches),
    [dailySettings.matches]
  );

  const checkedInSet = useMemo(
    () => new Set(dailySettings.checkedInPlayerIds),
    [dailySettings.checkedInPlayerIds]
  );

  const saveSettings = (nextSettings, options = {}) => {
    const result = updateTournament(
      activeClubId,
      tournamentId,
      buildDailyPlayTournamentPatch(nextSettings),
      {
        processMatchId: options.processMatchId || null,
      }
    );

    if (!result.ok) {
      setError(result.error || "Khong luu duoc trang thai Daily Play.");
      return false;
    }

    if (tournament?.status === TOURNAMENT_STATUS.DRAFT) {
      setTournamentStatus(activeClubId, tournamentId, TOURNAMENT_STATUS.ACTIVE);
    }

    setLocalRevision((value) => value + 1);
    refreshClubs();
    return true;
  };

  const handleToggleCheckIn = (playerId) => {
    saveSettings(toggleDailyCheckIn(dailySettings, playerId));
  };

  const handleSelectAllCheckIn = () => {
    saveSettings({
      ...dailySettings,
      checkedInPlayerIds: players.map((player) => String(player.id)),
    });
  };

  const handleClearAllCheckIn = () => {
    saveSettings({
      ...dailySettings,
      checkedInPlayerIds: [],
    });
  };

  const handleRefereeRosterChange = (nextRoster) => {
    const result = updateTournament(
      activeClubId,
      tournamentId,
      buildRefereeSettingsPatch(tournament, { roster: nextRoster })
    );

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setLocalRevision((value) => value + 1);
    refreshClubs();
    setMessage("Đã cập nhật danh sách trọng tài.");
  };

  const handleCreateMatches = async () => {
    setError(null);
    const availableCourts = courtStates.filter(
      (court) => court.status === "available" && !court.locked
    ).length;

    const result = await createFairDailyMatches({
      players,
      settings: dailySettings,
      tournamentId,
      clubId: activeClubId,
      matchCount: Math.max(1, availableCourts || 1),
      skipScore: dailySettings.skipScore,
    });

    if (!result.ok) {
      setError(
        result.privatePairingError?.message ||
          result.error ||
          result.errors?.join(" ") ||
          "Khong tao duoc tran."
      );
      return;
    }

    const animationPayload = buildDailyFairMatchAnimationPayload({
      result,
      players,
      courts: enabledCourts,
      clubName: activeClub?.name || "CLB",
      playDate: new Date(),
    });

    const poolPlayerIds = new Set(
      animationPayload.players.map((player) => String(player.id))
    );
    const animationPlayers = players.filter((player) =>
      poolPlayerIds.has(String(player.id))
    );

    anim.showAnimation(
      {
        animationMode: ANIMATION_MODES.DAILY_FAIR_MATCH,
        ...animationPayload,
        players: animationPlayers,
        controlMode: FAIR_MATCH_CONTROL_MODES.AUTO,
        autoStart: true,
        speed: "normal",
      },
      () => {
        if (saveSettings(result.settings)) {
          const waitingNote =
            result.waitingPlayers?.length > 0
              ? ` • ${result.waitingPlayers.length} VĐV chờ lượt tiếp theo`
              : "";
          setMessage(`Đã tạo ${result.matches.length} trận công bằng${waitingNote}.`);
        }
      }
    );
  };

  const handleAssignCourt = (match) => {
    const result = assignDailyMatchToCourt({
      settings: dailySettings,
      courts: enabledCourts,
      matchId: match.id,
      lockedCourtIds,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (saveSettings(result.settings)) {
      setMessage("Da xep tran vao san trong.");
    }
  };

  const handleToggleCourt = (courtId, locked) => {
    if (locked) {
      unlockCourt(courtId, activeClubId);
    } else {
      lockCourt(courtId, activeClubId);
    }
    setLocalRevision((value) => value + 1);
  };

  const handleOpenScore = (match) => {
    setScoreDialog(match);
    setScoreA(match.scoreA != null ? String(match.scoreA) : "");
    setScoreB(match.scoreB != null ? String(match.scoreB) : "");
  };

  const handleSubmitScore = () => {
    if (!scoreDialog) {
      return;
    }

    const result = submitDailyPlayMatchScore(
      dailySettings,
      scoreDialog.id,
      { scoreA, scoreB },
      { allowDraw: false }
    );

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (result.releasedCourtId) {
      unlockCourt(result.releasedCourtId, activeClubId);
    }

    if (saveSettings(result.settings, { processMatchId: scoreDialog.id })) {
      setScoreDialog(null);
      setMessage("Da luu ket qua va giai phong san.");
    }
  };

  const updateDailyField = (patch) => {
    saveSettings({ ...dailySettings, ...patch });
  };

  if (!tournament) {
    return (
      <Box>
        <Alert severity="error">Khong tim thay giai Daily Play.</Alert>
        <Button component={RouterLink} to="/tournament" sx={{ mt: 2 }}>
          Quay lai
        </Button>
      </Box>
    );
  }

  if (tournament.mode !== TOURNAMENT_MODE.DAILY_PLAY) {
    return (
      <Box>
        <Alert severity="warning">Giai nay khong phai che do Daily Play.</Alert>
        <Button component={RouterLink} to="/tournament" sx={{ mt: 2 }}>
          Quay lai
        </Button>
      </Box>
    );
  }

  return (
    <TournamentManageGate tournamentId={tournamentId}>
    <TournamentSetupShell
      tournament={tournament}
      description="Daily Play — check-in, ghép trận công bằng, xếp sân"
      onBack={() => navigate("/tournament")}
      headerActions={
        <Button
          variant="outlined"
          onClick={() => navigate(`/tournament/director/${tournamentId}`)}
        >
          Mở Director Mode
        </Button>
      }
      alerts={
        <>
          {message && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>
              {message}
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </>
      }
    >
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12 }}>
          <RefereeRosterPanel roster={refereeRoster} onChange={handleRefereeRosterChange} />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Loại trận</InputLabel>
            <Select
              label="Loại trận"
              value={dailySettings.matchType}
              onChange={(event) => updateDailyField({ matchType: event.target.value })}
            >
              {MATCH_TYPE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Lọc VĐV</InputLabel>
            <Select
              label="Lọc VĐV"
              value={dailySettings.genderFilter}
              onChange={(event) => updateDailyField({ genderFilter: event.target.value })}
            >
              {GENDER_FILTER_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack direction="row" spacing={1} sx={{ height: "100%" }}>
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleCreateMatches}
              sx={{ minHeight: 48 }}
            >
              Tạo trận công bằng
            </Button>
          </Stack>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
              Check-in hôm nay ({dailySettings.checkedInPlayerIds.length})
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <Button size="small" variant="contained" onClick={handleSelectAllCheckIn}>
                Chọn tất cả
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={handleClearAllCheckIn}
                disabled={dailySettings.checkedInPlayerIds.length === 0}
              >
                Bỏ chọn tất cả
              </Button>
            </Stack>
            <Stack spacing={1} sx={{ maxHeight: 320, overflow: "auto" }}>
              {players.map((player) => {
                const checked = checkedInSet.has(String(player.id));
                return (
                  <Button
                    key={player.id}
                    fullWidth
                    variant={checked ? "contained" : "outlined"}
                    onClick={() => handleToggleCheckIn(player.id)}
                    sx={{ justifyContent: "space-between", minHeight: 44 }}
                  >
                    <span>{player.name}</span>
                    <span>{formatOrganizerPlayerMeta(player, canViewSkillInSetup)}</span>
                  </Button>
                );
              })}
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
              Sân đang dùng
            </Typography>
            <Stack spacing={1}>
              {courtStates.map((court, index) => {
                const locked = court.locked || lockedCourtIds.includes(court.id);
                return (
                  <Paper key={court.id} variant="outlined" sx={{ p: 1.25 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      justifyContent="space-between"
                      spacing={1}
                    >
                      <Box>
                        <Typography fontWeight="bold">
                          {getCourtDisplayName(
                            enabledCourts.find((item) => String(item.id) === String(court.id)),
                            index
                          )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {court.status}
                          {court.currentMatchId ? ` • Trận ${court.currentMatchId}` : ""}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        startIcon={locked ? <LockOpenIcon /> : <LockIcon />}
                        onClick={() => handleToggleCourt(court.id, locked)}
                        disabled={Boolean(court.currentMatchId) && !locked}
                      >
                        {locked ? "Mở sân" : "Khóa sân"}
                      </Button>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <MatchListPanel
            title="Trận chờ"
            matches={waiting}
            emptyText="Chưa có trận chờ."
            getCardProps={(match) =>
              buildDailyMatchCardProps(match, {
                actionLabel: "Xếp vào sân trống",
                onAction: handleAssignCourt,
              })
            }
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <MatchListPanel
            title="Đang đánh"
            matches={playing}
            emptyText="Chưa có trận trên sân."
            chipColor="success"
            getCardProps={(match) =>
              buildDailyMatchCardProps(match, {
                actionLabel: "Nhập điểm",
                onAction: handleOpenScore,
              })
            }
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <MatchListPanel
            title="Đã xong"
            matches={completed}
            emptyText="Chưa có trận hoàn thành."
            getCardProps={(match) => buildDailyMatchCardProps(match)}
          />
        </Grid>
      </Grid>

      <Dialog open={Boolean(scoreDialog)} onClose={() => setScoreDialog(null)} fullWidth>
        <DialogTitle>Nhập điểm</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            {scoreDialog?.teamALabel} vs {scoreDialog?.teamBLabel}
          </Typography>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Điểm A"
              type="number"
              value={scoreA}
              onChange={(event) => setScoreA(event.target.value)}
              fullWidth
            />
            <TextField
              label="Điểm B"
              type="number"
              value={scoreB}
              onChange={(event) => setScoreB(event.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScoreDialog(null)}>Bỏ qua</Button>
          <Button variant="contained" onClick={handleSubmitScore}>
            Lưu điểm
          </Button>
        </DialogActions>
      </Dialog>

      <TournamentAnimationDialog {...anim.dialogProps} />

      {tournament && (
        <Box sx={{ mt: 3 }}>
          <TournamentCourtSchedulePanel
            clubId={activeClubId}
            tournament={tournament}
            courts={courts}
            onSaved={() => {
              refreshClubs();
              setLocalRevision((value) => value + 1);
            }}
          />
        </Box>
      )}
    </TournamentSetupShell>
    </TournamentManageGate>
  );
}
