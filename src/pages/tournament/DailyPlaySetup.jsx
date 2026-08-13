import { useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { useClubPairingCandidatePool } from "../../features/pairing-candidates/index.js";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
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

import { useClub } from "../../context/ClubContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { canViewPlayerSkillLevel } from "../../auth/rbac.js";
import { useCanonicalTournament } from "../../features/tournament/hooks/useCanonicalTournament.js";
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../models/tournament/index.js";
import { getCourtDisplayName } from "../../models/court.js";
import { formatOrganizerPlayerMeta } from "../../utils/skillLevelVisibility.js";
import {
  createFairDailyMatches,
  DAILY_GENDER_FILTER,
  DAILY_MATCH_TYPE,
  getBusyPlayerIdsFromDailyMatches,
  getDefaultDailyPlaySettings,
  normalizeDailyPlaySettings,
  partitionDailyMatches,
} from "../../tournament/engines/dailyPlayEngine.js";
import {
  COMPETITION_CLASS,
  projectLivePrivatePairingPrepareInput,
} from "../../features/private-pairing-rules/index.js";
import {
  acceptDailyScoreFieldInput,
  DAILY_PLAY_CODE,
  DAILY_PLAY_MESSAGES,
  resolveCreateMatchCount,
  validateScoreInput,
} from "../../features/daily-play/canonical/index.js";
import { useDailyPlayCanonicalSession } from "../../features/daily-play/canonical/useDailyPlayCanonicalSession.js";
import TournamentManageGate from "../../components/tournament/TournamentManageGate.jsx";
import TournamentSetupShell from "../../components/tournament/TournamentSetupShell.jsx";
import MatchListPanel from "../../components/tournament/MatchListPanel.jsx";
import RefereeRosterPanel from "../../components/tournament/RefereeRosterPanel.jsx";
import { buildDailyMatchCardProps } from "../../components/tournament/matchCardProps.js";
import TournamentAnimationDialog from "../../components/tournament/animation/TournamentAnimationDialog.jsx";
import { ANIMATION_MODES } from "../../components/tournament/animation/animationUtils.js";
import { buildDailyFairMatchAnimationPayload } from "../../components/tournament/animation/daily/dailyFairMatchUtils.js";
import { FAIR_MATCH_CONTROL_MODES } from "../../components/tournament/animation/daily/useFairMatchSequence.js";
import { useTournamentAnimation } from "../../components/tournament/animation/useTournamentAnimation.js";
import {
  buildRefereeSettingsPatch,
  getRefereeSettings,
} from "../../tournament/engines/refereeEngine.js";
import {
  annotateRosterEligibility,
  listEligibleCanonicalReferees,
} from "../../features/daily-play/services/refereeDirectoryService.js";

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
  const { activeClubId, activeClub } = useClub();
  const { user, rbacEnabled } = useAuth();
  const [message, setMessage] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [scoreDialog, setScoreDialog] = useState(null);
  const [scoreCorrectionMode, setScoreCorrectionMode] = useState(false);
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [scoreNote, setScoreNote] = useState("");
  const [matchType, setMatchType] = useState(DAILY_MATCH_TYPE.MIXED_DOUBLE);
  const [genderFilter, setGenderFilter] = useState(DAILY_GENDER_FILTER.ALL);
  const [createPending, setCreatePending] = useState(false);
  const [bulkPending, setBulkPending] = useState(null);
  const [pendingPlayerId, setPendingPlayerId] = useState(null);
  const [refereePending, setRefereePending] = useState(false);
  const [canonicalReferees, setCanonicalReferees] = useState([]);
  const [canonicalRefereesLoading, setCanonicalRefereesLoading] = useState(false);
  const [canonicalRefereesError, setCanonicalRefereesError] = useState(null);
  const [canonicalRefereesWarning, setCanonicalRefereesWarning] = useState(null);
  const playerMutationLockRef = useRef(false);
  const anim = useTournamentAnimation();

  const tenantId = activeClub?.tenantId || activeClub?.venueId || null;

  const canViewSkillInSetup = useMemo(
    () =>
      canViewPlayerSkillLevel(
        user,
        { clubId: activeClubId, tournamentId, tournamentContext: true },
        { rbacEnabled }
      ),
    [user, activeClubId, tournamentId, rbacEnabled]
  );

  const {
    tournament,
    loading: tournamentLoading,
    error: tournamentLoadError,
    update,
    setStatus,
  } = useCanonicalTournament(activeClub, tournamentId, 0);

  const session = useDailyPlayCanonicalSession({
    tenantId,
    clubId: activeClubId,
    tournamentId,
    enabled: Boolean(tenantId && activeClubId && tournamentId),
    pollMs: 15000,
  });

  useEffect(() => {
    if (!session.dailyPlay) return;
    if (session.dailyPlay.matchType) {
      setMatchType(session.dailyPlay.matchType);
    }
    if (session.dailyPlay.genderFilter) {
      setGenderFilter(session.dailyPlay.genderFilter);
    }
  }, [session.dailyPlay?.matchType, session.dailyPlay?.genderFilter]);

  // Candidate directory: club membership identity — not Daily session presence.
  const {
    players,
    error: playersLoadError,
    emptyMessage: playersEmptyMessage,
  } = useClubPairingCandidatePool(activeClubId, {
    revision: 0,
  });

  const dailySettings = useMemo(() => {
    const fromServer = session.dailyPlay || getDefaultDailyPlaySettings();
    return normalizeDailyPlaySettings({
      ...fromServer,
      matchType,
      genderFilter,
    });
  }, [session.dailyPlay, matchType, genderFilter]);

  const refereeRoster = useMemo(() => {
    const base = getRefereeSettings(tournament).roster;
    return annotateRosterEligibility(base, canonicalReferees);
  }, [tournament, canonicalReferees]);

  useEffect(() => {
    let cancelled = false;
    if (!tenantId) {
      setCanonicalReferees([]);
      setCanonicalRefereesError(null);
      setCanonicalRefereesWarning(null);
      return undefined;
    }

    setCanonicalRefereesLoading(true);
    setCanonicalRefereesError(null);
    void listEligibleCanonicalReferees({
      tenantId,
      clubId: activeClubId,
    }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setCanonicalReferees([]);
        setCanonicalRefereesError(result.error || "Không tải được danh bạ trọng tài.");
        setCanonicalRefereesWarning(null);
        return;
      }
      setCanonicalReferees(result.referees || []);
      setCanonicalRefereesWarning(result.warning || null);
    }).finally(() => {
      if (!cancelled) {
        setCanonicalRefereesLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tenantId, activeClubId, user?.id]);

  // DP-08: do not sticky-mirror transient load errors after successful snapshot.
  const displayError =
    actionError ||
    session.error ||
    (!tournament && tournamentLoadError) ||
    playersLoadError?.message ||
    null;

  const courts = session.courts || [];
  const courtStates = session.courtStates || [];
  const { waiting, assigned, playing, completed } = useMemo(
    () => partitionDailyMatches(dailySettings.matches),
    [dailySettings.matches]
  );
  const waitingQueue = useMemo(
    () => [...waiting, ...assigned],
    [waiting, assigned]
  );

  const checkedInSet = useMemo(
    () => new Set(dailySettings.checkedInPlayerIds),
    [dailySettings.checkedInPlayerIds]
  );

  const mutationBusy =
    Boolean(pendingPlayerId) ||
    Boolean(bulkPending) ||
    Boolean(session.mutating);

  const handleToggleCheckIn = async (playerId) => {
    // DP-10: serialize mutations without visually disabling every roster row.
    if (
      playerMutationLockRef.current ||
      pendingPlayerId ||
      bulkPending ||
      session.mutating
    ) {
      return;
    }
    playerMutationLockRef.current = true;
    setActionError(null);
    setPendingPlayerId(String(playerId));
    try {
      const checked = checkedInSet.has(String(playerId));
      const result = checked
        ? await session.checkOut(playerId)
        : await session.checkIn(playerId);
      if (result?.ok) {
        if (tournament?.status === TOURNAMENT_STATUS.DRAFT) {
          await setStatus(TOURNAMENT_STATUS.ACTIVE);
        }
        return;
      }
      if (result?.error) {
        setActionError(result.error);
      }
    } finally {
      playerMutationLockRef.current = false;
      setPendingPlayerId(null);
    }
  };

  const handleSelectAllCheckIn = async () => {
    if (playerMutationLockRef.current || mutationBusy) return;
    playerMutationLockRef.current = true;
    setActionError(null);
    const targets = players
      .map((player) => player.id)
      .filter((id) => !checkedInSet.has(String(id)));
    if (targets.length === 0) {
      playerMutationLockRef.current = false;
      return;
    }

    setBulkPending("checkIn");
    try {
      const result = await session.checkInMany(targets);
      if (result?.ok) {
        if (tournament?.status === TOURNAMENT_STATUS.DRAFT) {
          await setStatus(TOURNAMENT_STATUS.ACTIVE);
        }
        setMessage(`Đã chọn ${result.succeeded?.length || targets.length} VĐV.`);
        return;
      }
      const failedName =
        players.find((player) => String(player.id) === String(result?.failedPlayerId))
          ?.name || result?.failedPlayerId;
      setActionError(
        result?.error ||
          (failedName
            ? `Không chọn hết được. VĐV bị từ chối: ${failedName}.`
            : "Không chọn hết được VĐV.")
      );
    } finally {
      playerMutationLockRef.current = false;
      setBulkPending(null);
    }
  };

  const handleClearAllCheckIn = async () => {
    if (playerMutationLockRef.current || mutationBusy) return;
    playerMutationLockRef.current = true;
    setActionError(null);
    const targets = [...dailySettings.checkedInPlayerIds];
    if (targets.length === 0) {
      playerMutationLockRef.current = false;
      return;
    }

    setBulkPending("checkOut");
    try {
      const result = await session.checkOutMany(targets);
      if (result?.ok) {
        setMessage("Đã bỏ chọn tất cả VĐV rảnh.");
        return;
      }
      const failedName =
        players.find((player) => String(player.id) === String(result?.failedPlayerId))
          ?.name || result?.failedPlayerId;
      setActionError(
        result?.error ||
          (failedName
            ? `Không bỏ chọn hết được. VĐV đang được bảo vệ / từ chối: ${failedName}.`
            : "Không bỏ chọn hết được VĐV.")
      );
    } finally {
      playerMutationLockRef.current = false;
      setBulkPending(null);
    }
  };

  const handleRefereeRosterChange = async (nextRoster) => {
    setActionError(null);
    setRefereePending(true);
    try {
      const result = await update(
        buildRefereeSettingsPatch(tournament, { roster: nextRoster })
      );
      if (!result.ok) {
        const failure = {
          ok: false,
          error: result.error || "Không lưu được danh sách trọng tài.",
        };
        setActionError(failure.error);
        return failure;
      }
      setMessage("Đã cập nhật danh sách trọng tài buổi chơi.");
      return { ok: true, tournament: result.tournament };
    } finally {
      setRefereePending(false);
    }
  };

  const handleCreateMatches = async () => {
    if (createPending || session.mutating || anim.open) {
      return;
    }

    setActionError(null);
    setMessage(null);
    setCreatePending(true);

    try {
      if (!session.hasCourtCapability) {
        setActionError(DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.NO_COURT_CAPABILITY]);
        return;
      }

      const countPlan = resolveCreateMatchCount({
        enabledCourts: courts,
        availableCourts: session.availableCourts || [],
        eligiblePlayerCount: dailySettings.checkedInPlayerIds.filter(
          (playerId) =>
            !getBusyPlayerIdsFromDailyMatches(dailySettings.matches).has(
              String(playerId)
            )
        ).length,
      });

      if (!countPlan.ok) {
        setActionError(countPlan.error || DAILY_PLAY_MESSAGES[countPlan.code]);
        return;
      }

      const projected = projectLivePrivatePairingPrepareInput({
        tournament: tournament || null,
        activeClub: activeClub || null,
        tournamentId,
        clubId: tournament?.clubId || activeClubId,
        hostClubId: activeClubId,
        competitionClass: COMPETITION_CLASS.DAILY_PLAY,
      });

      if (!projected.ok) {
        setActionError(
          projected.error?.message ||
            "Thiếu phạm vi tenant/CLB — không tạo được trận công bằng."
        );
        return;
      }

      const proposal = await createFairDailyMatches({
        players,
        settings: dailySettings,
        tournament: projected.prepareInput.tournament,
        tournamentId: projected.prepareInput.tournamentId,
        clubId: projected.prepareInput.clubId,
        tenantId: projected.prepareInput.tenantId,
        matchCount: countPlan.matchCount,
        skipScore: dailySettings.skipScore,
      });

      if (!proposal.ok) {
        setActionError(
          proposal.privatePairingError?.message ||
            proposal.error ||
            proposal.errors?.join(" ") ||
            "Không tạo được trận."
        );
        return;
      }

      const persist = await session.createMatches(proposal.matches, {
        eligiblePlayerCount: countPlan.matchCount * 4,
        idempotencyKey: `create-${tournamentId}-${session.revision}-${proposal.matches
          .map((match) => match.id)
          .join(".")}`,
      });

      if (!persist?.ok) {
        setActionError(
          persist?.error ||
            DAILY_PLAY_MESSAGES[persist?.code] ||
            "Không lưu được trận canonical."
        );
        return;
      }

      const animationPayload = buildDailyFairMatchAnimationPayload({
        result: {
          ...proposal,
          matches: persist.matches || proposal.matches,
        },
        players,
        courts,
        clubName: activeClub?.name || "CLB",
        playDate: new Date(),
      });

      const poolPlayerIds = new Set(
        animationPayload.players.map((player) => String(player.id))
      );
      const animationPlayers = players.filter((player) =>
        poolPlayerIds.has(String(player.id))
      );

      const waitingNote =
        proposal.waitingPlayers?.length > 0
          ? ` • ${proposal.waitingPlayers.length} VĐV chờ lượt tiếp theo`
          : "";
      const courtNote = persist.waitingForCourt || countPlan.waitingForCourt
        ? ` • ${DAILY_PLAY_MESSAGES.COURTS_BUSY_WAITING}`
        : "";

      anim.showAnimation(
        {
          animationMode: ANIMATION_MODES.DAILY_FAIR_MATCH,
          ...animationPayload,
          players: animationPlayers,
          controlMode: FAIR_MATCH_CONTROL_MODES.AUTO,
          autoStart: true,
          speed: "normal",
          skipDailyAnalyzePhase: true,
        },
        () => {
          setMessage(
            `Đã tạo ${(persist.matches || proposal.matches).length} trận công bằng${waitingNote}${courtNote}.`
          );
        }
      );
    } finally {
      setCreatePending(false);
    }
  };

  const handleAssignCourt = async (match) => {
    setActionError(null);
    const result = await session.assignCourt(match.id);
    if (result?.ok) {
      setMessage("Đã xếp trận vào sân (assigned). Bấm Bắt đầu trận để chơi.");
      return;
    }
    if (result?.error) setActionError(result.error);
  };

  const handleStartMatch = async (match) => {
    setActionError(null);
    const result = await session.startMatch(match.id);
    if (result?.ok) {
      setMessage("Đã bắt đầu trận.");
      return;
    }
    if (result?.error) setActionError(result.error);
  };

  const handleCancelMatch = async (match) => {
    setActionError(null);
    const result = await session.cancelMatch(match.id);
    if (result?.ok) {
      setMessage("Đã hủy trận và giải phóng sân/VĐV.");
      return;
    }
    if (result?.error) setActionError(result.error);
  };

  const handleOpenScore = (match) => {
    setScoreCorrectionMode(false);
    setScoreDialog(match);
    setScoreA(match.scoreA != null ? String(match.scoreA) : "");
    setScoreB(match.scoreB != null ? String(match.scoreB) : "");
    setScoreNote("");
  };

  const handleOpenCorrectScore = (match) => {
    setScoreCorrectionMode(true);
    setScoreDialog(match);
    setScoreA(match.scoreA != null ? String(match.scoreA) : "");
    setScoreB(match.scoreB != null ? String(match.scoreB) : "");
    setScoreNote("");
  };

  const handleScoreFieldChange = (setter) => (event) => {
    const next = acceptDailyScoreFieldInput(event.target.value);
    if (next == null) return;
    setter(next);
  };

  const handleSubmitScore = async () => {
    if (!scoreDialog) return;
    setActionError(null);
    const parsed = validateScoreInput(scoreA, scoreB);
    if (!parsed.ok) {
      setActionError(parsed.error);
      return;
    }
    if (scoreCorrectionMode) {
      const result = await session.correctScore(
        scoreDialog.id,
        scoreA,
        scoreB,
        scoreNote
      );
      if (result?.ok) {
        setScoreDialog(null);
        setScoreCorrectionMode(false);
        setMessage("Đã sửa điểm trận hoàn tất.");
        return;
      }
      if (result?.error) setActionError(result.error);
      return;
    }
    const result = await session.submitScore(scoreDialog.id, scoreA, scoreB);
    if (result?.ok) {
      setScoreDialog(null);
      setMessage("Đã lưu kết quả và giải phóng sân.");
      return;
    }
    if (result?.error) setActionError(result.error);
  };

  // Initial first load only — keep shell visible once tournament + session exist.
  if ((tournamentLoading && !tournament) || (session.loading && !session.state)) {
    return (
      <Box>
        <Alert severity="info">Đang tải buổi Daily Play canonical...</Alert>
      </Box>
    );
  }

  if (!tournament) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          Không tìm thấy buổi Daily Play này trên CLB hiện tại.
        </Alert>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button component={RouterLink} to="/daily-play" variant="contained">
            Mở / tạo buổi chơi vui mới
          </Button>
          <Button component={RouterLink} to="/tournament" variant="outlined">
            Về trang Giải đấu
          </Button>
        </Stack>
      </Box>
    );
  }

  if (tournament.mode !== TOURNAMENT_MODE.DAILY_PLAY) {
    return (
      <Box>
        <Alert severity="warning">Giải này không phải chế độ Daily Play.</Alert>
        <Button component={RouterLink} to="/tournament" sx={{ mt: 2 }}>
          Quay lại
        </Button>
      </Box>
    );
  }

  if (!tenantId) {
    return (
      <Alert severity="error">
        Thiếu tenant/venue của CLB — không mở được Daily Play canonical.
      </Alert>
    );
  }

  if (!session.state && session.error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {session.error}
        </Alert>
        <Button variant="contained" onClick={() => void session.refresh()}>
          Thử tải lại
        </Button>
      </Box>
    );
  }

  return (
    <TournamentManageGate tournamentId={tournamentId}>
      <TournamentSetupShell
        tournament={tournament}
        description="Daily Play canonical — check-in, ghép trận, xếp sân, nhập điểm"
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
              <Alert
                severity="success"
                sx={{ mb: 2 }}
                onClose={() => setMessage(null)}
              >
                {message}
              </Alert>
            )}
            {displayError && (
              <Alert
                severity="error"
                sx={{ mb: 2 }}
                onClose={() => {
                  setActionError(null);
                  session.setError?.(null);
                }}
              >
                {displayError}
              </Alert>
            )}
            {!displayError && playersEmptyMessage && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {playersEmptyMessage}
              </Alert>
            )}
            {!session.hasCourtCapability && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.NO_COURT_CAPABILITY]}
              </Alert>
            )}
          </>
        }
      >
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12 }}>
            <RefereeRosterPanel
              roster={refereeRoster}
              onChange={handleRefereeRosterChange}
              pending={refereePending}
              enableCanonicalDirectory
              canonicalCandidates={canonicalReferees}
              canonicalLoading={canonicalRefereesLoading}
              canonicalError={canonicalRefereesError}
              canonicalWarning={canonicalRefereesWarning}
              description="Chọn tài khoản REFEREE trong tenant/CLB, hoặc thêm trọng tài khách khi chưa có tài khoản. Roster này dùng để gán trận / sân trong Director Mode."
            />
          </Grid>
        </Grid>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Loại trận</InputLabel>
              <Select
                label="Loại trận"
                value={matchType}
                onChange={(event) => setMatchType(event.target.value)}
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
                value={genderFilter}
                onChange={(event) => setGenderFilter(event.target.value)}
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
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleCreateMatches}
              disabled={
                createPending ||
                session.mutating ||
                anim.open ||
                !session.hasCourtCapability
              }
              sx={{ minHeight: 48 }}
            >
              {createPending ? "Đang tạo trận..." : "Tạo trận công bằng"}
            </Button>
          </Grid>
        </Grid>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, lg: 5 }}>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                Check-in hôm nay ({dailySettings.checkedInPlayerIds.length}/
                {players.length})
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => void handleSelectAllCheckIn()}
                  disabled={
                    players.length === 0 ||
                    session.mutating ||
                    Boolean(bulkPending)
                  }
                >
                  {bulkPending === "checkIn" ? "Đang chọn..." : "Chọn tất cả"}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => void handleClearAllCheckIn()}
                  disabled={
                    dailySettings.checkedInPlayerIds.length === 0 ||
                    session.mutating ||
                    Boolean(bulkPending)
                  }
                >
                  {bulkPending === "checkOut"
                    ? "Đang bỏ chọn..."
                    : "Bỏ chọn tất cả"}
                </Button>
              </Stack>
              <Stack spacing={1} sx={{ maxHeight: 320, overflow: "auto" }}>
                {players.map((player) => {
                  const checked = checkedInSet.has(String(player.id));
                  const isPending =
                    String(pendingPlayerId) === String(player.id);
                  return (
                    <Button
                      key={player.id}
                      fullWidth
                      variant={checked ? "contained" : "outlined"}
                      onClick={() => void handleToggleCheckIn(player.id)}
                      disabled={isPending}
                      sx={{
                        justifyContent: "space-between",
                        minHeight: 44,
                        opacity: bulkPending ? 1 : undefined,
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        {isPending ? (
                          <CircularProgress size={16} color="inherit" />
                        ) : null}
                        <span>{player.name}</span>
                      </Stack>
                      <span>
                        {formatOrganizerPlayerMeta(player, canViewSkillInSetup)}
                      </span>
                    </Button>
                  );
                })}
              </Stack>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, lg: 7 }}>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                Sân đang dùng (canonical)
              </Typography>
              <Stack spacing={1}>
                {courtStates.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.NO_COURT_CAPABILITY]}
                  </Typography>
                )}
                {courtStates.map((court, index) => (
                  <Paper key={court.id} variant="outlined" sx={{ p: 1.25 }}>
                    <Typography fontWeight="bold">
                      {getCourtDisplayName(
                        courts.find(
                          (item) => String(item.id) === String(court.id)
                        ),
                        index
                      )}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {court.status}
                      {court.currentMatchId
                        ? ` • Trận ${court.currentMatchId}`
                        : ""}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <MatchListPanel
              title="Trận chờ"
              matches={waitingQueue}
              emptyText="Chưa có trận chờ."
              getCardProps={(match) => {
                if (match.status === "assigned") {
                  return buildDailyMatchCardProps(match, {
                    actionLabel: "Bắt đầu trận",
                    onAction: handleStartMatch,
                    secondaryActionLabel: "Hủy trận",
                    onSecondaryAction: handleCancelMatch,
                    courts,
                    players,
                  });
                }
                return buildDailyMatchCardProps(match, {
                  actionLabel: "Xếp vào sân trống",
                  onAction: handleAssignCourt,
                  secondaryActionLabel: "Hủy trận",
                  onSecondaryAction: handleCancelMatch,
                  courts,
                  players,
                });
              }}
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
                  secondaryActionLabel: "Hủy trận",
                  onSecondaryAction: handleCancelMatch,
                  courts,
                  players,
                })
              }
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <MatchListPanel
              title="Đã xong"
              matches={completed}
              emptyText="Chưa có trận hoàn thành."
              getCardProps={(match) =>
                buildDailyMatchCardProps(match, {
                  actionLabel: "Sửa điểm",
                  onAction: handleOpenCorrectScore,
                  courts,
                  players,
                })
              }
            />
          </Grid>
        </Grid>

        <Dialog
          open={Boolean(scoreDialog)}
          onClose={() => {
            setScoreDialog(null);
            setScoreCorrectionMode(false);
          }}
          fullWidth
        >
          <DialogTitle>
            {scoreCorrectionMode ? "Sửa điểm trận đã hoàn tất" : "Nhập điểm"}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Điểm A"
                value={scoreA}
                onChange={handleScoreFieldChange(setScoreA)}
                inputMode="numeric"
                autoComplete="off"
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                fullWidth
              />
              <TextField
                label="Điểm B"
                value={scoreB}
                onChange={handleScoreFieldChange(setScoreB)}
                inputMode="numeric"
                autoComplete="off"
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                fullWidth
              />
              {scoreCorrectionMode ? (
                <TextField
                  label="Lý do sửa điểm (tuỳ chọn)"
                  value={scoreNote}
                  onChange={(event) => setScoreNote(event.target.value)}
                  fullWidth
                  size="small"
                />
              ) : null}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setScoreDialog(null);
                setScoreCorrectionMode(false);
              }}
              disabled={session.mutating}
            >
              Bỏ qua
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmitScore}
              disabled={session.mutating}
            >
              {session.mutating
                ? "Đang lưu..."
                : scoreCorrectionMode
                  ? "Lưu điểm sửa"
                  : "Lưu điểm"}
            </Button>
          </DialogActions>
        </Dialog>

        <TournamentAnimationDialog {...anim.dialogProps} />
      </TournamentSetupShell>
    </TournamentManageGate>
  );
}
