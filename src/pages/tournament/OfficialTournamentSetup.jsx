import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
import { listCanonicalClubCourtsForFormatVenue } from "../../features/team-tournament/services/canonicalClubCourtInventory.js";
import { resolveTournamentCourtInventoryScope } from "../../features/tournament/guards/tournamentCourtInventoryScope.js";
import {
  useClubPairingCandidatePool,
  useTenantPairingCandidatePool,
} from "../../features/pairing-candidates/index.js";
import TournamentVprPanel from "../../features/vpr-ranking/components/TournamentVprPanel.jsx";
import { useCanonicalTournament } from "../../features/tournament/hooks/useCanonicalTournament.js";
import {
  EVENT_TYPE,
  OFFICIAL_MODE,
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  EVENT_TYPE_OPTIONS,
} from "../../models/tournament/index.js";
import {
  buildOfficialAiBalancePatch,
  buildOfficialOpenPatch,
  buildOfficialOpenPlan,
  createOfficialEventRecord,
  createOpenEntryFromPair,
  resolveBracketProgress,
  suggestBalancedEntriesFromIndividuals,
  suggestOpenRandomEntriesFromPlayers,
  toggleBracketRoundUnlock,
  upsertOfficialEvent,
  assessOfficialEventDeleteAllowed,
  deleteOfficialEventIfEmpty,
  validateOpenRegistrationPlayers,
} from "../../tournament/engines/index.js";
import TournamentAnimationDialog from "../../components/tournament/animation/TournamentAnimationDialog.jsx";
import BracketRevealAnimation from "../../components/tournament/animation/BracketRevealAnimation.jsx";
import {
  ANIMATION_MODES,
  buildGroupMatchPairingSteps,
  buildRandomDrawSteps,
} from "../../components/tournament/animation/animationUtils.js";
import {
  buildRefereeSettingsPatch,
  getRefereeSettings,
} from "../../tournament/engines/refereeEngine.js";
import { useTournamentAnimation } from "../../components/tournament/animation/useTournamentAnimation.js";
import { useTournamentFlowOrchestrator } from "../../components/tournament/animation/useTournamentFlowOrchestrator.js";
import { createOfficialFlowAdapters } from "../../components/tournament/animation/tournamentFlowAdapters.js";
import {
  BroadcastSetupDialog,
  BroadcastVodResultAlert,
  isTournamentBroadcastEnabled,
  useTournamentBroadcast,
} from "../../features/tournament-broadcast/index.js";
import { PAIRING_CONTROL_MODES } from "../../components/tournament/animation/pairing/usePairingSequence.js";
import TournamentManageGate from "../../components/tournament/TournamentManageGate.jsx";
import TournamentSetupShell from "../../components/tournament/TournamentSetupShell.jsx";
import TournamentPlayerPickerPanel from "../../components/tournament/TournamentPlayerPickerPanel.jsx";
import TournamentPlayerQuickAddDialog from "../../components/tournament/TournamentPlayerQuickAddDialog.jsx";
import {
  resolveTournamentEntryPlayers,
  TournamentRegistrationRatingPanel,
} from "../../features/pick-vn-rating/index.js";
import {
  ALL_CLUBS_FILTER,
  applyOfficialPairPlayerPick,
  excludePlayerIdFromOptions,
  filterTournamentPickerPlayers,
  formatPlayerPickerMeta,
} from "../../utils/tournamentPlayerPicker.js";
import { isAiEngineEnabled } from "../../features/ai-assistant/index.js";
import TournamentAiAssistantPanel from "../../components/tournament/ai/TournamentAiAssistantPanel.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { buildAuthorizationPrincipalFingerprint } from "../../auth/authorizationPrincipalFingerprint.js";
import { canViewPlayerSkillLevel } from "../../auth/rbac.js";
import { useTenant } from "../../context/TenantContext.jsx";
import {
  INTERVENTION_PHASE,
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
  projectLivePrivatePairingPrepareInput,
} from "../../features/private-pairing-rules/index.js";
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
import { resolveEventTypeFromQuery, scheduleOfficialGroupMatches } from "../../features/individual-tournament/index.js";
import { isTournamentClosed } from "../../features/individual-tournament/engines/tournamentClosingEngine.js";
import { canGenerateOfficialKnockout } from "../../features/individual-tournament/engines/officialKnockoutEngine.js";
import { buildOfficialAllGroupStandings } from "../../features/individual-tournament/engines/officialStandingsEngine.js";
import {
  officialAdminCommitMatchResultCommand,
  officialCompleteTournamentCommand,
  officialGenerateKnockoutCommand,
} from "../../features/tournament/official-lifecycle/officialOpenLifecycleCommands.js";
import {
  evaluateOfficialOpenManageAccess,
  resolveOfficialOpenTenantIdOrEmpty,
} from "../../features/tournament/official-open-adapter-b/index.js";
import {
  OFFICIAL_STAGE_ID,
  deriveOfficialOrganizerStages,
  deriveOfficialNextAction,
} from "../../features/individual-tournament/engines/officialOrganizerWorkflowEngine.js";
import {
  getOfficialCompetitionSettings,
  patchOfficialCompetitionSettings,
  OFFICIAL_REGISTRATION_MODE,
} from "../../features/individual-tournament/engines/officialTournamentSettingsEngine.js";
import {
  OFFICIAL_PAIRING_AUTHORITY,
  assessOfficialCompetitionStrategyChange,
  resolveOfficialPairingDispatch,
} from "../../features/individual-tournament/engines/officialCompetitionStrategyEngine.js";
import {
  OFFICIAL_STAGE_QUERY_KEY,
  readOfficialStageQuery,
  resolveOfficialOrganizerStageSelection,
} from "../../features/individual-tournament/engines/officialOrganizerStageNavigation.js";
import {
  formOfficialIndividualPairs,
  assertOfficialGroupDrawAllowed,
  projectOfficialDrawSubsteps,
  getOfficialGroupDrawUnits,
  preserveOfficialRegistrationOnGroupDrawEvent,
} from "../../features/individual-tournament/engines/officialDrawOrchestrationEngine.js";
import OfficialTournamentControlCenter, {
  OfficialTournamentStageCard,
} from "../../components/tournament/official/OfficialTournamentControlCenter.jsx";
import OfficialTournamentSettingsScreen from "../../components/tournament/official/OfficialTournamentSettingsScreen.jsx";
import OfficialTournamentRegistrationScreen from "../../components/tournament/official/OfficialTournamentRegistrationScreen.jsx";
import OfficialTournamentFinalizeScreen from "../../components/tournament/official/OfficialTournamentFinalizeScreen.jsx";
import OfficialTournamentDrawScreen from "../../components/tournament/official/OfficialTournamentDrawScreen.jsx";
import OfficialTournamentGroupStageScreen from "../../components/tournament/official/OfficialTournamentGroupStageScreen.jsx";
import OfficialTournamentResultsScreen, {
  OfficialTournamentKnockoutRoundScreen,
} from "../../components/tournament/official/OfficialTournamentResultsScreen.jsx";
import { lockRegistration } from "../../features/individual-tournament/engines/registrationEngine.js";
import {
  mergeVisibleOfficialIndividualSelection,
  registerOfficialIndividualsBatch,
  toggleOfficialIndividualSelection,
} from "../../features/individual-tournament/engines/officialRegistrationBatchEngine.js";

const EVENT_OPTIONS = EVENT_TYPE_OPTIONS;

const OFFICIAL_MODE_OPTIONS = [
  { value: OFFICIAL_MODE.OPEN, label: "Open Mode" },
  { value: OFFICIAL_MODE.AI_BALANCE, label: "AI Balance Mode" },
];

export default function OfficialTournamentSetup() {
  const { tournamentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeClub, activeClubId, clubs, refreshClubs } = useClub();
  const { user, rbacEnabled } = useAuth();
  const { currentTenantId } = useTenant();
  const aiEnabled = isAiEngineEnabled();
  const [setupTab, setSetupTab] = useState(0);
  const [drawBusy, setDrawBusy] = useState(false);
  const [pairBusy, setPairBusy] = useState(false);
  const [groupBusy, setGroupBusy] = useState(false);
  const [registerBusy, setRegisterBusy] = useState(false);
  const [eventDeleteBusy, setEventDeleteBusy] = useState(false);
  const [eventDeleteOpen, setEventDeleteOpen] = useState(false);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [courts, setCourts] = useState([]);
  const [selectedIndividualPlayerIds, setSelectedIndividualPlayerIds] = useState([]);
  const [localRevision, setLocalRevision] = useState(0);
  const [playerDirectoryRevision, setPlayerDirectoryRevision] = useState(0);
  const registerBusyRef = useRef(false);
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
  /** Preloaded prepareLive result for sync guided-flow adapters (flags OFF → empty rules). */
  const guidedPairingRef = useRef({
    ok: true,
    skipped: true,
    pairingOptions: { privatePairingRules: [] },
  });

  const authzFingerprint = useMemo(
    () =>
      buildAuthorizationPrincipalFingerprint(user, {
        rbacEnabled,
        currentTenantId,
      }),
    [user, rbacEnabled, currentTenantId]
  );
  const canonicalClubScope = useMemo(() => {
    if (activeClub && typeof activeClub === "object") {
      return { ...activeClub, authzFingerprint };
    }
    return authzFingerprint ? { authzFingerprint } : null;
  }, [activeClub, authzFingerprint]);

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
    reload,
    setTournament,
  } = useCanonicalTournament(canonicalClubScope, tournamentId, localRevision);

  useEffect(() => {
    if (tournamentLoadError) {
      setError(tournamentLoadError);
    }
  }, [tournamentLoadError]);

  useEffect(() => {
    if (tournament) {
      setFounderConstraints(getTournamentPairingConstraints(tournament));
    }
  }, [tournament?.id, tournament?.founderPairingConstraints]);

  const tenantId = useMemo(
    () =>
      resolveOfficialOpenTenantIdOrEmpty({
        tournament,
        activeClub,
        currentTenantId,
      }),
    [tournament, activeClub, currentTenantId]
  );

  const courtInventoryScope = useMemo(
    () =>
      resolveTournamentCourtInventoryScope({
        tournament,
        activeClub,
        currentTenantId,
      }),
    [
      tournament?.id,
      tournament?.clubId,
      tournament?.tenantId,
      activeClub,
      currentTenantId,
    ]
  );

  const {
    players: allTenantPlayers,
    error: tenantPlayersError,
  } = useTenantPairingCandidatePool(tenantId, {
    revision: playerDirectoryRevision,
  });
  const {
    players,
    error: clubPlayersError,
  } = useClubPairingCandidatePool(activeClubId, {
    tenantId,
    revision: playerDirectoryRevision,
  });
  const playersLoadError = clubPlayersError || tenantPlayersError;

  const isAiBalance = officialMode === OFFICIAL_MODE.AI_BALANCE;

  const flowPlayers = allTenantPlayers;

  useEffect(() => {
    let cancelled = false;
    if (!courtInventoryScope.ok) {
      setCourts([]);
      return undefined;
    }
    void listCanonicalClubCourtsForFormatVenue({
      clubId: courtInventoryScope.clubId,
      tenantId: courtInventoryScope.tenantId,
      venueId: courtInventoryScope.venueId,
    }).then((result) => {
      if (cancelled) return;
      setCourts(result?.ok && Array.isArray(result.courts) ? result.courts : []);
    }).catch(() => {
      if (cancelled) return;
      setCourts([]);
    });
    return () => {
      cancelled = true;
    };
  }, [
    courtInventoryScope.ok,
    courtInventoryScope.clubId,
    courtInventoryScope.tenantId,
    courtInventoryScope.venueId,
  ]);

  const refereeRoster = useMemo(
    () => getRefereeSettings(tournament).roster,
    [tournament, localRevision]
  );

  const savedEvents = tournament?.events || [];
  const savedEvent =
    savedEvents.find((event) => String(event.id) === String(activeEventId)) ||
    savedEvents[0] ||
    null;

  const displayEntries = useMemo(() => {
    if (isAiBalance) {
      return previewEntries.length > 0 ? previewEntries : savedEvent?.entries || [];
    }
    return registeredEntries.length > 0 ? registeredEntries : savedEvent?.entries || [];
  }, [
    isAiBalance,
    previewEntries,
    registeredEntries,
    savedEvent?.entries,
  ]);

  const competition = useMemo(
    () => getOfficialCompetitionSettings(tournament),
    [tournament]
  );
  const registrationModeResolved = Boolean(
    competition.registrationMode && !competition.registrationModeUnresolved
  );
  const isIndividualRegistration =
    competition.registrationMode === OFFICIAL_REGISTRATION_MODE.INDIVIDUAL;
  const isPairRegistration =
    competition.registrationMode === OFFICIAL_REGISTRATION_MODE.PAIR;

  const workflow = useMemo(
    () =>
      deriveOfficialOrganizerStages(tournament, {
        eventId: savedEvent?.id || activeEventId,
        courts,
      }),
    [tournament, savedEvent?.id, activeEventId, courts]
  );

  const nextAction = useMemo(
    () =>
      deriveOfficialNextAction(tournament, {
        eventId: savedEvent?.id || activeEventId,
        courts,
      }),
    [tournament, savedEvent?.id, activeEventId, courts]
  );

  const requestedStageId = readOfficialStageQuery(searchParams);
  const stageSelection = useMemo(
    () =>
      resolveOfficialOrganizerStageSelection({
        requestedStageId,
        stages: workflow.stages,
        lifecycleCurrentStageId: workflow.currentStageId,
      }),
    [requestedStageId, workflow.stages, workflow.currentStageId]
  );
  const activeStageId = stageSelection.stageId || OFFICIAL_STAGE_ID.SETTINGS;
  const activeStage =
    workflow.stages.find((stage) => stage.id === activeStageId) || workflow.stages[0];

  useEffect(() => {
    if (!tournament?.id) return;
    if (!stageSelection.stageId) return;
    if (requestedStageId === stageSelection.stageId) return;
    if (requestedStageId && !stageSelection.normalized) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (next.get(OFFICIAL_STAGE_QUERY_KEY) === stageSelection.stageId) {
          return prev;
        }
        next.set(OFFICIAL_STAGE_QUERY_KEY, stageSelection.stageId);
        return next;
      },
      { replace: true }
    );
  }, [
    tournament?.id,
    requestedStageId,
    stageSelection.stageId,
    stageSelection.normalized,
    setSearchParams,
  ]);

  const selectStage = (stageId) => {
    const nextId = String(stageId || "").trim();
    if (!nextId) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (next.get(OFFICIAL_STAGE_QUERY_KEY) === nextId) {
          return prev;
        }
        next.set(OFFICIAL_STAGE_QUERY_KEY, nextId);
        return next;
      },
      { replace: false }
    );
  };

  const handlePrimaryNextAction = (action) => {
    const actionId = action?.actionId || "";
    const map = {
      edit_settings: OFFICIAL_STAGE_ID.SETTINGS,
      edit_info: OFFICIAL_STAGE_ID.SETTINGS,
      open_registration: OFFICIAL_STAGE_ID.REGISTRATION,
      approve_entries: OFFICIAL_STAGE_ID.REGISTRATION,
      view_registration: OFFICIAL_STAGE_ID.REGISTRATION,
      lock_registration: OFFICIAL_STAGE_ID.LOCK_ENTRIES,
      view_lock: OFFICIAL_STAGE_ID.LOCK_ENTRIES,
      run_draw: OFFICIAL_STAGE_ID.DRAW,
      view_draw: OFFICIAL_STAGE_ID.DRAW,
      operate_group_stage: OFFICIAL_STAGE_ID.GROUP_STAGE,
      open_schedule: OFFICIAL_STAGE_ID.GROUP_STAGE,
      assign_referees: OFFICIAL_STAGE_ID.GROUP_STAGE,
      enter_scores: OFFICIAL_STAGE_ID.GROUP_STAGE,
      view_scoring: OFFICIAL_STAGE_ID.GROUP_STAGE,
      view_standings: OFFICIAL_STAGE_ID.RESULTS,
      generate_knockout: OFFICIAL_STAGE_ID.RESULTS,
      view_knockout: OFFICIAL_STAGE_ID.RESULTS,
      close_tournament: OFFICIAL_STAGE_ID.RESULTS,
      view_close: OFFICIAL_STAGE_ID.RESULTS,
      view_results: OFFICIAL_STAGE_ID.RESULTS,
    };
    if (String(action?.stageId || "").startsWith("knockout:")) {
      selectStage(action.stageId);
      return;
    }
    const stageId = map[actionId] || action?.stageId || OFFICIAL_STAGE_ID.SETTINGS;
    selectStage(stageId);
    if (actionId === "lock_registration") {
      handleLockRegistrationFromStage();
    }
  };

  const handleLockRegistrationFromStage = async () => {
    const result = lockRegistration(tournament, {
      actor: user
        ? { id: user.id, email: user.email || "", name: user.displayName || user.name || "" }
        : null,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const saved = await persistTournament({
      settings: result.tournament.settings,
      status: result.tournament.status,
      events: result.tournament.events,
    });
    if (saved) {
      setMessage("Đã chốt đăng ký.");
      selectStage(OFFICIAL_STAGE_ID.DRAW);
    }
  };

  const registeredPlayerIds = useMemo(() => {
    const ids = new Set();
    displayEntries.forEach((entry) => {
      (entry.playerIds || []).forEach((id) => ids.add(String(id)));
    });
    return Array.from(ids);
  }, [displayEntries]);

  const openFilteredPlayers = useMemo(
    () =>
      filterTournamentPickerPlayers(flowPlayers, {
        clubFilter: openClubFilter,
        genderFilter: pickerGenderFilter,
        search: pickerSearch,
        eventType,
        excludePlayerIds: registeredPlayerIds,
      }),
    [flowPlayers, openClubFilter, pickerGenderFilter, pickerSearch, eventType, registeredPlayerIds]
  );

  const openPairSelectAOptions = useMemo(
    () => excludePlayerIdFromOptions(openFilteredPlayers, pairPlayerBId),
    [openFilteredPlayers, pairPlayerBId]
  );

  const openPairSelectBOptions = useMemo(
    () => excludePlayerIdFromOptions(openFilteredPlayers, pairPlayerAId),
    [openFilteredPlayers, pairPlayerAId]
  );

  const pairSelectedIds = useMemo(
    () => [pairPlayerAId, pairPlayerBId].filter(Boolean).map(String),
    [pairPlayerAId, pairPlayerBId]
  );

  const groupStandings = useMemo(
    () =>
      savedEvent
        ? buildOfficialAllGroupStandings(savedEvent, {
            qualifiersPerGroup: getOfficialCompetitionSettings(tournament).qualifiersPerGroup,
          })
        : [],
    [savedEvent, tournament]
  );

  const officialClosed = isTournamentClosed(tournament);
  const canManageOfficial =
    evaluateOfficialOpenManageAccess({
      actor: user,
      tenantId: currentTenantId || tenantId,
      clubId: activeClubId,
      venueId: activeClub?.venueId || null,
      competitionId: tournamentId,
      rbacEnabled,
    }).allowed !== false && !officialClosed;

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
    const configured = getOfficialCompetitionSettings(tournament).groupCount;
    if (configured >= 1) {
      setGroupCount(configured);
    }
  }, [tournament?.id, tournament?.settings?.officialCompetition?.groupCount]);

  useEffect(() => {
    if (!tournament?.id || officialClosed) {
      return undefined;
    }
    const timer = setInterval(() => {
      reload({ soft: true });
    }, 4000);
    return () => clearInterval(timer);
  }, [tournament?.id, officialClosed, reload]);

  useEffect(() => {
    if (!activeEventId && savedEvents[0]?.id) {
      setActiveEventId(savedEvents[0].id);
    }
  }, [activeEventId, savedEvents]);

  const persistTournament = async (patch, options = {}) => {
    if (isTournamentClosed(tournament) && !options.allowClosed) {
      setError("Giải đã đóng — không thể sửa.");
      return false;
    }
    const { status, ...dataPatch } = patch;
    const {
      skipLocalRevision,
      refreshPlayerDirectory,
      ...updateOptions
    } = options;
    const result = await update(
      status ? { ...dataPatch, status } : patch,
      {
        ...updateOptions,
        expectedVersion: updateOptions.expectedVersion ?? tournament?.version,
      }
    );

    if (!result.ok) {
      setError(result.error);
      return false;
    }

    if (options.processMatchId && result.lifecycleOk === false) {
      setError(
        result.lifecycleError ||
          "Đã lưu kết quả nhưng cập nhật Elo/điểm mùa thất bại."
      );
    }

    if (!skipLocalRevision) {
      setLocalRevision((value) => value + 1);
    }
    if (refreshPlayerDirectory) {
      setPlayerDirectoryRevision((value) => value + 1);
    }
    refreshClubs();
    return {
      ok: true,
      tournament: result.tournament,
      lifecycleOk: result.lifecycleOk !== false,
      lifecycleError: result.lifecycleError || null,
      lifecycle: result.lifecycle || null,
    };
  };

  const persistEvent = async (nextEvent, options = {}) => {
    if (!savedEvent) {
      return false;
    }

    const { processMatchId, expectedVersion, ...extraPatch } = options;
    const events = upsertOfficialEvent(savedEvents, { ...savedEvent, ...nextEvent });
    return persistTournament(
      {
        events,
        ...extraPatch,
      },
      {
        processMatchId: processMatchId || null,
        processEventId: savedEvent?.id || null,
        expectedVersion: expectedVersion ?? tournament?.version,
      }
    );
  };

  /**
   * Persist accepted registration / AI pair entries to canonical cloud.
   * Temporary picker/filter state is not written — only confirmed entry lists.
   */
  const persistAcceptedEntries = async (entries) => {
    let event = savedEvent;
    let events = savedEvents;

    if (!event) {
      event = createOfficialEventRecord(tournament, { eventType });
      events = [...savedEvents, event];
      setActiveEventId(event.id);
    }

    const nextEvents = upsertOfficialEvent(events, {
      ...event,
      entries,
    });

    return persistTournament({ events: nextEvents });
  };

  const persistDrawMaterialization = async (drawEntries) => {
    if (!savedEvent) {
      return false;
    }
    const nextEvents = upsertOfficialEvent(savedEvents, {
      ...savedEvent,
      entries: savedEvent.entries || [],
      drawEntries,
    });
    return persistTournament({ events: nextEvents });
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

  const handleLockDraw = async () => {
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
    if (await persistTournament({ settings: result.tournament.settings })) {
      setMessage("Đã khóa bốc thăm. Sẵn sàng công bố.");
    }
  };

  const handlePublishDraw = async () => {
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
      await persistTournament({
        settings: result.tournament.settings,
        events,
      })
    ) {
      setMessage("Đã công bố bốc thăm. Bracket bất biến.");
    }
  };

  const handleReopenDraw = async () => {
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
    if (await persistTournament({ settings: result.tournament.settings })) {
      setMessage("Đã mở lại bốc thăm để chỉnh sửa.");
    }
  };

  const handleForceRedraw = async () => {
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
    if (await persistTournament({ settings: result.tournament.settings })) {
      setMessage("Force redraw được phép. Bạn có thể random lại.");
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
    const result = await update({
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
        suggestEntries: (selected, et) => {
          const prepared = guidedPairingRef.current;
          if (prepared?.ok === false) {
            return [];
          }
          return suggestBalancedEntriesFromIndividuals(selected, et, {
            tournamentId,
            eventId: savedEvent?.id || `event-${tournamentId}`,
            ...(prepared?.pairingOptions || {}),
            pairingConstraints: founderConstraints,
            competitionClass: COMPETITION_CLASS.OFFICIAL,
          });
        },
        buildPlan: ({ manualEntries }) => {
          const prepared = guidedPairingRef.current;
          if (prepared?.ok === false) {
            return {
              ok: false,
              errors: [
                prepared.error?.message || "Không lập được kế hoạch theo quy tắc riêng.",
              ],
              privatePairingError: prepared.error || null,
            };
          }
          return buildOfficialOpenPlan({
            tournament: {
              ...tournament,
              hostClubName: tournament.hostClubName || activeClub?.name || "",
            },
            entries: manualEntries || displayEntries,
            eventType,
            eventId: savedEvent?.id,
            groupCount,
            players: flowPlayers,
            splitUnits,
            privatePairingRules: prepared?.pairingOptions?.privatePairingRules || [],
            pairingConstraints: founderConstraints,
            competitionClass: COMPETITION_CLASS.OFFICIAL,
            clubId: activeClubId,
            tournamentId,
            allowedByPublishedRules: false,
            ...(prepared?.pairingOptions || {}),
          });
        },
        buildPatch: buildOfficialAiBalancePatch,
      });
    }

    return createOfficialFlowAdapters({
      ...shared,
      variant: "open",
      isAiBalance: false,
      suggestEntries: () => displayEntries,
      buildPlan: () => {
        const prepared = guidedPairingRef.current;
        if (prepared?.ok === false) {
          return {
            ok: false,
            errors: [
              prepared.error?.message || "Không lập được kế hoạch theo quy tắc riêng.",
            ],
            privatePairingError: prepared.error || null,
          };
        }
        return buildOfficialOpenPlan({
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
          privatePairingRules: prepared?.pairingOptions?.privatePairingRules || [],
          pairingConstraints: founderConstraints,
          competitionClass: COMPETITION_CLASS.OFFICIAL,
          clubId: activeClubId,
          tournamentId,
          allowedByPublishedRules: false,
          ...(prepared?.pairingOptions || {}),
        });
      },
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
    activeClubId,
    founderConstraints,
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

  const prepareOfficialPrivatePairing = async (extra = {}) => {
    const projected = projectLivePrivatePairingPrepareInput({
      tournament: tournament || null,
      activeClub: activeClub || null,
      tournamentId,
      clubId: tournament?.clubId || activeClubId,
      hostClubId: activeClubId,
      competitionClass: COMPETITION_CLASS.OFFICIAL,
      eventId: savedEvent?.id || `event-${tournamentId}`,
      pairingConstraints: founderConstraints,
      allowedByPublishedRules: false,
      ...extra,
    });

    if (!projected.ok) {
      return {
        ok: false,
        error: projected.error,
      };
    }

    return prepareLivePrivatePairingOptions(projected.prepareInput);
  };

  const handleRefereeRosterChange = async (nextRoster) => {
    const result = await update(
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
    const gate = assessOfficialCompetitionStrategyChange(tournament, nextMode);
    if (!gate.allowed) {
      setError(gate.error);
      return;
    }
    setOfficialMode(nextMode);
    setPreviewEntries([]);
    setRegisteredEntries([]);
    setSelectedPlayerIds([]);
    const patch = { officialMode: nextMode };
    if (gate.normalizeRegistrationMode) {
      const next = patchOfficialCompetitionSettings(tournament, {
        registrationMode: gate.normalizeRegistrationMode,
      });
      patch.settings = next.settings;
    }
    void persistTournament(patch);
  };

  const handleAddEvent = async () => {
    const newEvent = createOfficialEventRecord(tournament, { eventType });
    const events = [...savedEvents, newEvent];
    if (await persistTournament({ events })) {
      setActiveEventId(newEvent.id);
      setMessage(`Da them noi dung "${newEvent.name}".`);
    }
  };

  const handleAskDeleteEvent = () => {
    setError(null);
    const gate = assessOfficialEventDeleteAllowed(tournament, savedEvent?.id || "");
    if (!gate.allowed) {
      setError(gate.error);
      return;
    }
    setEventDeleteOpen(true);
  };

  const handleConfirmDeleteEvent = async () => {
    if (eventDeleteBusy) return;
    setEventDeleteBusy(true);
    setError(null);
    try {
      const result = deleteOfficialEventIfEmpty(tournament, savedEvent?.id || "");
      if (!result.ok) {
        setError(result.error);
        setEventDeleteOpen(false);
        return;
      }
      const saved = await persistTournament({ events: result.events });
      if (!saved) {
        return;
      }
      setActiveEventId(result.nextEventId || "");
      setEventDeleteOpen(false);
      setMessage(`Đã xóa nội dung "${savedEvent?.name || ""}".`);
    } finally {
      setEventDeleteBusy(false);
    }
  };

  const handleQuickAddSaved = async (player) => {
    refreshClubs();
    setPlayerDirectoryRevision((value) => value + 1);

    if (isIndividualRegistration) {
      await registerPlayerEntry(player);
      return;
    }

    setMessage(`Đã thêm ${player.name}. Chọn VĐV rồi bấm Đăng ký.`);
  };

  const persistOfficialIndividualBatch = async (nextTournament) => {
    const saved = await persistTournament(
      {
        events: nextTournament.events,
        settings: nextTournament.settings,
      },
      { skipLocalRevision: true }
    );
    if (!saved) {
      return false;
    }
    await reload({ soft: true });
    return true;
  };

  const registerPlayerEntry = async (player) => {
    if (!player) return false;
    return registerOfficialIndividuals([String(player.id)], [player]);
  };

  const registerOfficialIndividuals = async (playerIds, playerPool = flowPlayers) => {
    if (registerBusy || registerBusyRef.current) {
      return false;
    }
    setError(null);
    const result = registerOfficialIndividualsBatch(
      tournament,
      {
        playerIds,
        players: playerPool,
        eventId: savedEvent?.id,
        eventType,
        clubName: entryClubName || activeClub?.name || "",
      },
      { actor: user || null, clubId: activeClubId }
    );
    if (!result.ok) {
      setError(result.error);
      return false;
    }

    registerBusyRef.current = true;
    setRegisterBusy(true);
    const saved = await persistOfficialIndividualBatch(result.tournament);
    registerBusyRef.current = false;
    setRegisterBusy(false);
    if (!saved) {
      return false;
    }

    const registeredIds = new Set((result.entries || []).flatMap((entry) => entry.playerIds || []));
    setSelectedIndividualPlayerIds((current) =>
      current.filter((id) => !registeredIds.has(String(id)))
    );
    setRegisteredEntries(result.event?.entries || []);
    const n = result.registeredCount || registeredIds.size;
    setMessage(n === 1 ? "Đã đăng ký 1 VĐV." : `Đã đăng ký ${n} VĐV.`);
    return true;
  };

  const handleRegisterSelectedIndividuals = () => {
    if (registerBusy || registerBusyRef.current) {
      return;
    }
    return registerOfficialIndividuals(selectedIndividualPlayerIds);
  };

  const handleSelectIndividualCandidate = (playerId) => {
    setSelectedIndividualPlayerIds((current) =>
      toggleOfficialIndividualSelection(current, playerId, {
        excludePlayerIds: registeredPlayerIds,
      })
    );
  };

  const handleClearIndividualSelection = () => {
    setSelectedIndividualPlayerIds([]);
  };

  const handleSelectVisibleIndividuals = (visibleIds) => {
    setSelectedIndividualPlayerIds((current) =>
      mergeVisibleOfficialIndividualSelection(current, visibleIds)
    );
  };

  const handlePairPlayerPick = (playerId) => {
    const next = applyOfficialPairPlayerPick({
      pairPlayerAId,
      pairPlayerBId,
      playerId,
    });
    setPairPlayerAId(next.pairPlayerAId);
    setPairPlayerBId(next.pairPlayerBId);
  };

  const handlePairPlayerASelect = (value) => {
    const nextA = String(value || "");
    setPairPlayerAId(nextA);
    if (nextA && nextA === String(pairPlayerBId || "")) {
      setPairPlayerBId("");
    }
  };

  const handlePairPlayerBSelect = (value) => {
    const nextB = String(value || "");
    if (nextB && nextB === String(pairPlayerAId || "")) {
      setError("Cặp phải gồm 2 VĐV khác nhau.");
      return;
    }
    setPairPlayerBId(nextB);
  };

  const handleRegisterPair = async () => {
    if (registerBusy) return;
    setError(null);
    const playerA = flowPlayers.find((item) => String(item.id) === String(pairPlayerAId));
    const playerB = flowPlayers.find((item) => String(item.id) === String(pairPlayerBId));

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

    const nextEntries = [...displayEntries, entry];
    setRegisterBusy(true);
    setRegisteredEntries(nextEntries);
    setPairPlayerAId("");
    setPairPlayerBId("");
    const saved = await persistAcceptedEntries(nextEntries);
    setRegisterBusy(false);
    if (!saved) {
      setRegisteredEntries(displayEntries);
      return;
    }
    setMessage(`Da dang ky cap ${entry.name}.`);
  };

  const handleRemoveEntry = async (entryId) => {
    const nextEntries = displayEntries.filter((entry) => entry.id !== entryId);
    setRegisteredEntries(nextEntries);
    const saved = await persistAcceptedEntries(nextEntries);
    if (!saved) {
      setRegisteredEntries(displayEntries);
    }
  };

  const handleFormOfficialPairs = async () => {
    setError(null);
    setWarnings([]);
    setMessage(null);
    setPairBusy(true);
    try {
      const prepared = await prepareOfficialPrivatePairing();
      if (!prepared.ok) {
        const msg = prepared.error?.message || "Không ghép được cặp.";
        setError(msg);
        return { ok: false, error: msg };
      }
      const pairingOptions = {
        ...prepared.pairingOptions,
        tournamentId,
        eventId: savedEvent?.id || `event-${tournamentId}`,
        pairingConstraints: founderConstraints,
        competitionClass: COMPETITION_CLASS.OFFICIAL,
      };
      const pairingDispatch = resolveOfficialPairingDispatch({
        officialMode,
        registrationMode: competition.registrationMode,
      });
      if (
        !pairingDispatch.ok ||
        pairingDispatch.pairingAuthority === OFFICIAL_PAIRING_AUTHORITY.INVALID
      ) {
        const msg =
          pairingDispatch.error || "Không ghép được cặp với chế độ giải hiện tại.";
        setError(msg);
        return { ok: false, error: msg };
      }
      if (pairingDispatch.pairingAuthority === OFFICIAL_PAIRING_AUTHORITY.NONE) {
        const msg =
          "Chế độ đăng ký theo cặp không ghép cặp — dùng cặp đã đăng ký để chia bảng.";
        setError(msg);
        return { ok: false, error: msg };
      }
      const pairingFn =
        pairingDispatch.pairingAuthority === OFFICIAL_PAIRING_AUTHORITY.AI_BALANCE
          ? suggestBalancedEntriesFromIndividuals
          : suggestOpenRandomEntriesFromPlayers;
      const result = formOfficialIndividualPairs({
        tournament,
        eventId: savedEvent?.id || "",
        players: flowPlayers,
        eventType,
        pairingFn,
        pairingOptions,
      });
      applyConstraintWarnings(pairingOptions);
      if (!result.ok) {
        setError(result.error);
        return { ok: false, error: result.error };
      }
      const saved = await persistDrawMaterialization(result.drawEntries || result.pairs);
      if (!saved) {
        return { ok: false, error: "Không lưu được cặp." };
      }
      const readback = projectOfficialDrawSubsteps(
        saved.tournament || tournament,
        result.event?.id || savedEvent?.id || ""
      );
      if (!readback.pairingComplete || readback.groupsCreated) {
        return {
          ok: false,
          error: "Lưu cặp xong nhưng đọc lại chưa thấy danh sách cặp dùng được.",
        };
      }
      setMessage(`Đã ghép ${result.pairs.length} cặp. Kiểm tra danh sách trước khi chia bảng.`);
      return { ok: true, pairs: result.pairs };
    } finally {
      setPairBusy(false);
    }
  };

  const handleRunGroupDraw = async () => {
    setGroupBusy(true);
    setDrawBusy(true);
    try {
      const ok = await handleDrawGroups(false);
      if (!ok) {
        return { ok: false, error: "Chia bảng thất bại — chưa công bố bảng." };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || "Chia bảng thất bại." };
    } finally {
      setGroupBusy(false);
      setDrawBusy(false);
    }
  };

  const handleDrawGroups = async (isRedraw = false) => {
    setError(null);
    setWarnings([]);
    setMessage(null);

    if (isRedraw) {
      const regenCheck = canRegenerateDraw(tournament);
      if (!regenCheck.ok) {
        setError(regenCheck.error);
        return false;
      }
    }

    const groupGate = assertOfficialGroupDrawAllowed(tournament, savedEvent?.id || "");
    if (!groupGate.ok) {
      setError(groupGate.error);
      return false;
    }

    const drawUnits = getOfficialGroupDrawUnits(tournament, savedEvent?.id || "");
    if (!drawUnits.ok || (drawUnits.units || []).length < 2) {
      setError(drawUnits.error || "Chưa có cặp để chia bảng.");
      return false;
    }
    const eligibleEntries = drawUnits.units;

    const prepared = await prepareOfficialPrivatePairing();

    if (!prepared.ok) {
      setError(prepared.error?.message || "Không chia được bảng theo quy tắc riêng.");
      setWarnings(
        (prepared.error?.fatalConflicts || prepared.error?.blockedByPolicy || []).map(
          (item) => item.code || item.message || String(item)
        )
      );
      return false;
    }

    const plan = buildOfficialOpenPlan({
      tournament: {
        ...tournament,
        hostClubName: tournament.hostClubName || activeClub?.name || "",
      },
      entries: eligibleEntries,
      eventType,
      eventId: savedEvent?.id,
      groupCount,
      players: flowPlayers,
      splitUnits,
      privatePairingRules: prepared.pairingOptions?.privatePairingRules || [],
      competitionClass: COMPETITION_CLASS.OFFICIAL,
      pairingConstraints: founderConstraints,
      clubId: activeClubId,
      tournamentId,
      allowedByPublishedRules: false,
    });

    if (!plan.ok) {
      setError(
        plan.privatePairingError?.message || plan.errors?.join(" ") || "Không chia được bảng."
      );
      setWarnings(plan.warnings || []);
      return false;
    }

    const patch = buildOfficialOpenPatch(tournament, plan);
    if (!patch.ok) {
      setError(patch.error || "Khong luu duoc bang dau.");
      return false;
    }
    const preservedOpenEvent = preserveOfficialRegistrationOnGroupDrawEvent(
      savedEvent,
      patch.event
    );
    const preservedOpenEvents = upsertOfficialEvent(patch.events, preservedOpenEvent);

    const steps = buildRandomDrawSteps(plan.event.groups);

    // Option A: durable authority before animation (presentation only).
    const saved = await persistTournament({
      events: preservedOpenEvents,
      officialMode: tournament.officialMode || officialMode,
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
      return false;
    }

    const created = recordDrawCreated(saved.tournament || tournament, patch.event?.groups || [], {
      userId: user?.id,
      actor: buildDrawActor(),
      clubId: activeClubId,
      before: isRedraw ? summarizeGroups(savedEvent?.groups || []) : null,
    });
    if (created.ok) {
      await persistTournament({ settings: created.tournament.settings });
    }

    pendingPlanRef.current = plan;
    setWarnings(patch.warnings || []);
    if (patch.event?.id) {
      setActiveEventId(patch.event.id);
    }
    setMessage(
      isRedraw
        ? `Đã random lại ${patch.event.groups.length} bảng và lưu ${plan.matchCount} trận. Đang trình chiếu…`
        : `Đã chia ${patch.event.groups.length} bảng và lưu ${plan.matchCount} trận. Đang trình chiếu…`
    );

    anim.showAnimation(
      {
        animationMode: ANIMATION_MODES.RANDOM_DRAW,
        steps,
        groups: plan.event.groups,
        matchCount: plan.matchCount,
        onStartMatchPairing: () => openMatchPairingAnimation(plan),
      },
      () => {
        pendingPlanRef.current = null;
        setMessage(
          isRedraw
            ? `Đã random lại ${patch.event.groups.length} bảng (${plan.matchCount} trận). Có thể bỏ qua trình chiếu — dữ liệu đã lưu.`
            : `Đã chia ${patch.event.groups.length} bảng (${plan.matchCount} trận). Có thể bỏ qua trình chiếu — dữ liệu đã lưu.`
        );
      }
    );
    return true;
  };

  const persistMatchPairing = async (plan) => {
    if ((savedEvent?.matches?.length || 0) > 0) {
      return true;
    }

    const patch = buildOfficialOpenPatch(tournament, plan);
    if (!patch.ok) {
      setError(patch.error || "Không lưu được lịch thi đấu.");
      return false;
    }

    const saved = await persistTournament({
      events: patch.events,
      officialMode: tournament.officialMode || officialMode,
      hostClubName: tournament.hostClubName || activeClub?.name || "",
      status: TOURNAMENT_STATUS.READY,
    });

    if (!saved) {
      return false;
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
      async () => {
        await persistMatchPairing(plan);
      }
    );
  };

  const handleGenerateGroupSchedule = async () => {
    if (!tournament || !savedEvent) {
      return { ok: false, error: "Không tìm thấy giải.", mutationCount: 0 };
    }
    const persisted = tournament.courtSchedule;
    if (
      !persisted?.date ||
      !persisted?.startTime ||
      !persisted?.endTime ||
      !Array.isArray(persisted.courtIds) ||
      persisted.courtIds.length === 0
    ) {
      return {
        ok: false,
        error: "Hãy lưu sân & thời gian trước khi xếp lịch vòng bảng.",
        mutationCount: 0,
      };
    }
    setScheduleBusy(true);
    setError(null);
    try {
      const result = scheduleOfficialGroupMatches(tournament, {
        eventId: savedEvent.id,
        clubId: activeClubId,
        courts,
        courtIds: persisted.courtIds,
        date: persisted.date,
        startTime: persisted.startTime,
        endTime: persisted.endTime,
        players: flowPlayers,
      });
      if (!result.ok) {
        return result;
      }
      const saved = await persistTournament(
        { events: result.events },
        { expectedVersion: tournament.version }
      );
      if (!saved || saved.ok === false) {
        return {
          ok: false,
          error: saved?.error || "Không lưu được lịch vòng bảng.",
          code: saved?.code,
          mutationCount: 0,
        };
      }
      return {
        ok: true,
        mutationCount: 1,
        readbackCount: 1,
        tournament: saved.tournament,
        cloudWriteCount: 1,
      };
    } finally {
      setScheduleBusy(false);
    }
  };

  const handleGenerateBracket = async () => {
    setError(null);
    const preview = canGenerateOfficialKnockout(tournament, savedEvent);
    if (!preview.ok) {
      setError(preview.errors?.join(" ") || "Không tạo được bracket.");
      return;
    }

    const result = await officialGenerateKnockoutCommand({
      tenantId: tenantId || tournament?.tenantId,
      clubId: courtInventoryScope.ok ? courtInventoryScope.clubId : activeClubId,
      tournamentId,
      eventId: savedEvent?.id || "",
      expectedVersion: tournament.version,
    });
    if (!result.ok) {
      setError(result.error || "Không tạo được bracket.");
      return;
    }

    const nextTournament = await reload({ soft: true });
    const event =
      (nextTournament?.events || []).find((item) => String(item.id) === String(savedEvent?.id)) ||
      nextTournament?.events?.[0] ||
      null;
    setWarnings(preview.warnings || []);
    setMessage(
      `Đã tạo bracket knock-out (${result.knockoutMatchCount ?? preview.preview?.knockoutMatchCount ?? 0} trận).`
    );
    if (event) {
      anim.showAnimation({
        animationMode: ANIMATION_MODES.BRACKET_REVEAL,
        bracket: resolveBracketProgress(event),
      });
    }
  };

  const commitOfficialMatchScore = async (matchId, scores) => {
    const result = await officialAdminCommitMatchResultCommand({
      tenantId: tenantId || tournament?.tenantId,
      clubId: courtInventoryScope.ok ? courtInventoryScope.clubId : activeClubId,
      tournamentId,
      matchId,
      scoreA: Number(scores.scoreA),
      scoreB: Number(scores.scoreB),
      expectedVersion: tournament.version,
    });
    if (!result.ok) {
      setError(result.error || "Không chốt được kết quả.");
      return false;
    }
    if (result.tournament) {
      setTournament(result.tournament);
    } else {
      await reload({ soft: true });
    }
    setMessage(
      result.winnerName
        ? `Đã chốt ${result.scoreA} — ${result.scoreB}. Thắng: ${result.winnerName}.`
        : "Đã chốt kết quả canonical."
    );
    return true;
  };

  const handleSubmitGroupScore = async (matchId, scores) => {
    return commitOfficialMatchScore(matchId, scores);
  };

  const handleSubmitKnockoutScore = async (matchId, scores) => {
    return commitOfficialMatchScore(matchId, scores);
  };

  const handleToggleRoundLock = async (roundName, unlock) => {
    const result = toggleBracketRoundUnlock(savedEvent, roundName, unlock);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (await persistEvent(result.event)) {
      setMessage(unlock ? `Da mo khoa vong ${roundName}.` : `Da khoa vong ${roundName}.`);
    }
  };

  if (tournamentLoading && !tournament) {
    return (
      <Box>
        <Alert severity="info">Đang tải giải Official...</Alert>
      </Box>
    );
  }

  if (!tournament) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          Không tìm thấy giải Official này trên CLB hiện tại. Preview thường lưu giải theo
          trình duyệt — ID cũ (`{tournamentId}`) có thể đã mất sau khi redeploy hoặc đổi CLB.
        </Alert>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button component={RouterLink} to="/tournament" variant="contained">
            Về trang Giải đấu
          </Button>
          <Button component={RouterLink} to="/tournament/create" variant="outlined">
            Tạo giải mới
          </Button>
        </Stack>
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
    ? "Ghép cặp AI theo rating; chia bảng ngẫu nhiên (không tối ưu rating)"
    : "Ghép cặp ngẫu nhiên; chia bảng ngẫu nhiên — không dùng rating/seed";

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
      <OfficialTournamentControlCenter
        tournament={tournament}
        stages={workflow.stages}
        facts={workflow.facts}
        nextAction={nextAction}
        activeStageId={activeStageId}
        onSelectStage={selectStage}
        onPrimaryAction={handlePrimaryNextAction}
        canManage={canManageOfficial}
      />

      <OfficialTournamentStageCard stage={activeStage}>
        {activeStageId === OFFICIAL_STAGE_ID.SETTINGS ? (
          <OfficialTournamentSettingsScreen
            tournament={tournament}
            officialMode={officialMode}
            onOfficialModeChange={handleOfficialModeChange}
            groupCount={groupCount}
            onGroupCountChange={setGroupCount}
            canManage={canManageOfficial}
            onPersistSettings={async (nextTournament) =>
              persistTournament(
                {
                  settings: nextTournament.settings,
                  officialMode,
                },
                { expectedVersion: tournament.version }
              )
            }
          />
        ) : null}

        {activeStageId === OFFICIAL_STAGE_ID.REGISTRATION ? (
          <OfficialTournamentRegistrationScreen
            tournament={tournament}
            event={savedEvent}
            players={flowPlayers}
            actor={
              user
                ? { id: user.id, email: user.email || "", name: user.displayName || user.name || "" }
                : null
            }
            clubId={activeClubId}
            onPersist={async (nextTournament) =>
              persistTournament({
                events: nextTournament.events,
                settings: nextTournament.settings,
                status: nextTournament.status,
              })
            }
            registrationChildren={
              <Alert severity="info" sx={{ mt: 1 }}>
                Thêm VĐV/cặp từ hệ thống: dùng bộ chọn bên dưới (không mở bốc thăm tại đây).
              </Alert>
            }
          />
        ) : null}

        {activeStageId === OFFICIAL_STAGE_ID.LOCK_ENTRIES ? (
          <OfficialTournamentFinalizeScreen
            tournament={tournament}
            eventId={savedEvent?.id || ""}
            players={flowPlayers}
            canManage={canManageOfficial}
            onLockRegistration={handleLockRegistrationFromStage}
          />
        ) : null}

        {activeStageId === OFFICIAL_STAGE_ID.DRAW ? (
          <Stack spacing={2}>
            {isAiBalance ? (
              <FounderPairingConstraintsPanel
                constraints={founderConstraints}
                players={flowPlayers}
                onChange={setFounderConstraints}
                onSave={handleSaveFounderConstraints}
              />
            ) : (
              <FormControlLabel
                control={
                  <Switch
                    checked={splitUnits}
                    onChange={(event) => setSplitUnits(event.target.checked)}
                  />
                }
                label="Tách đơn vị/công ty khi chia bảng"
              />
            )}
            <OfficialTournamentDrawScreen
              tournament={tournament}
              eventId={savedEvent?.id || ""}
              groupCount={groupCount}
              players={flowPlayers}
              canManage={canManageOfficial}
              pairBusy={pairBusy}
              groupBusy={groupBusy || drawBusy}
              onFormPairs={handleFormOfficialPairs}
              onGroupDraw={handleRunGroupDraw}
              onContinueToGroupStage={() => selectStage(OFFICIAL_STAGE_ID.GROUP_STAGE)}
            />
          </Stack>
        ) : null}

        {activeStageId === OFFICIAL_STAGE_ID.GROUP_STAGE ? (
          <OfficialTournamentGroupStageScreen
            tournament={tournament}
            event={savedEvent}
            tournamentId={tournamentId}
            players={flowPlayers}
            courts={courts}
            clubId={courtInventoryScope.ok ? courtInventoryScope.clubId : activeClubId}
            tenantId={courtInventoryScope.ok ? courtInventoryScope.tenantId : tenantId}
            venueId={courtInventoryScope.ok ? courtInventoryScope.venueId : null}
            drawPublish={drawPublish}
            hasDrawReopenPermission={hasDrawReopenPermission}
            onLockDraw={handleLockDraw}
            onPublishDraw={handlePublishDraw}
            onReopenDraw={handleReopenDraw}
            onForceRedraw={handleForceRedraw}
            onSubmitGroupScore={handleSubmitGroupScore}
            draftScope={scoreDraftScope}
            refereeRoster={refereeRoster}
            onRosterChange={handleRefereeRosterChange}
            actor={
              user
                ? { id: user.id, email: user.email || "", name: user.displayName || user.name || "" }
                : null
            }
            onPersistRefereeTournament={async (nextTournament) =>
              persistTournament(
                {
                  events: nextTournament.events,
                  settings: nextTournament.settings,
                },
                { expectedVersion: tournament.version }
              )
            }
            canManage={canManageOfficial}
            onSavedCourts={(result) => {
              if (result?.ok && result.tournament) {
                setTournament(result.tournament);
              }
            }}
            onGenerateSchedule={handleGenerateGroupSchedule}
            scheduleBusy={scheduleBusy}
          />
        ) : null}

        {String(activeStageId).startsWith("knockout:") &&
        activeStageId !== "knockout:pending" ? (
          <OfficialTournamentKnockoutRoundScreen
            tournament={tournament}
            event={savedEvent}
            roundName={activeStage?.roundName || activeStage?.label}
            canManage={canManageOfficial}
            onSubmitKnockoutScore={handleSubmitKnockoutScore}
            onToggleRoundLock={handleToggleRoundLock}
            draftScope={scoreDraftScope}
            tournamentId={tournamentId}
          />
        ) : null}

        {activeStageId === "knockout:pending" ||
        activeStageId === OFFICIAL_STAGE_ID.RESULTS ? (
          <OfficialTournamentResultsScreen
            tournament={tournament}
            event={savedEvent}
            tournamentId={tournamentId}
            canManage={canManageOfficial}
            onGenerateBracket={handleGenerateBracket}
            onSubmitKnockoutScore={handleSubmitKnockoutScore}
            onToggleRoundLock={handleToggleRoundLock}
            draftScope={scoreDraftScope}
            groupStandings={groupStandings}
            onPersistClose={async () => {
              const result = await officialCompleteTournamentCommand({
                tenantId: tenantId || tournament?.tenantId,
                clubId: courtInventoryScope.ok ? courtInventoryScope.clubId : activeClubId,
                tournamentId,
                expectedVersion: tournament.version,
              });
              if (!result.ok) {
                setError(result.error || "Không đóng được giải.");
                return false;
              }
              if (result.tournament) {
                setTournament(result.tournament);
              } else {
                await reload({ soft: true });
              }
              return { ok: true, tournament: result.tournament, ...result };
            }}
            onMessage={setMessage}
            onError={setError}
          />
        ) : null}
      </OfficialTournamentStageCard>

      {/* Mode/event chrome — keep mounted (no full remount on stage switch) */}
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
              <Button
                size="small"
                variant="outlined"
                color="error"
                disabled={eventDeleteBusy || !savedEvent?.id}
                onClick={handleAskDeleteEvent}
              >
                {eventDeleteBusy ? "Đang xóa…" : "Xóa nội dung"}
              </Button>
              <Button size="small" variant="outlined" onClick={handleAddEvent}>
                Thêm nội dung
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {activeStageId === OFFICIAL_STAGE_ID.REGISTRATION && (
      <>
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
          tenantId={
            currentTenantId ||
            tournament?.tenantId ||
            activeClub?.tenantId ||
            ""
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
        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="official-reg-event-type-label" shrink>
              Nội dung
            </InputLabel>
            <Select
              labelId="official-reg-event-type-label"
              label="Nội dung"
              notched
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
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            size="small"
            label="CLB đại diện (mặc định)"
            value={entryClubName}
            InputLabelProps={{ shrink: true }}
            onChange={(event) => setEntryClubName(event.target.value)}
            placeholder={activeClub?.name || "CLB chủ nhà"}
          />
        </Grid>
      </Grid>

      {!registrationModeResolved ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Hãy chọn và lưu <strong>Chế độ đăng ký</strong> ở bước Cài đặt trước khi thêm VĐV.
        </Alert>
      ) : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
              {isPairRegistration
                ? `Đăng ký theo cặp (${displayEntries.length})`
                : `Đăng ký vận động viên (${displayEntries.length})`}
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
              !registrationModeResolved ? (
                <Alert severity="warning">
                  Chế độ đăng ký chưa xác định — không mở form đăng ký.
                </Alert>
              ) : isIndividualRegistration ? (
                <Stack spacing={1.5}>
                  <TournamentPlayerPickerPanel
                    title=""
                    players={flowPlayers}
                    mode="select"
                    selectedIds={selectedIndividualPlayerIds}
                    onToggle={handleSelectIndividualCandidate}
                    onSelectAll={handleSelectVisibleIndividuals}
                    onClearAll={handleClearIndividualSelection}
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
                    showSelectActions={true}
                    selectAllLabel="Chọn tất cả đang hiển thị"
                    clearAllLabel="Bỏ chọn tất cả"
                    disabled={registerBusy}
                    emptyMessage="Không có VĐV phù hợp hoặc tất cả đã đăng ký."
                  />
                  <Typography variant="body2">
                    Đã chọn: {selectedIndividualPlayerIds.length} VĐV
                  </Typography>
                  <Button
                    variant="contained"
                    disabled={
                      selectedIndividualPlayerIds.length === 0 || registerBusy
                    }
                    onClick={handleRegisterSelectedIndividuals}
                  >
                    {registerBusy
                      ? `Đang đăng ký ${selectedIndividualPlayerIds.length} VĐV...`
                      : `Đăng ký ${selectedIndividualPlayerIds.length} VĐV`}
                  </Button>
                </Stack>
              ) : (
                <Stack spacing={1.5}>
                  <TournamentPlayerPickerPanel
                    title=""
                    players={flowPlayers}
                    mode="pair"
                    selectedIds={pairSelectedIds}
                    onPairPick={handlePairPlayerPick}
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
                    showPlayerList
                    showSkillLevel={canViewSkillInSetup}
                    emptyMessage="Không có VĐV phù hợp."
                  />
                  <Typography variant="caption" color="text.secondary">
                    Bấm VĐV trong danh sách để chọn VĐV 1 rồi VĐV 2 (hoặc dùng dropdown bên dưới).
                  </Typography>
                  <FormControl fullWidth size="small">
                    <InputLabel id="official-pair-a-label" shrink>
                      VĐV 1
                    </InputLabel>
                    <Select
                      labelId="official-pair-a-label"
                      label="VĐV 1"
                      notched
                      value={pairPlayerAId}
                      onChange={(event) => handlePairPlayerASelect(event.target.value)}
                    >
                      {openPairSelectAOptions.map((player) => (
                        <MenuItem key={player.id} value={String(player.id)}>
                          {player.name} — {formatPlayerPickerMeta(player)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth size="small">
                    <InputLabel id="official-pair-b-label" shrink>
                      VĐV 2
                    </InputLabel>
                    <Select
                      labelId="official-pair-b-label"
                      label="VĐV 2"
                      notched
                      value={pairPlayerBId}
                      onChange={(event) => handlePairPlayerBSelect(event.target.value)}
                    >
                      {openPairSelectBOptions.map((player) => (
                        <MenuItem key={player.id} value={String(player.id)}>
                          {player.name} — {formatPlayerPickerMeta(player)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="contained"
                    onClick={handleRegisterPair}
                    disabled={
                      registerBusy ||
                      !pairPlayerAId ||
                      !pairPlayerBId ||
                      String(pairPlayerAId) === String(pairPlayerBId)
                    }
                  >
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
                <Button
                  variant="contained"
                  disabled={!registrationModeResolved}
                  onClick={() => setQuickAddOpen(true)}
                >
                  Thêm VĐV mới
                </Button>
              </Stack>
            )}
          </Paper>

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
                          players={resolveTournamentEntryPlayers(entry, flowPlayers)}
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
        </Grid>
      </Grid>

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
      </>
      )}
      </>
      )}

      <Dialog
        open={eventDeleteOpen}
        onClose={() => {
          if (!eventDeleteBusy) setEventDeleteOpen(false);
        }}
      >
        <DialogTitle>Xóa nội dung thi đấu?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Bạn có chắc muốn xóa nội dung “{savedEvent?.name || ""}” khỏi giải này?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setEventDeleteOpen(false)}
            disabled={eventDeleteBusy}
          >
            Hủy
          </Button>
          <Button
            color="error"
            variant="outlined"
            disabled={eventDeleteBusy}
            onClick={handleConfirmDeleteEvent}
          >
            {eventDeleteBusy ? "Đang xóa…" : "Xóa nội dung"}
          </Button>
        </DialogActions>
      </Dialog>

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
    </TournamentSetupShell>
    </TournamentManageGate>
  );
}
