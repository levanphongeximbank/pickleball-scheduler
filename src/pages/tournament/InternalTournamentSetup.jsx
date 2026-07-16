import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { useClub } from "../../context/ClubContext.jsx";
import { loadCourtsForClub } from "../../domain/clubStorage.js";
import {
  loadTournamentPickerClubCandidatePool,
  loadTournamentPickerTenantCandidatePool,
  resolvePairingScopeTenantId,
} from "../../features/pairing-candidates/index.js";
import TournamentCourtSchedulePanel from "../../components/tournament/TournamentCourtSchedulePanel.jsx";
import {
  getTournament,
  advanceTournamentStatus,
  updateTournament,
} from "../../domain/tournamentService.js";
import {
  EVENT_TYPE,
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  EVENT_TYPE_OPTIONS,
} from "../../models/tournament/index.js";
import {
  buildInternalTournamentPatch,
  buildInternalTournamentPlan,
  suggestEntriesFromPlayers,
  filterPlayersForEventType,
  isSingleEventType,
  canGenerateBracket,
  generateKnockoutBracket,
  resolveBracketProgress,
  setBracketWinner,
  submitKnockoutMatchScore,
  toggleBracketRoundUnlock,
  resetBracketState,
  submitTournamentDirectorMatchScore,
} from "../../tournament/engines/index.js";
import { buildIndividualAllGroupStandings } from "../../features/individual-tournament/adapters/individualStandingsAdapter.js";
import BracketView from "../../components/tournament/BracketView.jsx";
import GroupStagePanel from "../../components/tournament/GroupStagePanel.jsx";
import RefereeRosterPanel from "../../components/tournament/RefereeRosterPanel.jsx";
import TournamentAnimationDialog from "../../components/tournament/animation/TournamentAnimationDialog.jsx";
import BracketRevealAnimation from "../../components/tournament/animation/BracketRevealAnimation.jsx";
import {
  ANIMATION_MODES,
  buildGroupMatchPairingSteps,
  buildPairingSteps,
  buildPairingWaitingPlayers,
  buildSnakeSteps,
  stripMatchesFromEvent,
} from "../../components/tournament/animation/animationUtils.js";
import { useTournamentAnimation } from "../../components/tournament/animation/useTournamentAnimation.js";
import { useTournamentFlowOrchestrator } from "../../components/tournament/animation/useTournamentFlowOrchestrator.js";
import { createInternalFlowAdapters } from "../../components/tournament/animation/tournamentFlowAdapters.js";
import {
  BroadcastLiveIndicator,
  BroadcastSetupDialog,
  isTournamentBroadcastEnabled,
  useTournamentBroadcast,
  BroadcastVodResultAlert,
} from "../../features/tournament-broadcast/index.js";
import { PAIRING_CONTROL_MODES } from "../../components/tournament/animation/pairing/usePairingSequence.js";
import {
  buildRefereeSettingsPatch,
  getRefereeSettings,
} from "../../tournament/engines/refereeEngine.js";
import TournamentManageGate from "../../components/tournament/TournamentManageGate.jsx";
import TournamentSetupShell from "../../components/tournament/TournamentSetupShell.jsx";
import TournamentSelectedPlayersPanel from "../../components/tournament/TournamentSelectedPlayersPanel.jsx";
import {
  buildTournamentNotFoundMessage,
  findTournamentClubId,
} from "../../features/club/index.js";
import { isAiEngineEnabled } from "../../features/ai-assistant/index.js";
import TournamentAiAssistantPanel from "../../components/tournament/ai/TournamentAiAssistantPanel.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { canViewPlayerSkillLevel } from "../../auth/rbac.js";
import { useTenant } from "../../context/TenantContext.jsx";
import { formatOrganizerPlayerMeta } from "../../utils/skillLevelVisibility.js";
import {
  resolveTournamentEntryPlayers,
  TournamentRegistrationRatingPanel,
} from "../../features/pick-vn-rating/index.js";
import {
  INTERVENTION_PHASE,
  TournamentEntryEditor,
  TournamentGroupEditor,
  usePairingIntervention,
} from "../../features/pairing-intervention/index.js";
import {
  FounderPairingConstraintsPanel,
  guardFounderConstraints,
  getTournamentPairingConstraints,
  logConstraintChange,
} from "../../features/pairing-constraints/index.js";
import {
  COMPETITION_CLASS,
  prepareLivePrivatePairingOptions,
} from "../../features/private-pairing-rules/index.js";
import DrawPublishControls from "../../components/tournament/DrawPublishControls.jsx";
import RegistrationOpsPanel from "../../components/tournament/RegistrationOpsPanel.jsx";
import {
  canRegenerateDraw,
  forceRedrawDraw,
  getDrawPublishStatus,
  lockDraw,
  publishDraw,
  recordDrawCreated,
  reopenDraw,
  resolveDrawReopenPermission,
  summarizeGroups,
} from "../../tournament/engines/publishDrawEngine.js";
import { resolveEventTypeFromQuery } from "../../features/individual-tournament/index.js";

const EVENT_OPTIONS = EVENT_TYPE_OPTIONS;

export default function InternalTournamentSetup() {
  const { tournamentId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeClubId, clubs, refreshClubs, switchClub } = useClub();
  const { user, rbacEnabled, can } = useAuth();
  const { currentTenantId } = useTenant();
  const aiEnabled = isAiEngineEnabled();
  const [setupTab, setSetupTab] = useState(0);
  const [localRevision, setLocalRevision] = useState(0);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);

  const preselectedEvent = resolveEventTypeFromQuery(searchParams.get("event"));
  const [eventType, setEventType] = useState(preselectedEvent || EVENT_TYPE.MIXED_DOUBLE);
  const [groupCount, setGroupCount] = useState(4);
  const [sourceClubId, setSourceClubId] = useState("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
  const [previewEntries, setPreviewEntries] = useState([]);
  const [founderConstraints, setFounderConstraints] = useState([]);
  const [bracketAdvanceAnim, setBracketAdvanceAnim] = useState(null);
  const anim = useTournamentAnimation();
  const pendingPlanRef = useRef(null);
  const guidedPairingRef = useRef({
    ok: true,
    skipped: true,
    pairingOptions: { privatePairingRules: [] },
  });

  const canViewSkillInSetup = useMemo(
    () =>
      canViewPlayerSkillLevel(
        user,
        { clubId: activeClubId, tournamentId, tournamentContext: true },
        { rbacEnabled }
      ),
    [user, activeClubId, tournamentId, rbacEnabled]
  );

  const clubFromQuery = String(searchParams.get("club") || "").trim();
  const tournamentClubId = useMemo(
    () =>
      clubFromQuery ||
      findTournamentClubId(tournamentId) ||
      activeClubId,
    [clubFromQuery, tournamentId, activeClubId]
  );

  useEffect(() => {
    if (tournamentClubId && tournamentClubId !== activeClubId) {
      switchClub(tournamentClubId);
    }
  }, [tournamentClubId, activeClubId, switchClub]);

  useEffect(() => {
    if (tournamentClubId) {
      setSourceClubId(tournamentClubId);
    }
  }, [tournamentClubId]);

  const tournament = useMemo(
    () => getTournament(tournamentClubId, tournamentId),
    [tournamentClubId, tournamentId, localRevision]
  );

  useEffect(() => {
    if (tournament) {
      setFounderConstraints(getTournamentPairingConstraints(tournament));
    }
  }, [tournament?.id, tournament?.founderPairingConstraints]);

  const hostClubRecord = useMemo(
    () =>
      clubs.find(
        (club) =>
          String(club?.id || "").trim() ===
          String(sourceClubId || tournamentClubId || "").trim()
      ) || null,
    [clubs, sourceClubId, tournamentClubId]
  );

  const playerTenantId = useMemo(
    () =>
      resolvePairingScopeTenantId({
        tournamentTenantId: tournament?.tenantId,
        club: hostClubRecord,
        clubId: sourceClubId || tournamentClubId,
        clubs,
        currentTenantId,
      }),
    [
      tournament?.tenantId,
      hostClubRecord,
      sourceClubId,
      tournamentClubId,
      clubs,
      currentTenantId,
    ]
  );

  const [players, setPlayers] = useState([]);
  const [tenantPlayers, setTenantPlayers] = useState([]);
  const [playersLoadError, setPlayersLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sourceClubId) {
        if (!cancelled) {
          setPlayers([]);
          setPlayersLoadError(null);
        }
        return;
      }
      const result = await loadTournamentPickerClubCandidatePool(sourceClubId, {
        tenantId: playerTenantId,
      });
      if (cancelled) return;
      if (!result.ok) {
        setPlayers([]);
        setPlayersLoadError({
          code: result.code || "REPOSITORY_ERROR",
          message:
            result.message ||
            "Không tải được danh sách VĐV canonical. Không dùng roster blob.",
        });
        return;
      }
      setPlayers(result.players || []);
      if (result.empty && result.message) {
        setPlayersLoadError({
          code: result.code || "NO_ELIGIBLE_CANDIDATES",
          message: result.message,
          severity: "warning",
        });
      } else {
        setPlayersLoadError(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceClubId, localRevision, playerTenantId]);

  useEffect(() => {
    let cancelled = false;
    if (!playerTenantId) {
      setTenantPlayers([]);
      return undefined;
    }
    loadTournamentPickerTenantCandidatePool(playerTenantId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setTenantPlayers([]);
        setPlayersLoadError((prev) =>
          prev || {
            code: result.code || "REPOSITORY_ERROR",
            message:
              result.message ||
              "Không tải được danh sách VĐV tenant. Không dùng roster blob.",
          }
        );
        return;
      }
      setTenantPlayers(result.players || []);
    });
    return () => {
      cancelled = true;
    };
  }, [playerTenantId, localRevision]);

  const courts = useMemo(
    () => loadCourtsForClub(tournamentClubId),
    [tournamentClubId, localRevision]
  );

  const refereeRoster = useMemo(
    () => getRefereeSettings(tournament).roster,
    [tournament, localRevision]
  );

  const isSingleEvent = isSingleEventType(eventType);

  const eligiblePlayers = useMemo(
    () => filterPlayersForEventType(players, eventType),
    [players, eventType]
  );

  const selectedPlayers = useMemo(() => {
    const pool = new Map(
      [...tenantPlayers, ...players].map((player) => [String(player.id), player])
    );
    return selectedPlayerIds
      .map((id) => pool.get(String(id)))
      .filter(Boolean);
  }, [selectedPlayerIds, tenantPlayers, players]);

  const savedEvent = tournament?.events?.[0] || null;

  const groupStandings = useMemo(
    () => (savedEvent ? buildIndividualAllGroupStandings(savedEvent) : []),
    [savedEvent]
  );

  const bracketProgress = useMemo(
    () => (savedEvent ? resolveBracketProgress(savedEvent) : null),
    [savedEvent]
  );

  const knockoutMatchesByBracketId = useMemo(() => {
    const map = {};
    (savedEvent?.matches || []).forEach((match) => {
      if (match.bracketMatchId) {
        map[match.bracketMatchId] = match;
      }
    });
    return map;
  }, [savedEvent]);

  const scoreDraftScope = useMemo(
    () => ({
      clubId: tournamentClubId,
      tournamentId,
      eventId: savedEvent?.id,
    }),
    [tournamentClubId, tournamentId, savedEvent?.id]
  );

  const persistEvent = (nextEvent, options = {}) => {
    const result = updateTournament(
      tournamentClubId,
      tournamentId,
      {
        events: [{ ...savedEvent, ...nextEvent }],
      },
      {
        processMatchId: options.processMatchId || null,
        processEventId: savedEvent?.id || null,
      }
    );

    if (!result.ok) {
      setError(result.error);
      return false;
    }

    setLocalRevision((value) => value + 1);
    refreshClubs();
    return true;
  };

  const pairingIntervention = usePairingIntervention({
    phase: INTERVENTION_PHASE.TOURNAMENT,
    tournamentStatus: tournament?.status,
    clubId: tournamentClubId,
    resourceId: tournamentId,
  });

  const canInterveneSetup = pairingIntervention.canIntervene;

  const drawPublish = useMemo(
    () => getDrawPublishStatus(tournament),
    [tournament, localRevision]
  );

  const hasDrawReopenPermission = useMemo(
    () =>
      resolveDrawReopenPermission({
        canPermission: can,
        rbacEnabled,
        canIntervene: canInterveneSetup,
      }),
    [can, rbacEnabled, canInterveneSetup]
  );

  const buildDrawActor = () =>
    user
      ? { id: user.id, email: user.email || "", name: user.displayName || user.name || "" }
      : null;

  const handleLockDraw = () => {
    setError(null);
    const groups = savedEvent?.groups || [];
    const result = lockDraw(tournament, groups, {
      userId: user?.id,
      actor: buildDrawActor(),
      clubId: tournamentClubId,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const updateResult = updateTournament(tournamentClubId, tournamentId, {
      settings: result.tournament.settings,
    });
    if (updateResult.ok) {
      setLocalRevision((value) => value + 1);
      refreshClubs();
      setMessage("Đã khóa bốc thăm. Sẵn sàng công bố.");
    }
  };

  const handlePublishDraw = () => {
    setError(null);
    const groups = savedEvent?.groups || [];
    const result = publishDraw(tournament, groups, {
      userId: user?.id,
      actor: buildDrawActor(),
      clubId: tournamentClubId,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const events = (tournament.events || []).map((event) =>
      String(event.id) === String(savedEvent?.id)
        ? { ...event, groups: result.snapshot || groups }
        : event
    );
    const updateResult = updateTournament(tournamentClubId, tournamentId, {
      settings: result.tournament.settings,
      events,
    });
    if (updateResult.ok) {
      setLocalRevision((value) => value + 1);
      refreshClubs();
      setMessage("Đã công bố bốc thăm. Bracket bất biến.");
    }
  };

  const handleReopenDraw = () => {
    setError(null);
    const result = reopenDraw(tournament, {
      userId: user?.id,
      actor: buildDrawActor(),
      clubId: tournamentClubId,
      hasReopenPermission: hasDrawReopenPermission,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const updateResult = updateTournament(tournamentClubId, tournamentId, {
      settings: result.tournament.settings,
    });
    if (updateResult.ok) {
      setLocalRevision((value) => value + 1);
      refreshClubs();
      setMessage("Đã mở lại bốc thăm để chỉnh sửa.");
    }
  };

  const handleForceRedraw = () => {
    setError(null);
    const result = forceRedrawDraw(tournament, {
      userId: user?.id,
      actor: buildDrawActor(),
      clubId: tournamentClubId,
      hasReopenPermission: hasDrawReopenPermission,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const updateResult = updateTournament(tournamentClubId, tournamentId, {
      settings: result.tournament.settings,
    });
    if (updateResult.ok) {
      setLocalRevision((value) => value + 1);
      refreshClubs();
      setMessage("Force redraw được phép. Bạn có thể chia bảng lại.");
    }
  };

  const editorEntries =
    previewEntries.length > 0 ? previewEntries : savedEvent?.entries || [];

  const handleEntryInterventionApply = (result) => {
    if (!result?.ok) {
      return;
    }
    setPreviewEntries(result.entries);
    if (savedEvent?.entries?.length) {
      persistEvent({ entries: result.entries });
    }
    setMessage("Super Admin đã cập nhật ghép cặp.");
  };

  const handleGroupInterventionApply = (result) => {
    if (!result?.ok) {
      return;
    }
    if (
      persistEvent({
        entries: result.entries,
        groups: result.groups,
        matches: result.matches,
      })
    ) {
      setMessage("Super Admin đã cập nhật chia bảng và tạo lại lịch vòng bảng.");
    }
  };

  const handleSaveFounderConstraints = async () => {
    setError(null);
    const guard = guardFounderConstraints({ user });
    if (!guard.ok) {
      setError(guard.error);
      return;
    }

    const before = getTournamentPairingConstraints(tournament);
    const result = updateTournament(tournamentClubId, tournamentId, {
      founderPairingConstraints: founderConstraints,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setLocalRevision((value) => value + 1);
    setMessage("Đã lưu quy tắc ghép cặp Founder.");
    await logConstraintChange({
      user,
      tournamentId,
      clubId: tournamentClubId,
      before,
      after: founderConstraints,
    });
  };

  const applyConstraintWarnings = (pairingOptions) => {
    const constraintWarnings = pairingOptions?.constraintWarnings || [];
    const structured = pairingOptions?.privatePairingError;
    const nextWarnings = constraintWarnings.map((item) =>
      typeof item === "string" ? item : item.message || String(item)
    );
    if (structured?.code) {
      nextWarnings.unshift(structured.code);
    }
    if (nextWarnings.length > 0) {
      setWarnings(nextWarnings);
    }
  };

  const flowAdapters = useMemo(
    () =>
      createInternalFlowAdapters({
        tournament,
        tournamentClubId,
        tournamentId,
        players,
        courts,
        selectedPlayerIds,
        eventType,
        groupCount,
        isSingleEvent,
        setPreviewEntries,
        setWarnings,
        setMessage,
        setError,
        setLocalRevision,
        refreshClubs,
        persistEvent,
        getPrivatePairingOptions: () => guidedPairingRef.current,
      }),
    [
      tournament,
      tournamentClubId,
      tournamentId,
      players,
      courts,
      selectedPlayerIds,
      eventType,
      groupCount,
      isSingleEvent,
      refreshClubs,
    ]
  );

  const flow = useTournamentFlowOrchestrator(anim, flowAdapters);

  const broadcastFeatureEnabled = isTournamentBroadcastEnabled();
  const broadcast = useTournamentBroadcast({
    tournamentId,
    tournamentName: tournament?.name || "Giải đấu",
    clubId: tournamentClubId,
  });
  const [broadcastDialogOpen, setBroadcastDialogOpen] = useState(false);

  const handleFlowExit = useCallback(async () => {
    if (broadcastFeatureEnabled) {
      const stopResult = await broadcast.stopBroadcast();
      if (stopResult?.ok === false && stopResult?.error) {
        setError(stopResult.error);
      }
    }
    flow.exitFlow();
  }, [broadcast, broadcastFeatureEnabled, flow]);

  const handleRefereeRosterChange = (nextRoster) => {
    const result = updateTournament(
      tournamentClubId,
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

  const handleGenerateBracket = () => {
    setError(null);
    setMessage(null);

    const check = canGenerateBracket(savedEvent);
    if (!check.ok) {
      setError(check.errors.join(" "));
      setWarnings(check.warnings || []);
      return;
    }

    const generated = generateKnockoutBracket(savedEvent);
    if (!generated.ok) {
      setError(generated.errors?.join(" ") || "Khong tao duoc bracket.");
      return;
    }

    const progress = resolveBracketProgress(generated.event);

    anim.showAnimation(
      {
        animationMode: ANIMATION_MODES.BRACKET_REVEAL,
        bracket: progress,
      },
      () => {
        if (!persistEvent(generated.event)) {
          return;
        }

        setWarnings(generated.warnings || []);
        setMessage(`Da tao bracket knock-out voi ${generated.knockoutMatchCount} tran.`);
      }
    );
  };

  const handleSelectBracketWinner = (bracketMatchId, winnerSide) => {
    const result = setBracketWinner(savedEvent, bracketMatchId, winnerSide || null);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (winnerSide) {
      const progress = resolveBracketProgress(result.event);
      const match = progress.rounds
        .flatMap((round) => round.matches)
        .find((item) => item.id === bracketMatchId);
      const winnerName =
        winnerSide === "home"
          ? match?.home?.name || match?.homeSeed
          : match?.away?.name || match?.awaySeed;

      setBracketAdvanceAnim({
        winnerName,
        bracket: progress,
      });
    } else {
      setBracketAdvanceAnim(null);
    }

    if (persistEvent(result.event)) {
      setMessage(winnerSide ? "Da cap nhat winner." : "Da xoa winner.");
    }
  };

  const handleSubmitGroupScore = (matchId, scores) => {
    const result = submitTournamentDirectorMatchScore(savedEvent, matchId, scores);
    if (!result.ok) {
      setError(result.error);
      return false;
    }

    if (persistEvent(result.event, { processMatchId: matchId })) {
      if (result.bracketAutoGenerated) {
        setMessage(
          `Đã lưu kết quả vòng bảng. Tự động tạo bracket knock-out (${result.bracketKnockoutMatchCount} trận).`
        );
      } else {
        setMessage("Đã lưu kết quả vòng bảng.");
      }
      return true;
    }

    return false;
  };

  const handleSubmitKnockoutScore = (matchId, scores) => {
    const result = submitKnockoutMatchScore(savedEvent, matchId, scores);
    if (!result.ok) {
      setError(result.error);
      return false;
    }

    if (persistEvent(result.event, { processMatchId: matchId })) {
      setMessage("Da luu ket qua knock-out.");
      return true;
    }

    return false;
  };

  const handleToggleRoundLock = (roundName, unlock) => {
    const result = toggleBracketRoundUnlock(savedEvent, roundName, unlock);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (persistEvent(result.event)) {
      setMessage(unlock ? `Da mo khoa vong ${roundName}.` : `Da khoa vong ${roundName}.`);
    }
  };

  const handleResetBracket = () => {
    const confirmed = window.confirm(
      "Reset bracket? Se xoa toan bo tran knock-out va winner hien tai."
    );
    if (!confirmed) {
      return;
    }

    const nextEvent = resetBracketState(savedEvent);
    if (persistEvent(nextEvent)) {
      setMessage("Da reset bracket.");
    }
  };

  const togglePlayer = (playerId) => {
    const key = String(playerId);
    setSelectedPlayerIds((current) =>
      current.includes(key) ? current.filter((id) => id !== key) : [...current, key]
    );
  };

  const handleSelectAllPlayers = () => {
    setSelectedPlayerIds(eligiblePlayers.map((player) => String(player.id)));
  };

  const handleClearAllPlayers = () => {
    setSelectedPlayerIds([]);
  };

  const handleRemoveSelectedPlayer = (playerId) => {
    const key = String(playerId);
    setSelectedPlayerIds((current) => current.filter((id) => id !== key));
  };

  const handleSourceClubChange = (clubId) => {
    setSourceClubId(clubId);
    setSelectedPlayerIds([]);
    setPreviewEntries([]);
  };

  const handleStartGuidedFlow = async () => {
    setError(null);
    setWarnings([]);
    setMessage(null);

    const prepared = await prepareLivePrivatePairingOptions({
      clubId: tournamentClubId,
      tournamentId,
      eventId: savedEvent?.id || `event-${tournamentId}`,
      competitionClass: COMPETITION_CLASS.INTERNAL,
      pairingConstraints: founderConstraints,
    });

    if (!prepared.ok) {
      setError(prepared.error?.message || "Không thể bắt đầu trình chiếu theo quy tắc riêng.");
      setWarnings(
        (prepared.error?.fatalConflicts || prepared.error?.blockedByPolicy || []).map(
          (item) => item.code || item.message || String(item)
        )
      );
      return;
    }

    guidedPairingRef.current = prepared;

    if (broadcastFeatureEnabled && broadcast.shouldBroadcastWithFlow) {
      const broadcastResult = await broadcast.startBroadcast();
      if (broadcastResult?.ok === false) {
        setError(broadcastResult.error || "Không thể bắt đầu phát live.");
        return;
      }
    }

    const result = flow.startFlow({});
    if (result?.ok === false) {
      if (broadcastFeatureEnabled && broadcast.isLive) {
        await broadcast.stopBroadcast();
      }
      setError(result.error || "Không thể bắt đầu trình chiếu.");
    }
  };

  const handleSuggestPairs = async () => {
    setError(null);
    setWarnings([]);

    const prepared = await prepareLivePrivatePairingOptions({
      clubId: tournamentClubId,
      tournamentId,
      eventId: savedEvent?.id || `event-${tournamentId}`,
      competitionClass: COMPETITION_CLASS.INTERNAL,
      pairingConstraints: founderConstraints,
    });

    if (!prepared.ok) {
      setError(prepared.error?.message || "Không thể ghép cặp theo quy tắc riêng.");
      setWarnings(
        (prepared.error?.fatalConflicts || prepared.error?.blockedByPolicy || []).map(
          (item) => item.code || item.message || String(item)
        )
      );
      return;
    }

    const pairingOptions = {
      ...prepared.pairingOptions,
      tournamentId,
      eventId: savedEvent?.id || `event-${tournamentId}`,
      pairingConstraints: founderConstraints,
    };

    const entries = suggestEntriesFromPlayers(
      players.filter((player) => selectedPlayerIds.includes(String(player.id))),
      eventType,
      pairingOptions
    );

    applyConstraintWarnings(pairingOptions);

    if (pairingOptions.privatePairingError) {
      setError(pairingOptions.privatePairingError.message);
      return;
    }

    if (entries.length === 0) {
      setError(
        isSingleEvent
          ? "Không tạo được danh sách VĐV. Kiểm tra giới tính và số VĐV đã chọn."
          : "Khong tao duoc cap nao. Kiem tra gioi tinh va so VDV da chon."
      );
      return;
    }

    const selectedPlayers = players.filter((player) =>
      selectedPlayerIds.includes(String(player.id))
    );

    anim.showAnimation(
      {
        animationMode: ANIMATION_MODES.PAIRING_REVEAL,
        pairings: entries,
        steps: buildPairingSteps(entries),
        waitingPlayers: buildPairingWaitingPlayers(entries, selectedPlayers),
        title: isSingleEvent ? "Danh sách VĐV" : "Ghép cặp",
        subtitle: "Reveal từng cặp — danh sách chờ hiển thị từng VĐV",
        revealItemLabel: isSingleEvent ? "VĐV" : "Cặp",
      },
      () => {
        setPreviewEntries(entries);
        setMessage(
          isSingleEvent
            ? `Đã đề xuất ${entries.length} VĐV.`
            : `Da de xuat ${entries.length} cap/đội.`
        );
      }
    );
  };

  const handleBuildGroups = async () => {
    setError(null);
    setWarnings([]);
    setMessage(null);

    const regenCheck = canRegenerateDraw(tournament);
    if (!regenCheck.ok && savedEvent?.groups?.length) {
      setError(regenCheck.error);
      return;
    }

    const prepared = await prepareLivePrivatePairingOptions({
      clubId: tournamentClubId,
      tournamentId,
      eventId: savedEvent?.id || `event-${tournamentId}`,
      competitionClass: COMPETITION_CLASS.INTERNAL,
      pairingConstraints: founderConstraints,
    });

    if (!prepared.ok) {
      setError(prepared.error?.message || "Không thể áp dụng quy tắc riêng.");
      setWarnings(
        (prepared.error?.fatalConflicts || prepared.error?.blockedByPolicy || []).map(
          (item) => item.code || item.message || String(item)
        )
      );
      return;
    }

    let entries = previewEntries;
    if (previewEntries.length === 0) {
      const pairingOptions = {
        ...prepared.pairingOptions,
        tournamentId,
        eventId: savedEvent?.id || `event-${tournamentId}`,
        pairingConstraints: founderConstraints,
      };

      entries = suggestEntriesFromPlayers(
        players.filter((player) => selectedPlayerIds.includes(String(player.id))),
        eventType,
        pairingOptions
      );

      applyConstraintWarnings(pairingOptions);

      if (pairingOptions.privatePairingError) {
        setError(pairingOptions.privatePairingError.message);
        return;
      }
    }

    const plan = buildInternalTournamentPlan({
      tournament,
      players,
      selectedPlayerIds,
      eventType,
      groupCount,
      manualEntries: entries,
      pairingConstraints: founderConstraints,
      privatePairingRules: prepared.pairingOptions?.privatePairingRules || [],
      clubId: tournamentClubId,
      competitionClass: COMPETITION_CLASS.INTERNAL,
      envSource: prepared.pairingOptions?.envSource,
      seed: prepared.pairingOptions?.seed,
      allowedByPublishedRules: prepared.pairingOptions?.allowedByPublishedRules,
      contextTime: prepared.pairingOptions?.contextTime,
    });

    if (!plan.ok) {
      setError(plan.privatePairingError?.message || plan.errors?.join(" "));
      setWarnings(plan.warnings || []);
      return;
    }

    const selectedPlayers = players.filter((player) =>
      selectedPlayerIds.includes(String(player.id))
    );

    const steps = buildSnakeSteps({
      entries: plan.event.entries,
      players: selectedPlayers,
      groupCount,
      finalGroups: plan.event.groups,
    });

    pendingPlanRef.current = plan;

    const openMatchPairingFromDraw = () => {
      openMatchPairingAnimation(plan);
    };

    anim.showAnimation(
      {
        animationMode: ANIMATION_MODES.SNAKE_GROUP,
        groups: plan.event.groups,
        steps,
        matchCount: plan.matchCount,
        onStartMatchPairing: openMatchPairingFromDraw,
      },
      () => {
        const patch = buildInternalTournamentPatch(tournament, plan);
        if (!patch.ok) {
          setError(patch.error || "Khong luu duoc giai.");
          return;
        }

        const eventWithoutMatches = stripMatchesFromEvent(patch.events[0]);
        const result = advanceTournamentStatus(tournamentClubId, tournamentId, TOURNAMENT_STATUS.READY, {
          events: [eventWithoutMatches],
        });

        if (!result.ok) {
          setError(result.error);
          return;
        }

        const created = recordDrawCreated(
          getTournament(tournamentClubId, tournamentId),
          patch.events[0]?.groups || [],
          {
            userId: user?.id,
            actor: buildDrawActor(),
            clubId: tournamentClubId,
            before: summarizeGroups(savedEvent?.groups || []),
          }
        );
        if (created.ok) {
          updateTournament(tournamentClubId, tournamentId, {
            settings: created.tournament.settings,
          });
        }

        setWarnings(patch.warnings || []);
        setLocalRevision((value) => value + 1);
        refreshClubs();
        setMessage(`Đã chia ${patch.events[0].groups.length} bảng. Bấm "Ghép cặp thi đấu" trên màn hình kết quả.`);
      }
    );
  };

  const persistMatchPairing = (plan) => {
    if ((savedEvent?.matches?.length || 0) > 0) {
      return true;
    }

    const patch = buildInternalTournamentPatch(tournament, plan);
    if (!patch.ok) {
      setError(patch.error || "Không lưu được lịch thi đấu.");
      return false;
    }

    const result = advanceTournamentStatus(tournamentClubId, tournamentId, TOURNAMENT_STATUS.READY, {
      events: patch.events,
    });

    if (!result.ok) {
      setError(result.error);
      return false;
    }

    pendingPlanRef.current = null;
    setWarnings(patch.warnings || []);
    setLocalRevision((value) => value + 1);
    refreshClubs();
    setMessage(`Đã ghép ${patch.matchCount} trận vòng bảng. Xem lịch bên dưới.`);
    return true;
  };

  const openMatchPairingAnimation = (plan) => {
    if (!plan?.ok || !plan.event?.groups?.length) {
      setError("Chưa có bảng đấu để ghép cặp.");
      return;
    }

    const steps = buildGroupMatchPairingSteps({
      groups: plan.event.groups,
      matches: plan.event.matches,
      entries: plan.event.entries,
      courts,
    });

    if (!steps.length) {
      setError("Không có trận đấu để ghép cặp.");
      return;
    }

    anim.transitionAnimation(
      {
        animationMode: ANIMATION_MODES.GROUP_MATCH_PAIRING,
        tournamentName: tournament.name,
        groups: plan.event.groups,
        entries: plan.event.entries,
        steps,
        courts,
        autoStart: true,
        controlMode: PAIRING_CONTROL_MODES.AUTO,
        autoNextGroup: true,
      },
      () => {
        persistMatchPairing(plan);
      }
    );
  };

  if (!tournament) {
    return (
      <Box>
        <Alert severity="error">
          {buildTournamentNotFoundMessage(tournamentId, { kind: "giải nội bộ" })}
        </Alert>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
          <Button component={RouterLink} to="/tournament" variant="outlined">
            Quay lại danh sách giải
          </Button>
          <Button component={RouterLink} to="/tournament" variant="contained">
            Tạo lại giải trên Preview hiện tại
          </Button>
        </Stack>
      </Box>
    );
  }

  if (tournament.mode !== TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
    return (
      <Box>
        <Alert severity="warning">Giai nay khong phai che do noi bo.</Alert>
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
      description="Giải nội bộ — đơn/đôi, chia bảng snake seeding, tạo lịch vòng bảng"
      onBack={() => navigate("/tournament")}
      headerActions={
        savedEvent?.matches?.length > 0 ? (
          <Button
            variant="outlined"
            onClick={() => navigate(`/tournament/director/${tournamentId}`)}
          >
            Mở Director Mode
          </Button>
        ) : null
      }
      alerts={
        <>
          {broadcastFeatureEnabled && broadcast.lastVodUpload ? (
            <BroadcastVodResultAlert
              result={broadcast.lastVodUpload}
              onClose={broadcast.clearLastVodUpload}
            />
          ) : null}
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
          {playersLoadError && (
            <Alert
              severity={playersLoadError.severity === "warning" ? "warning" : "error"}
              sx={{ mb: 2 }}
            >
              {playersLoadError.message}
            </Alert>
          )}
          {warnings.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {warnings.join(" ")}
            </Alert>
          )}
        </>
      }
      setupTab={setupTab}
      onSetupTabChange={(_, value) => setSetupTab(value)}
      showAiTab={aiEnabled}
    >
      {aiEnabled && setupTab === 1 ? (
        <TournamentAiAssistantPanel
          tournamentId={tournamentId}
          clubId={tournamentClubId}
          tenantId={
            currentTenantId ||
            tournament?.tenantId ||
            resolvePairingScopeTenantId({
              tournamentTenantId: tournament?.tenantId,
              clubId: tournamentClubId,
              clubs,
              currentTenantId,
            })
          }
          players={players}
          courts={courts}
          userId={user?.id || ""}
          onApplied={() => {
            setLocalRevision((v) => v + 1);
            refreshClubs();
            setMessage("Đã áp dụng đề xuất AI.");
          }}
        />
      ) : (
      <>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12 }}>
          <RefereeRosterPanel roster={refereeRoster} onChange={handleRefereeRosterChange} />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <FounderPairingConstraintsPanel
            constraints={founderConstraints}
            players={players}
            onChange={setFounderConstraints}
            onSave={handleSaveFounderConstraints}
          />

          <RegistrationOpsPanel
            tournament={tournament}
            event={savedEvent}
            players={players}
            actor={
              user
                ? { id: user.id, email: user.email || "", name: user.displayName || user.name || "" }
                : null
            }
            clubId={tournamentClubId}
            onPersist={(nextTournament) => {
              const result = updateTournament(tournamentClubId, tournamentId, {
                events: nextTournament.events,
                settings: nextTournament.settings,
                status: nextTournament.status,
              });
              if (result.ok) {
                setLocalRevision((value) => value + 1);
                refreshClubs();
                return true;
              }
              setError(result.error);
              return false;
            }}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Nội dung</InputLabel>
            <Select
              label="Nội dung"
              value={eventType}
              onChange={(event) => setEventType(event.target.value)}
            >
              {EVENT_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Số bảng"
            value={groupCount}
            inputProps={{ min: 1, max: 16 }}
            onChange={(event) => setGroupCount(Number(event.target.value) || 1)}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={1}>
            <Button
              fullWidth
              variant="contained"
              color="secondary"
              onClick={handleStartGuidedFlow}
              disabled={selectedPlayerIds.length === 0}
            >
              Bắt đầu trình chiếu
            </Button>
            {broadcastFeatureEnabled ? (
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setBroadcastDialogOpen(true)}
              >
                Cài đặt phát live
              </Button>
            ) : null}
            {broadcastFeatureEnabled && broadcast.isLive ? (
              <BroadcastLiveIndicator status={broadcast.status} error={broadcast.error} />
            ) : null}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button fullWidth variant="outlined" onClick={handleSuggestPairs}>
                {isSingleEvent ? "Đề xuất danh sách" : "Đề xuất ghép cặp"}
              </Button>
              <Button fullWidth variant="contained" onClick={handleBuildGroups}>
                Chia bảng
              </Button>
            </Stack>
          </Stack>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
              Chọn VĐV tham gia ({selectedPlayerIds.length}
              {isSingleEvent ? ` / ${eligiblePlayers.length} đủ điều kiện` : ""})
            </Typography>
            <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
              <InputLabel id="source-club-label">Câu lạc bộ</InputLabel>
              <Select
                labelId="source-club-label"
                label="Câu lạc bộ"
                value={sourceClubId}
                onChange={(event) => handleSourceClubChange(event.target.value)}
              >
                {clubs.map((club) => (
                  <MenuItem key={club.id} value={club.id}>
                    {club.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <Button
                size="small"
                variant="contained"
                onClick={handleSelectAllPlayers}
                disabled={!sourceClubId || eligiblePlayers.length === 0}
              >
                Chọn tất cả
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={handleClearAllPlayers}
                disabled={selectedPlayerIds.length === 0}
              >
                Bỏ chọn tất cả
              </Button>
            </Stack>
            <Stack spacing={1} sx={{ maxHeight: 360, overflow: "auto" }}>
              {!sourceClubId ? (
                <Typography variant="body2" color="text.secondary">
                  Chọn câu lạc bộ để xem danh sách thành viên.
                </Typography>
              ) : eligiblePlayers.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {playersLoadError?.message ? (
                    playersLoadError.message
                  ) : (
                    <>
                      CLB này chưa có thành viên. Thêm tại{" "}
                      <Link
                        component={RouterLink}
                        to={`/clubs/${sourceClubId}?tab=members`}
                        underline="hover"
                      >
                        Quản lý CLB → Thành viên
                      </Link>
                      .
                    </>
                  )}
                </Typography>
              ) : (
                eligiblePlayers.map((player) => {
                  const checked = selectedPlayerIds.includes(String(player.id));
                  return (
                    <Button
                      key={player.id}
                      fullWidth
                      variant={checked ? "contained" : "outlined"}
                      onClick={() => togglePlayer(player.id)}
                      sx={{ justifyContent: "space-between", minHeight: 44 }}
                    >
                      <span>{player.name}</span>
                      <span>
                        {formatOrganizerPlayerMeta(player, canViewSkillInSetup)}
                      </span>
                    </Button>
                  );
                })
              )}
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <TournamentSelectedPlayersPanel
            title="VĐV đã chọn"
            players={selectedPlayers}
            onRemove={handleRemoveSelectedPlayer}
            emptyMessage="Chưa chọn VĐV nào. Bấm tên VĐV bên trái để thêm."
          />
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
              {isSingleEvent ? "VĐV đăng ký" : "Cặp / đội đề xuất"} (
              {previewEntries.length || savedEvent?.entries?.length || 0})
            </Typography>
            <Stack spacing={1} sx={{ maxHeight: 220, overflow: "auto" }}>
              {(previewEntries.length ? previewEntries : savedEvent?.entries || []).map(
                (entry) => (
                  <Paper key={entry.id} variant="outlined" sx={{ p: 1 }}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Typography variant="body2" fontWeight="bold">
                        {entry.name}
                      </Typography>
                      <Chip size="small" label={`Seed ${entry.seed || "-"}`} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {isSingleEvent
                        ? `Rating: ${entry.rating}`
                        : `Rating đội: ${entry.rating}`}
                    </Typography>
                    <TournamentRegistrationRatingPanel
                      players={resolveTournamentEntryPlayers(entry, tenantPlayers)}
                      tournamentId={tournamentId}
                      hostClubId={tournamentClubId || activeClubId}
                      compact
                      onVerified={() => {
                        refreshClubs();
                        setLocalRevision((value) => value + 1);
                      }}
                    />
                  </Paper>
                )
              )}
            </Stack>
          </Paper>

          <TournamentEntryEditor
            entries={editorEntries}
            players={players}
            eventType={eventType}
            canIntervene={canInterveneSetup && editorEntries.length > 0}
            tournamentId={tournamentId}
            eventId={savedEvent?.id || ""}
            onApply={handleEntryInterventionApply}
            onAudit={pairingIntervention.auditEntryChange}
          />

          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
              Bảng đấu ({savedEvent?.groups?.length || 0})
            </Typography>
            {!savedEvent?.groups?.length ? (
              <Typography variant="body2" color="text.secondary">
                Chưa chia bảng. Chọn VĐV, đề xuất cặp rồi bấm &quot;Chia bảng&quot;.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {savedEvent.groups.map((group) => (
                  <Paper key={group.id} variant="outlined" sx={{ p: 1.25 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography fontWeight="bold">{group.name}</Typography>
                      <Chip
                        size="small"
                        label={`${group.entryIds?.length || 0} đội • ${group.matches?.length || 0} trận`}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {(group.entries || []).map((entry) => entry.name).join(" | ")}
                    </Typography>
                  </Paper>
                ))}
                <DrawPublishControls
                  tournament={tournament}
                  groups={savedEvent.groups}
                  drawPublish={drawPublish}
                  hasReopenPermission={hasDrawReopenPermission}
                  onLock={handleLockDraw}
                  onPublish={handlePublishDraw}
                  onReopen={handleReopenDraw}
                  onForceRedraw={handleForceRedraw}
                  compact
                />
                <Button
                  component={RouterLink}
                  to={`/tournament/publish-schedule?tournamentId=${encodeURIComponent(tournamentId)}`}
                  variant="outlined"
                  size="small"
                  fullWidth
                >
                  Lịch thi đấu & công bố (S1-E)
                </Button>
              </Stack>
            )}
          </Paper>

          <TournamentGroupEditor
            groups={savedEvent?.groups || []}
            entries={savedEvent?.entries || editorEntries}
            players={players}
            canIntervene={canInterveneSetup && (savedEvent?.groups?.length || 0) > 0}
            tournamentId={tournamentId}
            eventId={savedEvent?.id || ""}
            onApply={handleGroupInterventionApply}
            onAudit={pairingIntervention.auditGroupChange}
          />
        </Grid>
      </Grid>

      {savedEvent?.groups?.length > 0 && (
        <Stack spacing={2} sx={{ mt: 2 }}>
          <GroupStagePanel
            event={savedEvent}
            players={players}
            onSubmitScore={handleSubmitGroupScore}
            draftScope={scoreDraftScope}
          />

          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
              Bảng xếp hạng vòng bảng
            </Typography>
            {groupStandings[0]?.tieBreakExplanation ? (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Tie-break: {groupStandings[0].tieBreakExplanation}
                {groupStandings[0].source === "standings_v2" ? " · STANDINGS_V2" : " · Legacy"}
              </Typography>
            ) : null}
            {groupStandings.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Chưa có kết quả trận vòng bảng. Nhập kết quả để tính BXH trước khi tạo bracket.
              </Typography>
            ) : (
              <Grid container spacing={1.5}>
                {groupStandings.map((groupStanding) => (
                  <Grid key={groupStanding.group} size={{ xs: 12, md: 6, lg: 3 }}>
                    <Paper variant="outlined" sx={{ p: 1.25 }}>
                      <Typography fontWeight="bold" sx={{ mb: 0.75 }}>
                        Bảng {groupStanding.group}
                      </Typography>
                      <Stack spacing={0.5}>
                        {groupStanding.standing.map((team, index) => (
                          <Typography
                            key={team.id}
                            variant="body2"
                            fontWeight={index < 2 ? "bold" : "regular"}
                          >
                            {index + 1}. {team.name} — {team.matchPoints} điểm
                            {team.qualificationStatus?.startsWith("qualified") ? " ✓ KO" : ""}
                          </Typography>
                        ))}
                      </Stack>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", sm: "center" }}
              sx={{ mb: 1.5 }}
            >
              <Typography variant="subtitle1" fontWeight="bold">
                Sơ đồ knock-out
              </Typography>
              <Stack direction="row" spacing={1}>
                {savedEvent?.bracket?.rounds?.length > 0 && (
                  <Button
                    component={RouterLink}
                    to={`/tournament/internal/${tournamentId}/bracket`}
                    variant="outlined"
                  >
                    Mở sơ đồ đầy đủ
                  </Button>
                )}
                {!savedEvent?.bracket?.rounds?.length && (
                  <Button variant="contained" onClick={handleGenerateBracket}>
                    Tạo bracket từ BXH
                  </Button>
                )}
              </Stack>
            </Stack>

            {!savedEvent?.bracket?.rounds?.length ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Chưa có sơ đồ. Nhập điểm vòng bảng xong rồi bấm &quot;Tạo bracket từ BXH&quot;.
                Cần số bảng chẵn (2, 4, 8...).
              </Typography>
            ) : null}

            <BracketView
              progress={bracketProgress}
              unlockedRounds={savedEvent?.bracket?.unlockedRounds || {}}
              knockoutMatchesByBracketId={knockoutMatchesByBracketId}
              onSelectWinner={handleSelectBracketWinner}
              onToggleRoundLock={handleToggleRoundLock}
              onSubmitScore={handleSubmitKnockoutScore}
              onReset={handleResetBracket}
              canReset={Boolean(savedEvent?.bracket?.rounds?.length)}
              draftScope={scoreDraftScope}
            />
          </Paper>
        </Stack>
      )}

      <TournamentAnimationDialog
        {...flow.dialogProps}
        onFlowExit={handleFlowExit}
        broadcastStatus={broadcastFeatureEnabled ? broadcast.status : undefined}
        broadcastError={broadcastFeatureEnabled ? broadcast.error : undefined}
      />

      {broadcastFeatureEnabled ? (
        <BroadcastSetupDialog
          open={broadcastDialogOpen}
          tournamentId={tournamentId}
          config={broadcast.config}
          onChange={broadcast.updateConfig}
          onClose={() => setBroadcastDialogOpen(false)}
        />
      ) : null}

      {bracketAdvanceAnim && (
        <Box
          sx={{
            position: "fixed",
            bottom: 16,
            left: 16,
            right: 16,
            zIndex: 1300,
            maxWidth: 360,
            mx: "auto",
          }}
        >
          <BracketRevealAnimation
            animationMode={ANIMATION_MODES.BRACKET_ADVANCE}
            advanceHint={bracketAdvanceAnim}
            bracket={bracketAdvanceAnim.bracket}
            onAnimationComplete={() => setBracketAdvanceAnim(null)}
            onSkip={() => setBracketAdvanceAnim(null)}
          />
        </Box>
      )}

      {tournament && (
        <Box sx={{ mt: 3 }}>
          <TournamentCourtSchedulePanel
            clubId={tournamentClubId}
            tournament={tournament}
            courts={courts}
            onSaved={() => {
              refreshClubs();
              setLocalRevision((value) => value + 1);
            }}
          />
        </Box>
      )}
      </>
      )}
    </TournamentSetupShell>
    </TournamentManageGate>
  );
}
