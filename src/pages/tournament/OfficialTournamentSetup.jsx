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
import { useCanonicalTournament } from "../../features/tournament/hooks/useCanonicalTournament.js";
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
  resolveBracketProgress,
  setBracketWinner,
  submitKnockoutMatchScore,
  submitTournamentDirectorMatchScore,
  suggestBalancedEntriesFromIndividuals,
  suggestEntriesFromPlayers,
  toggleBracketRoundUnlock,
  upsertOfficialEvent,
  validateOpenRegistrationPlayers,
} from "../../tournament/engines/index.js";
import TournamentAnimationDialog from "../../components/tournament/animation/TournamentAnimationDialog.jsx";
import BracketRevealAnimation from "../../components/tournament/animation/BracketRevealAnimation.jsx";
import {
  ANIMATION_MODES,
  buildGroupMatchPairingSteps,
  buildPairingSteps,
  buildPairingWaitingPlayers,
  buildRandomDrawSteps,
  buildSnakeSteps,
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
import { canViewPlayerSkillLevel } from "../../auth/rbac.js";
import { useTenant } from "../../context/TenantContext.jsx";
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
import { resolveEventTypeFromQuery } from "../../features/individual-tournament/index.js";
import {
  OFFICIAL_STAGE_ID,
  deriveOfficialOrganizerStages,
  deriveOfficialNextAction,
  buildOfficialDrawBlockMessage,
} from "../../features/individual-tournament/engines/officialOrganizerWorkflowEngine.js";
import {
  getOfficialCompetitionSettings,
  OFFICIAL_REGISTRATION_MODE,
} from "../../features/individual-tournament/engines/officialTournamentSettingsEngine.js";
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
  const [activeStageId, setActiveStageId] = useState(OFFICIAL_STAGE_ID.SETTINGS);
  const [stageTouched, setStageTouched] = useState(false);
  const [drawBusy, setDrawBusy] = useState(false);
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
  /** Preloaded prepareLive result for sync guided-flow adapters (flags OFF → empty rules). */
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

  const {
    tournament,
    loading: tournamentLoading,
    error: tournamentLoadError,
    update,
  } = useCanonicalTournament(activeClub, tournamentId, localRevision);

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
      tournament?.tenantId ||
      activeClub?.tenantId ||
      activeClub?.venueId ||
      currentTenantId ||
      "",
    [tournament?.tenantId, activeClub?.tenantId, activeClub?.venueId, currentTenantId]
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

  const flowPlayers = allTenantPlayers;

  const selectedPlayers = useMemo(() => {
    const pool = new Map(flowPlayers.map((player) => [String(player.id), player]));
    return selectedPlayerIds
      .map((id) => pool.get(String(id)))
      .filter(Boolean);
  }, [selectedPlayerIds, flowPlayers]);

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

  useEffect(() => {
    if (!stageTouched && workflow?.currentStageId) {
      setActiveStageId(workflow.currentStageId);
    }
  }, [workflow?.currentStageId, stageTouched]);

  const activeStage =
    workflow.stages.find((stage) => stage.id === activeStageId) || workflow.stages[0];

  const selectStage = (stageId) => {
    setStageTouched(true);
    setActiveStageId(stageId);
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
    () => (savedEvent ? buildIndividualAllGroupStandings(savedEvent) : []),
    [savedEvent]
  );

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
    if (!activeEventId && savedEvents[0]?.id) {
      setActiveEventId(savedEvents[0].id);
    }
  }, [activeEventId, savedEvents]);

  const persistTournament = async (patch, options = {}) => {
    const { status, ...dataPatch } = patch;
    const result = await update(
      status ? { ...dataPatch, status } : patch,
      options
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

    setLocalRevision((value) => value + 1);
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

  const handleEntryInterventionApply = (result) => {
    if (!result?.ok) {
      return;
    }
    setPreviewEntries(result.entries);
    if (savedEvent?.entries?.length) {
      void persistEvent({ entries: result.entries });
    }
    setMessage("Super Admin đã cập nhật ghép cặp.");
  };

  const handleGroupInterventionApply = async (result) => {
    if (!result?.ok) {
      return;
    }
    if (
      await persistEvent({
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
          return buildOfficialAiBalancePlan({
            tournament,
            eventId: savedEvent?.id,
            players: flowPlayers,
            selectedPlayerIds,
            eventType,
            groupCount,
            manualEntries,
            individualRegistration: true,
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

  const handleStartGuidedFlow = async () => {
    setError(null);
    setWarnings([]);
    setMessage(null);

    const prepared = await prepareOfficialPrivatePairing();

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

    const pipeline = isAiBalance
      ? undefined
      : resolveOfficialOpenPipeline({
          includeBracket: savedEvent ? canGenerateBracket(savedEvent).ok : true,
        });

    // Option A: confirm draw → persist entries/groups/matches before animation.
    const ctx = {};
    const validation = flowAdapters.validateStart?.(ctx);
    if (validation && validation.ok === false) {
      if (broadcastFeatureEnabled && broadcast.isLive) {
        await broadcast.stopBroadcast();
      }
      setError(validation.error || "Không thể bắt đầu trình chiếu.");
      return;
    }

    if (ctx.plan?.ok) {
      const patch = isAiBalance
        ? buildOfficialAiBalancePatch(tournament, ctx.plan)
        : buildOfficialOpenPatch(tournament, ctx.plan);
      if (!patch.ok) {
        if (broadcastFeatureEnabled && broadcast.isLive) {
          await broadcast.stopBroadcast();
        }
        setError(patch.error || "Không lưu được bảng đấu.");
        return;
      }

      const saved = await persistTournament({
        events: patch.events,
        officialMode: isAiBalance ? OFFICIAL_MODE.AI_BALANCE : OFFICIAL_MODE.OPEN,
        hostClubName: tournament.hostClubName || activeClub?.name || "",
        status: TOURNAMENT_STATUS.READY,
        settings: {
          ...(tournament.settings || {}),
          ...(isAiBalance
            ? { aiBalance: { updatedAt: new Date().toISOString() } }
            : {
                openDraw: {
                  splitUnits,
                  drawScore: patch.drawScore,
                  updatedAt: new Date().toISOString(),
                },
              }),
        },
      });

      if (!saved) {
        if (broadcastFeatureEnabled && broadcast.isLive) {
          await broadcast.stopBroadcast();
        }
        return;
      }

      if (!isAiBalance) {
        const created = recordDrawCreated(saved.tournament || tournament, patch.event?.groups || [], {
          userId: user?.id,
          actor: buildDrawActor(),
          clubId: activeClubId,
          before: summarizeGroups(savedEvent?.groups || []),
        });
        if (created.ok) {
          await persistTournament({ settings: created.tournament.settings });
        }
      }

      ctx.drawAlreadyPersisted = true;
      if (patch.event?.id) {
        setActiveEventId(patch.event.id);
      }
      setRegisteredEntries([]);
      setPreviewEntries([]);
      setWarnings(patch.warnings || []);
    }

    const result = flow.startFlow(ctx, { pipeline });
    if (result?.ok === false) {
      if (broadcastFeatureEnabled && broadcast.isLive) {
        await broadcast.stopBroadcast();
      }
      setError(result.error || "Không thể bắt đầu trình chiếu.");
    }
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
    setOfficialMode(nextMode);
    setPreviewEntries([]);
    setRegisteredEntries([]);
    setSelectedPlayerIds([]);
    void persistTournament({ officialMode: nextMode });
  };

  const handleAddEvent = async () => {
    const newEvent = createOfficialEventRecord(tournament, { eventType });
    const events = [...savedEvents, newEvent];
    if (await persistTournament({ events })) {
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

  const registerPlayerEntry = async (player) => {
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

    const nextEntries = [...displayEntries, entry];
    setRegisteredEntries(nextEntries);
    const saved = await persistAcceptedEntries(nextEntries);
    if (!saved) {
      setRegisteredEntries(displayEntries);
      return false;
    }
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

  const handleSuggestAiPairs = async () => {
    setError(null);
    setWarnings([]);

    const prepared = await prepareOfficialPrivatePairing();

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
      competitionClass: COMPETITION_CLASS.OFFICIAL,
    };

    const entries = suggestBalancedEntriesFromIndividuals(selectedPlayers, eventType, pairingOptions);

    applyConstraintWarnings(pairingOptions);

    if (pairingOptions.privatePairingError) {
      setError(pairingOptions.privatePairingError.message);
      return;
    }

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
      async () => {
        setPreviewEntries(entries);
        const saved = await persistAcceptedEntries(entries);
        if (!saved) {
          return;
        }
        setMessage(`Da de xuat ${entries.length} cap/VDV theo rating.`);
      }
    );
  };

  const handleBuildAiGroups = async () => {
    setError(null);
    setWarnings([]);
    setMessage(null);

    const prepared = await prepareOfficialPrivatePairing();

    if (!prepared.ok) {
      setError(prepared.error?.message || "Không thể áp dụng quy tắc riêng.");
      setWarnings(
        (prepared.error?.fatalConflicts || prepared.error?.blockedByPolicy || []).map(
          (item) => item.code || item.message || String(item)
        )
      );
      return false;
    }

    let entries = previewEntries;
    if (previewEntries.length === 0) {
      const pairingOptions = {
        ...prepared.pairingOptions,
        tournamentId,
        eventId: savedEvent?.id || `event-${tournamentId}`,
        pairingConstraints: founderConstraints,
        competitionClass: COMPETITION_CLASS.OFFICIAL,
      };

      const competition = getOfficialCompetitionSettings(tournament);
      const eligibleForPairing =
        competition.registrationMode === OFFICIAL_REGISTRATION_MODE.INDIVIDUAL
          ? (() => {
              const gate = buildOfficialDrawBlockMessage(
                savedEvent?.entries || displayEntries,
                tournament,
                2
              );
              const playerIds = new Set();
              (gate.eligible || []).forEach((entry) => {
                (entry.playerIds || []).forEach((id) => playerIds.add(String(id)));
              });
              const fromEntries = flowPlayers.filter((p) => playerIds.has(String(p.id)));
              return fromEntries.length > 0 ? fromEntries : selectedPlayers;
            })()
          : selectedPlayers;

      entries = suggestBalancedEntriesFromIndividuals(
        eligibleForPairing,
        eventType,
        pairingOptions
      );

      applyConstraintWarnings(pairingOptions);

      if (pairingOptions.privatePairingError) {
        setError(pairingOptions.privatePairingError.message);
        return false;
      }
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
      privatePairingRules: prepared.pairingOptions?.privatePairingRules || [],
      clubId: activeClubId,
      competitionClass: COMPETITION_CLASS.OFFICIAL,
      envSource: prepared.pairingOptions?.envSource,
      seed: prepared.pairingOptions?.seed,
      allowedByPublishedRules: prepared.pairingOptions?.allowedByPublishedRules,
      contextTime: prepared.pairingOptions?.contextTime,
    });

    if (!plan.ok) {
      setError(plan.privatePairingError?.message || plan.errors?.join(" "));
      setWarnings(plan.warnings || []);
      return false;
    }

    const steps = buildSnakeSteps({
      entries: plan.event.entries,
      players: selectedPlayers,
      groupCount,
      finalGroups: plan.event.groups,
    });

    const patch = buildOfficialAiBalancePatch(tournament, plan);
    if (!patch.ok) {
      setError(patch.error || "Khong luu duoc bang dau.");
      return false;
    }

    // Option A: durable authority before animation (presentation only).
    const saved = await persistTournament({
      events: patch.events,
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
      return false;
    }

    pendingPlanRef.current = plan;
    setPreviewEntries([]);
    setWarnings(patch.warnings || []);
    setActiveEventId(patch.event.id);
    setMessage(
      `Đã chia ${patch.event.groups.length} bảng và lưu ${plan.matchCount} trận. Đang trình chiếu…`
    );

    anim.showAnimation(
      {
        animationMode: ANIMATION_MODES.SNAKE_GROUP,
        groups: plan.event.groups,
        steps,
        matchCount: plan.matchCount,
        onStartMatchPairing: () => openMatchPairingAnimation(plan),
      },
      () => {
        pendingPlanRef.current = null;
        setMessage(
          `Đã chia ${patch.event.groups.length} bảng (${plan.matchCount} trận). Có thể bỏ qua trình chiếu ghép cặp — dữ liệu đã lưu.`
        );
      }
    );
    return true;
  };

  const handleRegisterSingle = (playerId, playerOverride = null) => {
    setError(null);
    const player =
      playerOverride ||
      flowPlayers.find((item) => String(item.id) === String(playerId));
    if (!player) {
      return;
    }

    registerPlayerEntry(player);
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
    setRegisteredEntries(nextEntries);
    setPairPlayerAId("");
    setPairPlayerBId("");
    const saved = await persistAcceptedEntries(nextEntries);
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

    const drawGate = buildOfficialDrawBlockMessage(displayEntries, tournament, 2);
    if (!drawGate.ok) {
      setError(drawGate.error);
      return false;
    }
    let eligibleEntries = drawGate.eligible;

    const competition = getOfficialCompetitionSettings(tournament);
    const needsIndividualPairFormation =
      competition.registrationMode === OFFICIAL_REGISTRATION_MODE.INDIVIDUAL &&
      !isSingleEventType(eventType) &&
      eligibleEntries.every((entry) => (entry.playerIds || []).length <= 1);

    if (needsIndividualPairFormation) {
      const preparedPairing = await prepareOfficialPrivatePairing();
      if (!preparedPairing.ok) {
        setError(preparedPairing.error?.message || "Không ghép được cặp.");
        return false;
      }
      const playerIds = new Set();
      eligibleEntries.forEach((entry) => {
        (entry.playerIds || []).forEach((id) => playerIds.add(String(id)));
      });
      const individuals = flowPlayers.filter((p) => playerIds.has(String(p.id)));
      if (individuals.length < 2) {
        setError("Cần ít nhất 2 VĐV đủ điều kiện để ghép cặp.");
        return false;
      }
      const pairingOptions = {
        ...preparedPairing.pairingOptions,
        tournamentId,
        eventId: savedEvent?.id || `event-${tournamentId}`,
        pairingConstraints: founderConstraints,
        competitionClass: COMPETITION_CLASS.OFFICIAL,
      };
      eligibleEntries = suggestEntriesFromPlayers(individuals, eventType, pairingOptions);
      if (pairingOptions.privatePairingError) {
        setError(pairingOptions.privatePairingError.message);
        return false;
      }
      if (!eligibleEntries.length) {
        setError("Ghép cặp thất bại — không tạo được cặp hợp lệ.");
        return false;
      }
    }

    if (eligibleEntries.length < 2) {
      setError("Can it nhat 2 doi/VDV da dang ky.");
      return false;
    }

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

    const steps = buildRandomDrawSteps(plan.event.groups);

    // Option A: durable authority before animation (presentation only).
    const saved = await persistTournament({
      events: patch.events,
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
    setRegisteredEntries([]);
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

    if (isAiBalance) {
      const patch = buildOfficialAiBalancePatch(tournament, plan);
      if (!patch.ok) {
        setError(patch.error || "Không lưu được lịch thi đấu.");
        return false;
      }

      const saved = await persistTournament({
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

      const saved = await persistTournament({
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
      async () => {
        await persistMatchPairing(plan);
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
      async () => {
        if (await persistEvent(generated.event)) {
          setWarnings(generated.warnings || []);
          setMessage(`Da tao bracket knock-out (${generated.knockoutMatchCount} tran).`);
        }
      }
    );
  };

  const handleSelectBracketWinner = async (bracketMatchId, winnerSide) => {
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

    if (await persistEvent(result.event)) {
      setMessage(winnerSide ? "Da cap nhat winner." : "Da xoa winner.");
    }
  };

  const handleSubmitGroupScore = async (matchId, scores) => {
    const result = submitTournamentDirectorMatchScore(savedEvent, matchId, scores);
    if (!result.ok) {
      setError(result.error);
      return false;
    }

    const saved = await persistEvent(result.event, { processMatchId: matchId });
    if (!saved) {
      return false;
    }

    if (saved.lifecycleOk === false) {
      setMessage(
        "Đã lưu kết quả vòng bảng. Cập nhật Elo/điểm mùa thất bại — kết quả trận vẫn còn."
      );
      return true;
    }

    if (result.bracketAutoGenerated) {
      setMessage(
        `Đã lưu kết quả vòng bảng. Tự động tạo bracket knock-out (${result.bracketKnockoutMatchCount} trận).`
      );
    } else {
      setMessage("Đã lưu kết quả vòng bảng.");
    }
    return true;
  };

  const handleSubmitKnockoutScore = async (matchId, scores) => {
    const result = submitKnockoutMatchScore(savedEvent, matchId, scores);
    if (!result.ok) {
      setError(result.error);
      return false;
    }

    const saved = await persistEvent(result.event, { processMatchId: matchId });
    if (!saved) {
      return false;
    }

    if (saved.lifecycleOk === false) {
      setMessage(
        "Đã lưu kết quả knock-out. Cập nhật Elo/điểm mùa thất bại — kết quả trận vẫn còn."
      );
      return true;
    }

    setMessage("Da luu ket qua knock-out.");
    return true;
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
      <OfficialTournamentControlCenter
        tournament={tournament}
        stages={workflow.stages}
        facts={workflow.facts}
        nextAction={nextAction}
        activeStageId={activeStageId}
        onSelectStage={selectStage}
        onPrimaryAction={handlePrimaryNextAction}
        canManage
      />

      <OfficialTournamentStageCard stage={activeStage}>
        {activeStageId === OFFICIAL_STAGE_ID.SETTINGS ? (
          <OfficialTournamentSettingsScreen
            tournament={tournament}
            officialMode={officialMode}
            onOfficialModeChange={handleOfficialModeChange}
            groupCount={groupCount}
            onGroupCountChange={setGroupCount}
            canManage
            onPersistSettings={async (nextTournament) =>
              persistTournament({
                settings: nextTournament.settings,
                officialMode,
              })
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
            canManage
            onLockRegistration={handleLockRegistrationFromStage}
          />
        ) : null}

        {activeStageId === OFFICIAL_STAGE_ID.DRAW ? (
          <OfficialTournamentDrawScreen
            tournament={tournament}
            eventId={savedEvent?.id || ""}
            groupCount={groupCount}
            canManage
            drawBusy={drawBusy}
            onStartDraw={async () => {
              setDrawBusy(true);
              try {
                const competition = getOfficialCompetitionSettings(tournament);
                let ok = false;
                if (competition.registrationMode === OFFICIAL_REGISTRATION_MODE.INDIVIDUAL) {
                  if (isAiBalance) {
                    ok = await handleBuildAiGroups();
                  } else {
                    ok = await handleDrawGroups(false);
                  }
                } else if (isAiBalance) {
                  ok = await handleBuildAiGroups();
                } else {
                  ok = await handleDrawGroups(false);
                }
                if (!ok) {
                  return { ok: false, error: "Bốc thăm thất bại — chưa công bố bảng." };
                }
                return { ok: true };
              } catch (err) {
                return { ok: false, error: err?.message || "Bốc thăm thất bại." };
              } finally {
                setDrawBusy(false);
              }
            }}
          />
        ) : null}

        {activeStageId === OFFICIAL_STAGE_ID.GROUP_STAGE ? (
          <OfficialTournamentGroupStageScreen
            tournament={tournament}
            event={savedEvent}
            tournamentId={tournamentId}
            players={flowPlayers}
            courts={courts}
            clubId={activeClubId}
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
              persistTournament({
                events: nextTournament.events,
                settings: nextTournament.settings,
              })
            }
            canManage
            onSavedCourts={() => {
              setLocalRevision((value) => value + 1);
              refreshClubs();
            }}
          />
        ) : null}

        {String(activeStageId).startsWith("knockout:") &&
        activeStageId !== "knockout:pending" ? (
          <OfficialTournamentKnockoutRoundScreen
            tournament={tournament}
            event={savedEvent}
            roundName={activeStage?.roundName || activeStage?.label}
            canManage
            onSubmitKnockoutScore={handleSubmitKnockoutScore}
            onSelectWinner={handleSelectBracketWinner}
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
            canManage
            onGenerateBracket={handleGenerateBracket}
            onSubmitKnockoutScore={handleSubmitKnockoutScore}
            onSelectWinner={handleSelectBracketWinner}
            onToggleRoundLock={handleToggleRoundLock}
            draftScope={scoreDraftScope}
            groupStandings={groupStandings}
            onPersistClose={async (nextTournament) =>
              persistTournament({
                events: nextTournament.events,
                settings: nextTournament.settings,
                status: nextTournament.status,
              })
            }
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
            activeClub?.venueId ||
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
                players={flowPlayers}
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
                <Button
                  fullWidth
                  variant="outlined"
                  disabled
                  title="Dùng bước Bốc thăm"
                >
                  Chia bảng → bước Bốc thăm
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
                  players={flowPlayers}
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
                    <InputLabel>VDV 1</InputLabel>
                    <Select
                      label="VDV 1"
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
                    <InputLabel>VDV 2</InputLabel>
                    <Select
                      label="VDV 2"
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
              <Button fullWidth variant="outlined" disabled title="Dùng bước Bốc thăm">
                Chia bảng → bước Bốc thăm
              </Button>
            </Stack>
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
