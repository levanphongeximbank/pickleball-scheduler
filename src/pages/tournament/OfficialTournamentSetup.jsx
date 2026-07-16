import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";

import { useClub } from "../../context/ClubContext.jsx";
import { loadCourtsForClub } from "../../domain/clubStorage.js";
import {
  useClubPairingCandidatePool,
  useTenantPairingCandidatePool,
} from "../../features/pairing-candidates/index.js";
import TournamentVprPanel from "../../features/vpr-ranking/components/TournamentVprPanel.jsx";
import {
  getTournament,
  advanceTournamentStatus,
  updateTournament,
} from "../../domain/tournamentService.js";
import {
  EVENT_TYPE,
  OFFICIAL_MODE,
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  EVENT_TYPE_OPTIONS,
} from "../../models/tournament/index.js";
import { buildIndividualAllGroupStandings } from "../../features/individual-tournament/adapters/individualStandingsAdapter.js";
import {
  buildOfficialAiBalancePatch,
  buildOfficialAiBalancePlan,
  buildOfficialOpenPatch,
  buildOfficialOpenPlan,
  canGenerateBracket,
  createOfficialEventRecord,
  createOpenEntryFromPair,
  createOpenEntryFromPlayer,
  generateKnockoutBracket,
  isSingleEventType,
  resetBracketState,
  resolveBracketProgress,
  setBracketWinner,
  submitKnockoutMatchScore,
  submitTournamentDirectorMatchScore,
  suggestBalancedEntriesFromIndividuals,
  toggleBracketRoundUnlock,
  upsertOfficialEvent,
  validateOpenRegistrationPlayers,
} from "../../tournament/engines/index.js";
import BracketView from "../../components/tournament/BracketView.jsx";
import RefereeRosterPanel from "../../components/tournament/RefereeRosterPanel.jsx";
import GroupStagePanel from "../../components/tournament/GroupStagePanel.jsx";
import TournamentAnimationDialog from "../../components/tournament/animation/TournamentAnimationDialog.jsx";
import BracketRevealAnimation from "../../components/tournament/animation/BracketRevealAnimation.jsx";
import {
  ANIMATION_MODES,
  buildGroupMatchPairingSteps,
  buildPairingSteps,
  buildPairingWaitingPlayers,
  buildRandomDrawSteps,
  buildSnakeSteps,
  stripMatchesFromEvent,
} from "../../components/tournament/animation/animationUtils.js";
import {
  buildRefereeSettingsPatch,
  getRefereeSettings,
} from "../../tournament/engines/refereeEngine.js";
import { useTournamentAnimation } from "../../components/tournament/animation/useTournamentAnimation.js";
import { useTournamentFlowOrchestrator } from "../../components/tournament/animation/useTournamentFlowOrchestrator.js";
import { createOfficialFlowAdapters } from "../../components/tournament/animation/tournamentFlowAdapters.js";
import {
  BroadcastLiveIndicator,
  BroadcastSetupDialog,
  BroadcastVodResultAlert,
  isTournamentBroadcastEnabled,
  useTournamentBroadcast,
} from "../../features/tournament-broadcast/index.js";
import { resolveOfficialOpenPipeline } from "../../components/tournament/animation/shared/tournamentFlowConfig.js";
import { PAIRING_CONTROL_MODES } from "../../components/tournament/animation/pairing/usePairingSequence.js";
import TournamentManageGate from "../../components/tournament/TournamentManageGate.jsx";
import TournamentSetupShell from "../../components/tournament/TournamentSetupShell.jsx";
import TournamentSelectedPlayersPanel from "../../components/tournament/TournamentSelectedPlayersPanel.jsx";
import TournamentPlayerPickerPanel from "../../components/tournament/TournamentPlayerPickerPanel.jsx";
import TournamentPlayerQuickAddDialog from "../../components/tournament/TournamentPlayerQuickAddDialog.jsx";
import TournamentCourtSchedulePanel from "../../components/tournament/TournamentCourtSchedulePanel.jsx";
import {
  resolveTournamentEntryPlayers,
  TournamentRegistrationRatingPanel,
} from "../../features/pick-vn-rating/index.js";
import {
  ALL_CLUBS_FILTER,
  filterTournamentPickerPlayers,
  formatPlayerPickerMeta,
} from "../../utils/tournamentPlayerPicker.js";
import { isAiEngineEnabled } from "../../features/ai-assistant/index.js";
import TournamentAiAssistantPanel from "../../components/tournament/ai/TournamentAiAssistantPanel.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { canViewPlayerSkillLevel } from "../../auth/rbac.js";
import { useTenant } from "../../context/TenantContext.jsx";
import { resolveTenantIdForClub } from "../../features/tenant/guards/tenantGuard.js";
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

const OFFICIAL_MODE_OPTIONS = [
  { value: OFFICIAL_MODE.OPEN, label: "Open Mode" },
  { value: OFFICIAL_MODE.AI_BALANCE, label: "AI Balance Mode" },
];

export default function OfficialTournamentSetup() {
  const { tournamentId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeClub, activeClubId, clubs, refreshClubs } = useClub();
  const { user, rbacEnabled, can } = useAuth();
  const { currentTenantId } = useTenant();
  const aiEnabled = isAiEngineEnabled();
  const [setupTab, setSetupTab] = useState(0);
  const [localRevision, setLocalRevision] = useState(0);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);

  const [officialMode, setOfficialMode] = useState(OFFICIAL_MODE.OPEN);
  const [activeEventId, setActiveEventId] = useState("");
  const preselectedEvent = resolveEventTypeFromQuery(searchParams.get("event"));
  const [eventType, setEventType] = useState(preselectedEvent || EVENT_TYPE.MEN_DOUBLE);
  const [groupCount, setGroupCount] = useState(4);
  const [splitUnits, setSplitUnits] = useState(true);
  const [registeredEntries, setRegisteredEntries] = useState([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
  const [sourceClubFilter, setSourceClubFilter] = useState(ALL_CLUBS_FILTER);
  const [previewEntries, setPreviewEntries] = useState([]);
  const [founderConstraints, setFounderConstraints] = useState([]);
  const [pairPlayerAId, setPairPlayerAId] = useState("");
  const [pairPlayerBId, setPairPlayerBId] = useState("");
  const [entryClubName, setEntryClubName] = useState("");
  const [pickerGenderFilter, setPickerGenderFilter] = useState("all");
  const [pickerSearch, setPickerSearch] = useState("");
  const [openClubFilter, setOpenClubFilter] = useState(ALL_CLUBS_FILTER);
  const [openRegistrationTab, setOpenRegistrationTab] = useState(0);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [bracketAdvanceAnim, setBracketAdvanceAnim] = useState(null);
  const anim = useTournamentAnimation();
  const pendingPlanRef = useRef(null);

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

  useEffect(() => {
    if (tournament) {
      setFounderConstraints(getTournamentPairingConstraints(tournament));
    }
  }, [tournament?.id, tournament?.founderPairingConstraints]);

  const tenantId = useMemo(
    () => tournament?.tenantId || resolveTenantIdForClub(activeClubId) || currentTenantId || "",
    [tournament?.tenantId, activeClubId, currentTenantId]
  );

  const {
    players: allTenantPlayers,
    error: tenantPlayersError,
  } = useTenantPairingCandidatePool(tenantId, {
    revision: localRevision,
  });
  const {
    players,
    error: clubPlayersError,
  } = useClubPairingCandidatePool(activeClubId, {
    tenantId,
    revision: localRevision,
  });
  const playersLoadError = clubPlayersError || tenantPlayersError;

  const isAiBalance = officialMode === OFFICIAL_MODE.AI_BALANCE;

  const selectedPlayers = useMemo(() => {
    const pool = new Map(allTenantPlayers.map((player) => [String(player.id), player]));
    return selectedPlayerIds
      .map((id) => pool.get(String(id)))
      .filter(Boolean);
  }, [selectedPlayerIds, allTenantPlayers]);

  const flowPlayers = allTenantPlayers;

  const courts = useMemo(
    () => loadCourtsForClub(activeClubId),
    [activeClubId, localRevision]
  );

  const refereeRoster = useMemo(
    () => getRefereeSettings(tournament).roster,
    [tournament, localRevision]
  );

  const savedEvents = tournament?.events || [];
  const savedEvent =
    savedEvents.find((event) => String(event.id) === String(activeEventId)) ||
    savedEvents[0] ||
    null;

  const displayEntries = isAiBalance
    ? previewEntries.length > 0
      ? previewEntries
      : savedEvent?.entries || []
    : registeredEntries.length > 0
      ? registeredEntries
      : savedEvent?.entries || [];

  const registeredPlayerIds = useMemo(() => {
    const ids = new Set();
    displayEntries.forEach((entry) => {
      (entry.playerIds || []).forEach((id) => ids.add(String(id)));
    });
    return Array.from(ids);
  }, [displayEntries]);

  const openFilteredPlayers = useMemo(
    () =>
      filterTournamentPickerPlayers(allTenantPlayers, {
        clubFilter: openClubFilter,
        genderFilter: pickerGenderFilter,
        search: pickerSearch,
        eventType,
        excludePlayerIds: registeredPlayerIds,
      }),
    [allTenantPlayers, openClubFilter, pickerGenderFilter, pickerSearch, eventType, registeredPlayerIds]
  );

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
      clubId: activeClubId,
      tournamentId,
      eventId: savedEvent?.id,
    }),
    [activeClubId, tournamentId, savedEvent?.id]
  );

  useEffect(() => {
    if (tournament?.officialMode) {
      setOfficialMode(tournament.officialMode);
    }
  }, [tournament?.officialMode]);

  useEffect(() => {
    if (!activeEventId && savedEvents[0]?.id) {
      setActiveEventId(savedEvents[0].id);
    }
  }, [activeEventId, savedEvents]);

  const persistTournament = (patch, options = {}) => {
    const { status, ...dataPatch } = patch;
    const result = status
      ? advanceTournamentStatus(activeClubId, tournamentId, status, dataPatch)
      : updateTournament(activeClubId, tournamentId, patch, options);

    if (!result.ok) {
      setError(result.error);
      return false;
    }

    setLocalRevision((value) => value + 1);
    refreshClubs();
    return true;
  };

  const persistEvent = (nextEvent, options = {}) => {
    if (!savedEvent) {
      return false;
    }

    const { processMatchId, ...extraPatch } = options;
    const events = upsertOfficialEvent(savedEvents, { ...savedEvent, ...nextEvent });
    return persistTournament(
      {
        events,
        ...extraPatch,
      },
      {
        processMatchId: processMatchId || null,
        processEventId: savedEvent?.id || null,
      }
    );
  };

  const pairingIntervention = usePairingIntervention({
    phase: INTERVENTION_PHASE.TOURNAMENT,
    tournamentStatus: tournament?.status,
    clubId: activeClubId,
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
      clubId: activeClubId,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (persistTournament({ settings: result.tournament.settings })) {
      setMessage("Đã khóa bốc thăm. Sẵn sàng công bố.");
    }
  };

  const handlePublishDraw = () => {
    setError(null);
    const groups = savedEvent?.groups || [];
    const result = publishDraw(tournament, groups, {
      userId: user?.id,
      actor: buildDrawActor(),
      clubId: activeClubId,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const events = (savedEvents || []).map((event) =>
      String(event.id) === String(savedEvent?.id)
        ? { ...event, groups: result.snapshot || groups }
        : event
    );
    if (
      persistTournament({
        settings: result.tournament.settings,
        events,
      })
    ) {
      setMessage("Đã công bố bốc thăm. Bracket bất biến.");
    }
  };

  const handleReopenDraw = () => {
    setError(null);
    const result = reopenDraw(tournament, {
      userId: user?.id,
      actor: buildDrawActor(),
      clubId: activeClubId,
      hasReopenPermission: hasDrawReopenPermission,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (persistTournament({ settings: result.tournament.settings })) {
      setMessage("Đã mở lại bốc thăm để chỉnh sửa.");
    }
  };

  const handleForceRedraw = () => {
    setError(null);
    const result = forceRedrawDraw(tournament, {
      userId: user?.id,
      actor: buildDrawActor(),
      clubId: activeClubId,
      hasReopenPermission: hasDrawReopenPermission,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (persistTournament({ settings: result.tournament.settings })) {
      setMessage("Force redraw được phép. Bạn có thể random lại.");
    }
  };

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
    const result = updateTournament(activeClubId, tournamentId, {
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
      clubId: activeClubId,
      before,
      after: founderConstraints,
    });
  };

  const applyConstraintWarnings = (pairingOptions) => {
    const constraintWarnings = pairingOptions?.constraintWarnings || [];
    if (constraintWarnings.length > 0) {
      setWarnings(
        constraintWarnings.map((item) =>
          typeof item === "string" ? item : item.message || String(item)
        )
      );
    }
  };

  const flowAdapters = useMemo(() => {
    const shared = {
      tournament,
      players: flowPlayers,
      courts,
      selectedPlayerIds,
      eventType,
      groupCount,
      isAiBalance,
      displayEntries,
      persistTournament,
      persistEvent,
      setPreviewEntries,
      setWarnings,
      setMessage,
      setError,
      setLocalRevision,
      refreshClubs,
      getSavedEvent: () => savedEvent,
    };

    if (isAiBalance) {
      return createOfficialFlowAdapters({
        ...shared,
        variant: "ai_balance",
        suggestEntries: (selected, et) =>
          suggestBalancedEntriesFromIndividuals(selected, et, {
            tournamentId,
            eventId: savedEvent?.id || `event-${tournamentId}`,
          }),
        buildPlan: ({ manualEntries }) =>
          buildOfficialAiBalancePlan({
            tournament,
            eventId: savedEvent?.id,
            players: flowPlayers,
            selectedPlayerIds,
            eventType,
            groupCount,
            manualEntries,
            individualRegistration: true,
          }),
        buildPatch: buildOfficialAiBalancePatch,
      });
    }

    return createOfficialFlowAdapters({
      ...shared,
      variant: "open",
      isAiBalance: false,
      suggestEntries: () => displayEntries,
      buildPlan: () =>
        buildOfficialOpenPlan({
          tournament: {
            ...tournament,
            hostClubName: tournament.hostClubName || activeClub?.name || "",
          },
          entries: displayEntries,
          eventType,
          eventId: savedEvent?.id,
          groupCount,
          players: flowPlayers,
          splitUnits,
        }),
      buildPatch: buildOfficialOpenPatch,
    });
  }, [
    isAiBalance,
    tournament,
    flowPlayers,
    courts,
    selectedPlayerIds,
    eventType,
    groupCount,
    displayEntries,
    savedEvent,
    splitUnits,
    activeClub,
    tournamentId,
    refreshClubs,
    persistTournament,
    persistEvent,
  ]);

  const flow = useTournamentFlowOrchestrator(anim, flowAdapters);

  const broadcastFeatureEnabled = isTournamentBroadcastEnabled();
  const broadcast = useTournamentBroadcast({
    tournamentId,
    tournamentName: tournament?.name || "Giải đấu",
    clubId: activeClubId,
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

  const handleStartGuidedFlow = async () => {
    setError(null);
    setWarnings([]);
    setMessage(null);

    if (broadcastFeatureEnabled && broadcast.shouldBroadcastWithFlow) {
      const broadcastResult = await broadcast.startBroadcast();
      if (broadcastResult?.ok === false) {
        setError(broadcastResult.error || "Không thể bắt đầu phát live.");
        return;
      }
    }

    const pipeline = isAiBalance
      ? undefined
      : resolveOfficialOpenPipeline({
          includeBracket: savedEvent ? canGenerateBracket(savedEvent).ok : true,
        });

    const result = flow.startFlow({}, { pipeline });
    if (result?.ok === false) {
      if (broadcastFeatureEnabled && broadcast.isLive) {
        await broadcast.stopBroadcast();
      }
      setError(result.error || "Không thể bắt đầu trình chiếu.");
    }
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

  const handleOfficialModeChange = (nextMode) => {
    setOfficialMode(nextMode);
    setPreviewEntries([]);
    setRegisteredEntries([]);
    setSelectedPlayerIds([]);
    persistTournament({ officialMode: nextMode });
  };

  const handleAddEvent = () => {
    const newEvent = createOfficialEventRecord(tournament, { eventType });
    const events = [...savedEvents, newEvent];
    if (persistTournament({ events })) {
      setActiveEventId(newEvent.id);
      setMessage(`Da them noi dung "${newEvent.name}".`);
    }
  };

  const toggleAiPlayer = (playerId) => {
    const key = String(playerId);
    setSelectedPlayerIds((current) =>
      current.includes(key) ? current.filter((id) => id !== key) : [...current, key]
    );
  };

  const handleSelectAllAiPlayers = (playerIds = []) => {
    setSelectedPlayerIds((current) => {
      const merged = new Set([...current, ...playerIds.map(String)]);
      return Array.from(merged);
    });
  };

  const handleClearAllAiPlayers = () => {
    setSelectedPlayerIds([]);
  };

  const handleQuickAddSaved = (player) => {
    refreshClubs();
    setLocalRevision((value) => value + 1);

    if (isAiBalance) {
      setSelectedPlayerIds((current) =>
        current.includes(String(player.id)) ? current : [...current, String(player.id)]
      );
      setMessage(`Đã thêm và chọn ${player.name}.`);
      return;
    }

    if (!isAiBalance && isSingleEventType(eventType)) {
      registerPlayerEntry(player);
      return;
    }

    setMessage(`Đã thêm ${player.name}. Chọn VĐV trong dropdown để đăng ký cặp.`);
  };

  const registerPlayerEntry = (player) => {
    const validation = validateOpenRegistrationPlayers([player], eventType);
    if (!validation.ok) {
      setError(validation.errors.join(" "));
      return false;
    }

    const entry = createOpenEntryFromPlayer(player, {
      tournamentId,
      eventId: savedEvent?.id || `event-${tournamentId}`,
      clubName: entryClubName || player.clubName || activeClub?.name || "",
    });

    if (displayEntries.some((item) => item.id === entry.id)) {
      setError("VDV da dang ky.");
      return false;
    }

    setRegisteredEntries([...displayEntries, entry]);
    setMessage(`Da dang ky ${player.name}.`);
    return true;
  };

  const handleRemoveSelectedAiPlayer = (playerId) => {
    const key = String(playerId);
    setSelectedPlayerIds((current) => current.filter((id) => id !== key));
  };

  const handleSourceClubFilterChange = (value) => {
    setSourceClubFilter(value);
    setSelectedPlayerIds([]);
    setPreviewEntries([]);
  };

  const handleSuggestAiPairs = () => {
    setError(null);
    setWarnings([]);

    const pairingOptions = {
      tournamentId,
      eventId: savedEvent?.id || `event-${tournamentId}`,
      pairingConstraints: founderConstraints,
    };

    const entries = suggestBalancedEntriesFromIndividuals(selectedPlayers, eventType, pairingOptions);

    applyConstraintWarnings(pairingOptions);

    if (entries.length === 0) {
      setError("Khong tao duoc cap/VDV nao. Kiem tra gioi tinh va so luong da chon.");
      return;
    }

    anim.showAnimation(
      {
        animationMode: ANIMATION_MODES.PAIRING_REVEAL,
        pairings: entries,
        steps: buildPairingSteps(entries),
        waitingPlayers: buildPairingWaitingPlayers(entries, selectedPlayers),
        title: "Ghép cặp AI Balance",
        subtitle: "Reveal từng cặp — danh sách chờ hiển thị từng VĐV",
        revealItemLabel: "Cặp",
      },
      () => {
        setPreviewEntries(entries);
        setMessage(`Da de xuat ${entries.length} cap/VDV theo rating.`);
      }
    );
  };

  const handleBuildAiGroups = () => {
    setError(null);
    setWarnings([]);
    setMessage(null);

    const pairingOptions = {
      tournamentId,
      eventId: savedEvent?.id || `event-${tournamentId}`,
      pairingConstraints: founderConstraints,
    };

    const entries =
      previewEntries.length > 0
        ? previewEntries
        : suggestBalancedEntriesFromIndividuals(selectedPlayers, eventType, pairingOptions);

    if (previewEntries.length === 0) {
      applyConstraintWarnings(pairingOptions);
    }

    const plan = buildOfficialAiBalancePlan({
      tournament,
      eventId: savedEvent?.id,
      players: flowPlayers,
      selectedPlayerIds,
      eventType,
      groupCount,
      manualEntries: entries,
      individualRegistration: true,
      pairingConstraints: founderConstraints,
    });

    if (!plan.ok) {
      setError(plan.errors?.join(" "));
      setWarnings(plan.warnings || []);
      return;
    }

    const steps = buildSnakeSteps({
      entries: plan.event.entries,
      players: selectedPlayers,
      groupCount,
      finalGroups: plan.event.groups,
    });

    pendingPlanRef.current = plan;

    anim.showAnimation(
      {
        animationMode: ANIMATION_MODES.SNAKE_GROUP,
        groups: plan.event.groups,
        steps,
        matchCount: plan.matchCount,
        onStartMatchPairing: () => openMatchPairingAnimation(plan),
      },
      () => {
        const patch = buildOfficialAiBalancePatch(tournament, plan);
        if (!patch.ok) {
          setError(patch.error || "Khong luu duoc bang dau.");
          return;
        }

        const events = patch.events.map((event) =>
          String(event.id) === String(patch.event?.id)
            ? stripMatchesFromEvent(event)
            : event
        );

        const saved = persistTournament({
          events,
          officialMode: OFFICIAL_MODE.AI_BALANCE,
          status: TOURNAMENT_STATUS.READY,
          settings: {
            ...(tournament.settings || {}),
            aiBalance: {
              updatedAt: new Date().toISOString(),
            },
          },
        });

        if (!saved) {
          return;
        }

        setPreviewEntries([]);
        setWarnings(patch.warnings || []);
        setActiveEventId(patch.event.id);
        setMessage(`Đã chia ${patch.event.groups.length} bảng. Bấm "Ghép cặp thi đấu" trên màn hình kết quả.`);
      }
    );
  };

  const handleRegisterSingle = (playerId, playerOverride = null) => {
    setError(null);
    const player =
      playerOverride ||
      allTenantPlayers.find((item) => String(item.id) === String(playerId));
    if (!player) {
      return;
    }

    registerPlayerEntry(player);
  };

  const handleRegisterPair = () => {
    setError(null);
    const playerA = allTenantPlayers.find((item) => String(item.id) === String(pairPlayerAId));
    const playerB = allTenantPlayers.find((item) => String(item.id) === String(pairPlayerBId));

    if (!playerA || !playerB) {
      setError("Chon du 2 VDV de dang ky cap.");
      return;
    }

    if (String(playerA.id) === String(playerB.id)) {
      setError("Cap phai gom 2 VDV khac nhau.");
      return;
    }

    const validation = validateOpenRegistrationPlayers([playerA, playerB], eventType);
    if (!validation.ok) {
      setError(validation.errors.join(" "));
      return;
    }

    const entry = createOpenEntryFromPair(playerA, playerB, {
      tournamentId,
      eventId: savedEvent?.id || `event-${tournamentId}`,
      clubName: entryClubName || playerA.clubName || playerB.clubName || activeClub?.name || "",
    });

    const duplicatePlayer = displayEntries.some((item) =>
      (item.playerIds || []).some((id) => entry.playerIds.includes(String(id)))
    );

    if (duplicatePlayer) {
      setError("Mot trong hai VDV da dang ky noi dung khac.");
      return;
    }

    setRegisteredEntries([...displayEntries, entry]);
    setPairPlayerAId("");
    setPairPlayerBId("");
    setMessage(`Da dang ky cap ${entry.name}.`);
  };

  const handleRemoveEntry = (entryId) => {
    setRegisteredEntries(displayEntries.filter((entry) => entry.id !== entryId));
  };

  const handleDrawGroups = (isRedraw = false) => {
    setError(null);
    setWarnings([]);
    setMessage(null);

    if (isRedraw) {
      const regenCheck = canRegenerateDraw(tournament);
      if (!regenCheck.ok) {
        setError(regenCheck.error);
        return;
      }
    }

    if (displayEntries.length < 2) {
      setError("Can it nhat 2 doi/VDV da dang ky.");
      return;
    }

    const plan = buildOfficialOpenPlan({
      tournament: {
        ...tournament,
        hostClubName: tournament.hostClubName || activeClub?.name || "",
      },
      entries: displayEntries,
      eventType,
      eventId: savedEvent?.id,
      groupCount,
      players: flowPlayers,
      splitUnits,
    });

    if (!plan.ok) {
      setError(plan.errors?.join(" "));
      setWarnings(plan.warnings || []);
      return;
    }

    const patch = buildOfficialOpenPatch(tournament, plan);
    if (!patch.ok) {
      setError(patch.error || "Khong luu duoc bang dau.");
      return;
    }

    const steps = buildRandomDrawSteps(plan.event.groups);

    pendingPlanRef.current = plan;

    anim.showAnimation(
      {
        animationMode: ANIMATION_MODES.RANDOM_DRAW,
        steps,
        groups: plan.event.groups,
        matchCount: plan.matchCount,
        onStartMatchPairing: () => openMatchPairingAnimation(plan),
      },
      () => {
        pendingPlanRef.current = plan;

        const events = patch.events.map((event) =>
          String(event.id) === String(patch.event?.id)
            ? stripMatchesFromEvent(event)
            : event
        );

        const saved = persistTournament({
          events,
          officialMode: OFFICIAL_MODE.OPEN,
          hostClubName: tournament.hostClubName || activeClub?.name || "",
          status: TOURNAMENT_STATUS.READY,
          settings: {
            ...(tournament.settings || {}),
            openDraw: {
              splitUnits,
              drawScore: patch.drawScore,
              updatedAt: new Date().toISOString(),
            },
          },
        });

        if (!saved) {
          return;
        }

        const created = recordDrawCreated(
          getTournament(activeClubId, tournamentId),
          patch.events[0]?.groups || [],
          {
            userId: user?.id,
            actor: buildDrawActor(),
            clubId: activeClubId,
            before: isRedraw ? summarizeGroups(savedEvent?.groups || []) : null,
          }
        );
        if (created.ok) {
          persistTournament({ settings: created.tournament.settings });
        }

        setRegisteredEntries([]);
        setWarnings(patch.warnings || []);
        if (patch.event?.id) {
          setActiveEventId(patch.event.id);
        }
        setMessage(
          isRedraw
            ? `Đã random lại ${patch.events[0].groups.length} bảng. Bấm "Ghép cặp thi đấu" trên màn hình kết quả.`
            : `Đã chia ${patch.events[0].groups.length} bảng. Bấm "Ghép cặp thi đấu" trên màn hình kết quả.`
        );
      }
    );
  };

  const persistMatchPairing = (plan) => {
    if ((savedEvent?.matches?.length || 0) > 0) {
      return true;
    }

    if (isAiBalance) {
      const patch = buildOfficialAiBalancePatch(tournament, plan);
      if (!patch.ok) {
        setError(patch.error || "Không lưu được lịch thi đấu.");
        return false;
      }

      const saved = persistTournament({
        events: patch.events,
        officialMode: OFFICIAL_MODE.AI_BALANCE,
        status: TOURNAMENT_STATUS.READY,
      });

      if (!saved) {
        return false;
      }
    } else {
      const patch = buildOfficialOpenPatch(tournament, plan);
      if (!patch.ok) {
        setError(patch.error || "Không lưu được lịch thi đấu.");
        return false;
      }

      const saved = persistTournament({
        events: patch.events,
        officialMode: OFFICIAL_MODE.OPEN,
        hostClubName: tournament.hostClubName || activeClub?.name || "",
        status: TOURNAMENT_STATUS.READY,
      });

      if (!saved) {
        return false;
      }
    }

    pendingPlanRef.current = null;
    setLocalRevision((value) => value + 1);
    refreshClubs();
    setMessage(`Đã ghép ${plan.matchCount} trận vòng bảng. Xem lịch bên dưới.`);
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

  const handleGenerateBracket = () => {
    setError(null);
    const check = canGenerateBracket(savedEvent);
    if (!check.ok) {
      setError(check.errors.join(" "));
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
        if (persistEvent(generated.event)) {
          setWarnings(generated.warnings || []);
          setMessage(`Da tao bracket knock-out (${generated.knockoutMatchCount} tran).`);
        }
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
    const confirmed = window.confirm("Reset bracket knock-out?");
    if (!confirmed) {
      return;
    }

    if (persistEvent(resetBracketState(savedEvent))) {
      setMessage("Da reset bracket.");
    }
  };

  if (!tournament) {
    return (
      <Box>
        <Alert severity="error">Khong tim thay giai.</Alert>
        <Button component={RouterLink} to="/tournament" sx={{ mt: 2 }}>
          Quay lai
        </Button>
      </Box>
    );
  }

  if (tournament.mode !== TOURNAMENT_MODE.OFFICIAL_TOURNAMENT) {
    return (
      <Box>
        <Alert severity="warning">Giai nay khong phai che do chinh thuc.</Alert>
        <Button component={RouterLink} to="/tournament" sx={{ mt: 2 }}>
          Quay lai
        </Button>
      </Box>
    );
  }

  const modeLabel = isAiBalance ? "AI Balance Mode" : "Open Mode";
  const modeDescription = isAiBalance
    ? "Ghép cặp theo rating, hạt giống snake seeding, hỗ trợ nhiều nội dung thi đấu"
    : "Random có điều kiện, không dùng rating/seed";

  return (
    <TournamentManageGate tournamentId={tournamentId}>
    <TournamentSetupShell
      tournament={tournament}
      description={`Giải chính thức — ${modeLabel} (${modeDescription})`}
      onBack={() => navigate("/tournament")}
      headerActions={
        savedEvent?.matches?.length > 0 ? (
          <Button
            variant="outlined"
            onClick={() =>
              navigate(
                `/tournament/director/${tournamentId}?eventId=${encodeURIComponent(savedEvent.id)}`
              )
            }
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
          {playersLoadError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {playersLoadError.message}
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
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
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Chế độ giải</InputLabel>
              <Select
                label="Chế độ giải"
                value={officialMode}
                onChange={(event) => handleOfficialModeChange(event.target.value)}
              >
                {OFFICIAL_MODE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Tabs
                value={savedEvent?.id || false}
                onChange={(_, value) => setActiveEventId(value)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ flexGrow: 1, minHeight: 40 }}
              >
                {savedEvents.map((event) => (
                  <Tab
                    key={event.id}
                    value={event.id}
                    label={`${event.name} (${event.entries?.length || 0})`}
                  />
                ))}
              </Tabs>
              <Button size="small" variant="outlined" onClick={handleAddEvent}>
                Thêm nội dung
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <TournamentVprPanel
        clubId={activeClubId}
        tournament={tournament}
        onUpdated={() => {
          setLocalRevision((value) => value + 1);
          refreshClubs();
        }}
      />

      {aiEnabled && setupTab === 1 ? (
        <TournamentAiAssistantPanel
          tournamentId={tournamentId}
          clubId={activeClubId}
          tenantId={currentTenantId || tournament?.tenantId || resolveTenantIdForClub(activeClubId)}
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
        {isAiBalance ? (
          <Grid size={{ xs: 12 }}>
            <FounderPairingConstraintsPanel
              constraints={founderConstraints}
              players={flowPlayers}
              onChange={setFounderConstraints}
              onSave={handleSaveFounderConstraints}
            />
          </Grid>
        ) : null}
        <Grid size={{ xs: 12 }}>
          <RegistrationOpsPanel
            tournament={tournament}
            event={savedEvent}
            players={flowPlayers}
            actor={
              user
                ? { id: user.id, email: user.email || "", name: user.displayName || user.name || "" }
                : null
            }
            clubId={activeClubId}
            onPersist={(nextTournament) =>
              persistTournament({
                events: nextTournament.events,
                settings: nextTournament.settings,
                status: nextTournament.status,
              })
            }
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 3 }}>
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
        <Grid size={{ xs: 12, md: 3 }}>
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
        <Grid size={{ xs: 12, md: 3 }}>
          {!isAiBalance && (
            <TextField
              fullWidth
              size="small"
              label="CLB đại diện (mặc định)"
              value={entryClubName}
              onChange={(event) => setEntryClubName(event.target.value)}
              placeholder={activeClub?.name || "CLB chủ nhà"}
            />
          )}
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          {!isAiBalance ? (
            <FormControlLabel
              control={
                <Switch
                  checked={splitUnits}
                  onChange={(event) => setSplitUnits(event.target.checked)}
                />
              }
              label="Tách đơn vị/công ty"
            />
          ) : (
            <Chip label="Snake seeding theo hạt giống" color="info" />
          )}
        </Grid>
      </Grid>

      {isAiBalance ? (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 4 }}>
            <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
              <TournamentPlayerPickerPanel
                title="Chọn VĐV đăng ký cá nhân"
                players={allTenantPlayers}
                selectedIds={selectedPlayerIds}
                onToggle={toggleAiPlayer}
                onSelectAll={handleSelectAllAiPlayers}
                onClearAll={handleClearAllAiPlayers}
                clubFilter={sourceClubFilter}
                onClubFilterChange={handleSourceClubFilterChange}
                clubs={clubs}
                genderFilter={pickerGenderFilter}
                onGenderFilterChange={setPickerGenderFilter}
                search={pickerSearch}
                onSearchChange={setPickerSearch}
                eventType={eventType}
                onAddNew={() => setQuickAddOpen(true)}
                showSkillLevel={canViewSkillInSetup}
                emptyMessage={
                  sourceClubFilter === ALL_CLUBS_FILTER
                    ? "Chưa có VĐV trong tenant."
                    : "CLB này chưa có VĐV."
                }
              />
            </Paper>
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
                <>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => setBroadcastDialogOpen(true)}
                  >
                    Cài đặt phát live
                  </Button>
                  {broadcast.isLive ? (
                    <BroadcastLiveIndicator status={broadcast.status} error={broadcast.error} />
                  ) : null}
                </>
              ) : null}
              <Stack direction="row" spacing={1}>
                <Button fullWidth variant="outlined" onClick={handleSuggestAiPairs}>
                  Đề xuất ghép cặp
                </Button>
                <Button fullWidth variant="contained" onClick={handleBuildAiGroups}>
                  Chia bảng seed
                </Button>
              </Stack>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, lg: 3 }}>
            <TournamentSelectedPlayersPanel
              title="VĐV đã chọn"
              players={selectedPlayers}
              onRemove={handleRemoveSelectedAiPlayer}
              showClubName
              emptyMessage="Chưa chọn VĐV nào. Bấm tên VĐV bên trái để thêm."
            />
          </Grid>
          <Grid size={{ xs: 12, lg: 5 }}>
            <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                Cặp / VĐV theo rating ({displayEntries.length})
              </Typography>
              <Stack spacing={1} sx={{ maxHeight: 360, overflow: "auto" }}>
                {displayEntries.map((entry) => (
                  <Paper key={entry.id} variant="outlined" sx={{ p: 1 }}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Typography variant="body2" fontWeight="bold">
                        {entry.name}
                      </Typography>
                      <Chip size="small" label={`Seed ${entry.seed || "-"}`} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Rating đội: {entry.rating}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            </Paper>
            {isAiBalance ? (
              <TournamentEntryEditor
                entries={displayEntries}
                players={flowPlayers}
                eventType={eventType}
                canIntervene={canInterveneSetup && displayEntries.length > 0}
                tournamentId={tournamentId}
                eventId={savedEvent?.id || ""}
                onApply={handleEntryInterventionApply}
                onAudit={pairingIntervention.auditEntryChange}
              />
            ) : null}
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                Bảng đấu ({savedEvent?.groups?.length || 0})
              </Typography>
              {!savedEvent?.groups?.length ? (
                <Typography variant="body2" color="text.secondary">
                  Chọn VĐV, đề xuất ghép cặp rồi bấm &quot;Chia bảng seed&quot;.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {savedEvent.groups.map((group) => (
                    <Paper key={group.id} variant="outlined" sx={{ p: 1.25 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography fontWeight="bold">{group.name}</Typography>
                        <Chip
                          size="small"
                          label={`${group.entryIds?.length || 0} doi • ${group.matches?.length || 0} tran`}
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {(group.entries || []).map((entry) => entry.name).join(" | ")}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Paper>
            <TournamentGroupEditor
              groups={savedEvent?.groups || []}
              entries={savedEvent?.entries || displayEntries}
              players={flowPlayers}
              canIntervene={canInterveneSetup && (savedEvent?.groups?.length || 0) > 0}
              tournamentId={tournamentId}
              eventId={savedEvent?.id || ""}
              onApply={handleGroupInterventionApply}
              onAudit={pairingIntervention.auditGroupChange}
            />
          </Grid>
        </Grid>
      ) : (
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
              Đăng ký VĐV / cặp ({displayEntries.length})
            </Typography>

            <Tabs
              value={openRegistrationTab}
              onChange={(_, value) => setOpenRegistrationTab(value)}
              sx={{ mb: 1.5, borderBottom: 1, borderColor: "divider" }}
            >
              <Tab label="Trong hệ thống" />
              <Tab label="Thêm VĐV mới" />
            </Tabs>

            {openRegistrationTab === 0 ? (
              isSingleEventType(eventType) ? (
                <TournamentPlayerPickerPanel
                  title=""
                  players={allTenantPlayers}
                  mode="register"
                  onRegister={handleRegisterSingle}
                  clubFilter={openClubFilter}
                  onClubFilterChange={setOpenClubFilter}
                  clubs={clubs}
                  genderFilter={pickerGenderFilter}
                  onGenderFilterChange={setPickerGenderFilter}
                  search={pickerSearch}
                  onSearchChange={setPickerSearch}
                  eventType={eventType}
                  excludePlayerIds={registeredPlayerIds}
                  onAddNew={() => setQuickAddOpen(true)}
                  showSkillLevel={canViewSkillInSetup}
                  showSelectActions={false}
                  emptyMessage="Không có VĐV phù hợp hoặc tất cả đã đăng ký."
                />
              ) : (
                <Stack spacing={1.5}>
                  <TournamentPlayerPickerPanel
                    title=""
                    players={allTenantPlayers}
                    clubFilter={openClubFilter}
                    onClubFilterChange={setOpenClubFilter}
                    clubs={clubs}
                    genderFilter={pickerGenderFilter}
                    onGenderFilterChange={setPickerGenderFilter}
                    search={pickerSearch}
                    onSearchChange={setPickerSearch}
                    eventType={eventType}
                    excludePlayerIds={registeredPlayerIds}
                    onAddNew={() => setQuickAddOpen(true)}
                    showSelectActions={false}
                    showPlayerList={false}
                    emptyMessage="Không có VĐV phù hợp."
                  />
                  <FormControl fullWidth size="small">
                    <InputLabel>VDV 1</InputLabel>
                    <Select
                      label="VDV 1"
                      value={pairPlayerAId}
                      onChange={(event) => setPairPlayerAId(event.target.value)}
                    >
                      {openFilteredPlayers.map((player) => (
                        <MenuItem key={player.id} value={String(player.id)}>
                          {player.name} — {formatPlayerPickerMeta(player)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth size="small">
                    <InputLabel>VDV 2</InputLabel>
                    <Select
                      label="VDV 2"
                      value={pairPlayerBId}
                      onChange={(event) => setPairPlayerBId(event.target.value)}
                    >
                      {openFilteredPlayers.map((player) => (
                        <MenuItem key={player.id} value={String(player.id)}>
                          {player.name} — {formatPlayerPickerMeta(player)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button variant="contained" onClick={handleRegisterPair}>
                    Đăng ký cặp
                  </Button>
                </Stack>
              )
            ) : (
              <Stack spacing={1.5}>
                <Typography variant="body2" color="text.secondary">
                  Thêm VĐV chưa có trong hệ thống. VĐV sẽ được lưu vào CLB chủ nhà giải dưới dạng
                  khách (guest) và có thể đăng ký ngay sau khi tạo.
                </Typography>
                <Button variant="contained" onClick={() => setQuickAddOpen(true)}>
                  Thêm VĐV mới
                </Button>
              </Stack>
            )}
          </Paper>

          <Stack spacing={1}>
            <Button
              fullWidth
              variant="contained"
              color="secondary"
              onClick={handleStartGuidedFlow}
              disabled={displayEntries.length < 2}
            >
              Bắt đầu trình chiếu
            </Button>
            {broadcastFeatureEnabled ? (
              <>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => setBroadcastDialogOpen(true)}
                >
                  Cài đặt phát live
                </Button>
                {broadcast.isLive ? (
                  <BroadcastLiveIndicator status={broadcast.status} error={broadcast.error} />
                ) : null}
              </>
            ) : null}
            <Stack direction="row" spacing={1}>
              <Button fullWidth variant="contained" onClick={() => handleDrawGroups(false)}>
                Chia bảng random
              </Button>
              {savedEvent?.groups?.length > 0 && canRegenerateDraw(tournament).ok && (
                <Button fullWidth variant="outlined" onClick={() => handleDrawGroups(true)}>
                  Random lại
                </Button>
              )}
            </Stack>
            {savedEvent?.groups?.length > 0 && (
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
            )}
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
              Danh sách đăng ký
            </Typography>
            {displayEntries.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Chưa có đăng ký. VĐV/cặp tự đăng ký theo nội dung đã chọn.
              </Typography>
            ) : (
              <Stack spacing={1} sx={{ maxHeight: 360, overflow: "auto" }}>
                {displayEntries.map((entry) => (
                  <Paper key={entry.id} variant="outlined" sx={{ p: 1 }}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {entry.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {entry.clubName || entry.representativeClubName || "Chua ro CLB"}
                        </Typography>
                        <TournamentRegistrationRatingPanel
                          players={resolveTournamentEntryPlayers(entry, allTenantPlayers)}
                          tournamentId={tournamentId}
                          hostClubId={activeClubId}
                          compact
                          onVerified={() => {
                            refreshClubs();
                            setLocalRevision((value) => value + 1);
                          }}
                        />
                      </Box>
                      {!savedEvent?.groups?.length && (
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleRemoveEntry(entry.id)}
                        >
                          Xoa
                        </Button>
                      )}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
              Bảng đấu ({savedEvent?.groups?.length || 0})
            </Typography>
            {!savedEvent?.groups?.length ? (
              <Typography variant="body2" color="text.secondary">
                Chưa chia bảng. Đăng ký đủ đội rồi bấm &quot;Chia bảng random&quot;.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {savedEvent.groups.map((group) => (
                  <Paper key={group.id} variant="outlined" sx={{ p: 1.25 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography fontWeight="bold">{group.name}</Typography>
                      <Chip
                        size="small"
                        label={`${group.entryIds?.length || 0} doi • ${group.matches?.length || 0} tran`}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {(group.entries || []).map((entry) => entry.name).join(" | ")}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>

          <TournamentGroupEditor
            groups={savedEvent?.groups || []}
            entries={savedEvent?.entries || displayEntries}
            players={flowPlayers}
            canIntervene={canInterveneSetup && (savedEvent?.groups?.length || 0) > 0}
            tournamentId={tournamentId}
            eventId={savedEvent?.id || ""}
            onApply={handleGroupInterventionApply}
            onAudit={pairingIntervention.auditGroupChange}
          />
        </Grid>
      </Grid>
      )}

      {savedEvent?.groups?.length > 0 && (
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <DrawPublishControls
              tournament={tournament}
              groups={savedEvent.groups}
              drawPublish={drawPublish}
              hasReopenPermission={hasDrawReopenPermission}
              onLock={handleLockDraw}
              onPublish={handlePublishDraw}
              onReopen={handleReopenDraw}
              onForceRedraw={handleForceRedraw}
            />
            <Button
              component={RouterLink}
              to={`/tournament/publish-schedule?tournamentId=${encodeURIComponent(tournamentId)}`}
              variant="outlined"
              sx={{ mt: 1.5 }}
              fullWidth
            >
              Lịch thi đấu & công bố (S1-E)
            </Button>
          </Paper>

          <GroupStagePanel
            event={savedEvent}
            players={flowPlayers}
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
                Chưa có kết quả trận vòng bảng.
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
                    to={`/tournament/official/${tournamentId}/bracket`}
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

      <TournamentPlayerQuickAddDialog
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        hostClubId={activeClubId}
        defaultClubName={entryClubName || activeClub?.name || ""}
        onSaved={handleQuickAddSaved}
      />

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
      </>
      )}
    </TournamentSetupShell>
    </TournamentManageGate>
  );
}
