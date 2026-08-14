import { useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { useClubPairingCandidatePool } from "../../features/pairing-candidates/index.js";

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

import { useClub } from "../../context/ClubContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { canViewPlayerSkillLevel } from "../../auth/rbac.js";
import { useCanonicalTournament } from "../../features/tournament/hooks/useCanonicalTournament.js";
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../models/tournament/index.js";
import { getCourtDisplayName } from "../../models/court.js";
import { formatOrganizerPlayerMeta } from "../../utils/skillLevelVisibility.js";
import {
  createFairDailyMatches,
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
  beginPresenceOverride,
  DAILY_MATCH_TYPE_OPTIONS,
  DAILY_PLAY_CODE,
  DAILY_PLAY_MESSAGES,
  formatSessionCloseBlockedMessage,
  formatSessionCloseConfirmMessage,
  classifyDailyCloseReadiness,
  getDailyMatchShape,
  isDailySessionCompleted,
  isNoCourtWaitingCopy,
  isObsoleteNoCourtAvailabilityError,
  resolveCreateCourtWaitingNote,
  resolveCreateMatchCount,
  resolvePresentedCheckedSet,
  dailyPlayCourtRuntimeLabel,
  projectDailyPlayerFilterView,
  countVisiblePresentedChecked,
  listVisibleBulkCheckInTargets,
  listVisibleBulkCheckOutTargets,
  shouldIgnoreConcurrentPresenceClick,
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

const MATCH_TYPE_OPTIONS = DAILY_MATCH_TYPE_OPTIONS;

function PlayerPresenceRow({ player, checked, busy, canViewSkill, onToggle }) {
  return (
    <Button
      fullWidth
      variant={checked ? "contained" : "outlined"}
      onClick={() => onToggle?.(player.id)}
      disabled={!onToggle}
      aria-pressed={checked}
      aria-busy={busy || undefined}
      sx={{
        justifyContent: "space-between",
        minHeight: 44,
      }}
    >
      <span>{player.name}</span>
      <span>{formatOrganizerPlayerMeta(player, canViewSkill)}</span>
    </Button>
  );
}

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
  const [createPending, setCreatePending] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [changeCourtMatch, setChangeCourtMatch] = useState(null);
  const [changeCourtId, setChangeCourtId] = useState("");
  const [bulkPending, setBulkPending] = useState(null);
  const [presenceOverride, setPresenceOverride] = useState(null);
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
    reload: reloadTournament,
    setTournament,
  } = useCanonicalTournament(activeClub, tournamentId, 0);

  const session = useDailyPlayCanonicalSession({
    tenantId,
    clubId: activeClubId,
    tournamentId,
    enabled: Boolean(tenantId && activeClubId && tournamentId),
    pollMs: 15000,
  });

  const matchTypeInitializedRef = useRef(false);
  useEffect(() => {
    if (matchTypeInitializedRef.current || !session.dailyPlay?.matchType) return;
    setMatchType(session.dailyPlay.matchType);
    matchTypeInitializedRef.current = true;
  }, [session.dailyPlay?.matchType]);

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
    });
  }, [session.dailyPlay, matchType]);

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
  // Waiting matches are not "no free court." Suppress that copy while courts are free.
  const rawDisplayError =
    actionError ||
    session.error ||
    (!tournament && tournamentLoadError) ||
    playersLoadError?.message ||
    null;
  const availableCourtCount = (session.availableCourts || []).length;
  const noCourtWaitingNotice =
    isNoCourtWaitingCopy(rawDisplayError) &&
    availableCourtCount === 0 &&
    session.hasCourtCapability;
  const displayError = isObsoleteNoCourtAvailabilityError(
    rawDisplayError,
    availableCourtCount
  )
    ? null
    : noCourtWaitingNotice
      ? null
      : rawDisplayError;

  const courts = session.courts || [];
  const courtStates = session.courtStates || [];
  const { waiting, assigned, playing, completed } = useMemo(
    () => partitionDailyMatches(dailySettings.matches),
    [dailySettings.matches]
  );
  const sessionCompleted = isDailySessionCompleted(
    session.tournamentStatus || tournament?.status,
    dailySettings
  );
  const closeReadiness = useMemo(
    () => classifyDailyCloseReadiness(dailySettings.matches),
    [dailySettings.matches]
  );
  const waitingQueue = useMemo(
    () => [...waiting, ...assigned],
    [waiting, assigned]
  );

  const presentedCheckedSet = useMemo(
    () =>
      resolvePresentedCheckedSet(
        dailySettings.checkedInPlayerIds,
        presenceOverride
      ),
    [dailySettings.checkedInPlayerIds, presenceOverride]
  );

  const playerFilterView = useMemo(
    () =>
      projectDailyPlayerFilterView({
        players,
        checkedInPlayerIds: dailySettings.checkedInPlayerIds,
        matchType,
      }),
    [players, dailySettings.checkedInPlayerIds, matchType]
  );
  const visiblePresentedCheckedCount = countVisiblePresentedChecked(
    playerFilterView,
    presentedCheckedSet
  );

  const mutationBusy = shouldIgnoreConcurrentPresenceClick({
    lockHeld: playerMutationLockRef.current,
    bulkPending,
    mutating: session.mutating,
    override: presenceOverride,
  });

  const handleToggleCheckIn = async (playerId) => {
    if (sessionCompleted) return;
    if (
      shouldIgnoreConcurrentPresenceClick({
        lockHeld: playerMutationLockRef.current,
        bulkPending,
        mutating: session.mutating,
        override: presenceOverride,
      })
    ) {
      return;
    }
    const override = beginPresenceOverride(
      dailySettings.checkedInPlayerIds,
      playerId
    );
    if (!override) {
      return;
    }
    playerMutationLockRef.current = true;
    setActionError(null);
    setPresenceOverride(override);
    try {
      const result = override.checked
        ? await session.checkIn(playerId)
        : await session.checkOut(playerId);
      if (result?.ok) {
        if (tournament?.status === TOURNAMENT_STATUS.DRAFT) {
          void setStatus(TOURNAMENT_STATUS.ACTIVE);
        }
        return;
      }
      if (result?.error) {
        setActionError(result.error);
      }
    } finally {
      playerMutationLockRef.current = false;
      setPresenceOverride(null);
    }
  };

  const handleSelectAllCheckIn = async () => {
    if (sessionCompleted) return;
    if (playerMutationLockRef.current || mutationBusy) return;
    playerMutationLockRef.current = true;
    setActionError(null);
    const targets = listVisibleBulkCheckInTargets(
      playerFilterView,
      dailySettings.checkedInPlayerIds
    );
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
    if (sessionCompleted) return;
    if (playerMutationLockRef.current || mutationBusy) return;
    playerMutationLockRef.current = true;
    setActionError(null);
    const targets = listVisibleBulkCheckOutTargets(playerFilterView);
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
    if (
      sessionCompleted ||
      createPending ||
      session.mutating ||
      playerMutationLockRef.current ||
      presenceOverride ||
      bulkPending ||
      anim.open
    ) {
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

      const busy = getBusyPlayerIdsFromDailyMatches(dailySettings.matches);
      const eligiblePlayerCount = playerFilterView.visibleCheckedPlayerIds.filter(
        (playerId) => !busy.has(String(playerId))
      ).length;
      const matchShape = getDailyMatchShape(matchType);
      const countPlan = resolveCreateMatchCount({
        enabledCourts: courts,
        availableCourts: session.availableCourts || [],
        eligiblePlayerCount,
        matchType,
        playersPerMatch: matchShape.playersPerMatch,
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
        eligiblePlayerCount: eligiblePlayerCount,
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

      setActionError(null);
      session.setError?.(null);

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
      const availableAfter = Number(
        persist.readback?.availableCourts?.length ??
          persist.availableCourts?.length ??
          session.availableCourts?.length ??
          0
      );
      const waitingCopy = resolveCreateCourtWaitingNote({
        availableCourtCount: availableAfter,
        waitingForCourt: persist.waitingForCourt || countPlan.waitingForCourt,
      });
      const courtNote = waitingCopy ? ` • ${waitingCopy}` : "";

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
    if (sessionCompleted) return;
    setActionError(null);
    const result = await session.assignCourt(match.id);
    if (result?.ok) {
      setActionError(null);
      session.setError?.(null);
      setMessage("Đã xếp trận vào sân (assigned). Bấm Bắt đầu trận để chơi.");
      return;
    }
    setActionError(
      result?.error ||
        DAILY_PLAY_MESSAGES[result?.code] ||
        "Không xếp được sân cho trận này."
    );
  };

  const handleStartMatch = async (match) => {
    if (sessionCompleted) return;
    setActionError(null);
    const result = await session.startMatch(match.id);
    if (result?.ok) {
      setMessage("Đã bắt đầu trận.");
      return;
    }
    if (result?.error) setActionError(result.error);
  };

  const handleCancelMatch = async (match) => {
    if (sessionCompleted) return;
    setActionError(null);
    const result = await session.cancelMatch(match.id);
    if (result?.ok) {
      setMessage("Đã hủy trận và giải phóng sân/VĐV.");
      return;
    }
    if (result?.error) setActionError(result.error);
  };

  const handleOpenChangeCourt = (match) => {
    if (sessionCompleted) return;
    setChangeCourtMatch(match);
    setChangeCourtId("");
  };

  const handleSubmitChangeCourt = async () => {
    if (!changeCourtMatch || !changeCourtId) return;
    setActionError(null);
    const result = await session.changeCourt(changeCourtMatch.id, changeCourtId);
    if (result?.ok) {
      setChangeCourtMatch(null);
      setChangeCourtId("");
      setMessage("Đã đổi sân.");
      return;
    }
    if (result?.error) setActionError(result.error);
  };

  const handleCloseSession = async () => {
    if (sessionCompleted) return;
    setActionError(null);
    const result = await session.closeSession();
    if (result?.ok) {
      setCloseDialogOpen(false);
      setMessage("Buổi chơi đã kết thúc");
      if (typeof reloadTournament === "function") {
        const reloaded = await reloadTournament();
        if (reloaded) setTournament(reloaded);
        else {
          setTournament((current) =>
            current ? { ...current, status: TOURNAMENT_STATUS.COMPLETED } : current
          );
        }
      } else {
        setTournament((current) =>
          current ? { ...current, status: TOURNAMENT_STATUS.COMPLETED } : current
        );
      }
      return;
    }
    if (result?.code === DAILY_PLAY_CODE.SESSION_CLOSE_BLOCKED) {
      setCloseDialogOpen(false);
      setActionError(
        formatSessionCloseBlockedMessage({
          assignedCount: result.assignedCount,
          playingCount: result.playingCount,
        })
      );
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
    <TournamentManageGate
      tournamentId={tournamentId}
      loadedTournament={tournament}
    >
      <TournamentSetupShell
        tournament={tournament}
        description="Daily Play canonical — check-in, ghép trận, xếp sân, nhập điểm"
        onBack={() => navigate("/tournament")}
        headerActions={
          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            {!sessionCompleted ? (
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => setCloseDialogOpen(true)}
                sx={{ minHeight: 40 }}
              >
                Kết thúc buổi chơi
              </Button>
            ) : null}
            <Button
              variant="outlined"
              onClick={() => navigate(`/tournament/director/${tournamentId}`)}
              sx={{ minHeight: 40 }}
            >
              Mở Director Mode
            </Button>
          </Stack>
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
            {noCourtWaitingNotice && (
              <Alert
                severity="warning"
                sx={{ mb: 2 }}
                onClose={() => {
                  setActionError(null);
                  session.setError?.(null);
                }}
              >
                {DAILY_PLAY_MESSAGES.COURTS_BUSY_WAITING}
              </Alert>
            )}
            {!displayError && playersEmptyMessage && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {playersEmptyMessage}
              </Alert>
            )}
            {sessionCompleted && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Buổi chơi đã kết thúc
                {dailySettings.closeSummary
                  ? ` • ${dailySettings.closeSummary.completedMatchCount || 0} trận hoàn tất, ${dailySettings.closeSummary.cancelledWaitingCount || 0} trận chờ đã hủy.`
                  : ""}
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
              onChange={sessionCompleted ? undefined : handleRefereeRosterChange}
              pending={refereePending || sessionCompleted}
              enableCanonicalDirectory={!sessionCompleted}
              canonicalCandidates={canonicalReferees}
              canonicalLoading={canonicalRefereesLoading}
              canonicalError={canonicalRefereesError}
              canonicalWarning={canonicalRefereesWarning}
              description="Chọn tài khoản REFEREE trong tenant/CLB, hoặc thêm trọng tài khách khi chưa có tài khoản. Roster này dùng để gán trận / sân trong Director Mode."
            />
          </Grid>
        </Grid>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Loại trận</InputLabel>
              <Select
                label="Loại trận"
                value={matchType}
                onChange={(event) => setMatchType(event.target.value)}
                disabled={sessionCompleted}
              >
                {MATCH_TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleCreateMatches}
              disabled={
                sessionCompleted ||
                createPending ||
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
                Check-in hôm nay ({visiblePresentedCheckedCount}/
                {playerFilterView.visiblePlayerCount})
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => void handleSelectAllCheckIn()}
                  disabled={
                    sessionCompleted ||
                    playerFilterView.visiblePlayerCount === 0 ||
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
                    sessionCompleted ||
                    playerFilterView.visibleCheckedCount === 0 ||
                    Boolean(bulkPending)
                  }
                >
                  {bulkPending === "checkOut"
                    ? "Đang bỏ chọn..."
                    : "Bỏ chọn tất cả"}
                </Button>
              </Stack>
              <Stack spacing={1} sx={{ maxHeight: 320, overflow: "auto" }}>
                {playerFilterView.visiblePlayers.map((player) => (
                  <PlayerPresenceRow
                    key={player.id}
                    player={player}
                    checked={presentedCheckedSet.has(String(player.id))}
                    busy={
                      String(presenceOverride?.playerId) === String(player.id)
                    }
                    canViewSkill={canViewSkillInSetup}
                    onToggle={
                      sessionCompleted
                        ? undefined
                        : (id) => void handleToggleCheckIn(id)
                    }
                  />
                ))}
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
                      {dailyPlayCourtRuntimeLabel(court.status)}
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
                if (sessionCompleted) {
                  return buildDailyMatchCardProps(match, { courts, players });
                }
                if (match.status === "assigned") {
                  return buildDailyMatchCardProps(match, {
                    actionLabel: "Bắt đầu trận",
                    onAction: handleStartMatch,
                    secondaryActionLabel: "Hủy trận",
                    onSecondaryAction: handleCancelMatch,
                    tertiaryActionLabel: "Đổi sân",
                    onTertiaryAction: handleOpenChangeCourt,
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
                sessionCompleted
                  ? buildDailyMatchCardProps(match, { courts, players })
                  : buildDailyMatchCardProps(match, {
                      actionLabel: "Nhập điểm",
                      onAction: handleOpenScore,
                      secondaryActionLabel: "Hủy trận",
                      onSecondaryAction: handleCancelMatch,
                      tertiaryActionLabel: "Đổi sân",
                      onTertiaryAction: handleOpenChangeCourt,
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

        <Dialog
          open={closeDialogOpen}
          onClose={() => setCloseDialogOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Kết thúc buổi chơi</DialogTitle>
          <DialogContent>
            <Typography sx={{ whiteSpace: "pre-line", mt: 1 }}>
              {closeReadiness.ok
                ? formatSessionCloseConfirmMessage({
                    waitingCount: closeReadiness.waitingCount,
                    checkedInCount: dailySettings.checkedInPlayerIds.length,
                  })
                : formatSessionCloseBlockedMessage(closeReadiness)}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 2, pb: 2, flexWrap: "wrap", gap: 1 }}>
            <Button onClick={() => setCloseDialogOpen(false)}>Hủy</Button>
            {closeReadiness.ok ? (
              <Button
                variant="contained"
                color="warning"
                onClick={() => void handleCloseSession()}
                disabled={session.mutating}
              >
                {session.mutating ? "Đang kết thúc..." : "Kết thúc buổi chơi"}
              </Button>
            ) : null}
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(changeCourtMatch)}
          onClose={() => {
            setChangeCourtMatch(null);
            setChangeCourtId("");
          }}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Đổi sân</DialogTitle>
          <DialogContent>
            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <InputLabel>Sân trống</InputLabel>
              <Select
                label="Sân trống"
                value={changeCourtId}
                onChange={(event) => setChangeCourtId(event.target.value)}
              >
                {(session.availableCourts || []).map((court) => (
                  <MenuItem key={court.id} value={String(court.id)}>
                    {getCourtDisplayName(court)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {(session.availableCourts || []).length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.NO_COURT_AVAILABLE]}
              </Typography>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setChangeCourtMatch(null);
                setChangeCourtId("");
              }}
            >
              Hủy
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleSubmitChangeCourt()}
              disabled={!changeCourtId || session.mutating}
            >
              Đổi sân
            </Button>
          </DialogActions>
        </Dialog>

        <TournamentAnimationDialog {...anim.dialogProps} />
      </TournamentSetupShell>
    </TournamentManageGate>
  );
}
