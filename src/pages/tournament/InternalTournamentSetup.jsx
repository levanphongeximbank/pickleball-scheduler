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
import { listEligibleCanonicalReferees } from "../../features/daily-play/services/refereeDirectoryService.js";
import { upsertMatchLive } from "../../domain/matchLiveSync.js";
import {
  listAvailableAthletes,
  resolveTeamTournamentAthleteClubId,
  resolveTeamTournamentAthleteTenantId,
  TEAM_TOURNAMENT_ATHLETE_SCOPE,
} from "../../features/team-tournament/services/teamTournamentAthletePoolService.js";
import { useCanonicalTournament } from "../../features/tournament/hooks/useCanonicalTournament.js";
import {
  INTERNAL_SETUP_CLUB_NOT_READY,
  resolveInternalSetupCanonicalClubScope,
  resolveInternalSetupRuntimeClubId,
  shouldAlignActiveClubToPersistedTournament,
} from "../../features/tournament/pages/internalTournamentSetupScope.js";
import {
  EVENT_TYPE,
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  EVENT_TYPE_OPTIONS,
} from "../../models/tournament/index.js";
import {
  buildInternalDrawEventWithoutMatches,
  buildInternalScheduleFromPersistedGroups,
  buildInternalTournamentPlan,
  suggestEntriesFromPlayers,
  filterPlayersForEventType,
  canGenerateBracket,
  generateKnockoutBracket,
  resolveBracketProgress,
  setBracketWinner,
  submitKnockoutMatchScore,
  toggleBracketRoundUnlock,
  resetBracketState,
  submitTournamentDirectorMatchScore,
} from "../../tournament/engines/index.js";
import {
  advanceHydrationBaselineAfterOwnWrite,
  assertInternalTournamentReadyForMutation,
  decideInternalSetupHydration,
  formatCanonicalVersionConflictError,
  hydrateInternalSetupFromTournament,
  isCanonicalVersionConflict,
  INTERNAL_VERSION_SYNCING_USER_MESSAGE,
  ONE_GROUP_COMPLETION_MESSAGE,
  assignInternalMatchReferee,
  classifyCanonicalMatchLifecycleResult,
  listEligibleInternalReferees,
  mapLifecycleStepToWorkspaceSection,
  INTERNAL_WORKSPACE_SECTION_QUERY,
  resolveInternalWorkspaceSection,
  resolveInternalKnockoutEligibility,
  resolveInternalTournamentLifecycle,
  resolveInternalWorkspaceKey,
  resolveInternalPageLoadingGate,
  shouldSkipKnockoutForInternal,
  INTERNAL_WORKSPACE_SECTIONS,
  INTERNAL_WORKSPACE_SECTION_LABELS,
  listInternalPersistedGroups,
  countInternalPersistedGroups,
  resolveInternalGroupMemberLabels,
  resolveInternalCompetitionUnit,
  resolveInternalGroupingEntries,
  projectInternalGroupDrawCard,
  COMPETITION_UNIT,
  loadInternalScheduleCourts,
  buildInternalRefereeMatchLiveRecord,
} from "../../features/tournament/internal/index.js";
import {
  reopenClosedTournament,
  isTournamentClosed,
} from "../../features/individual-tournament/engines/tournamentClosingEngine.js";
import InternalTournamentLifecycleStepper from "../../components/tournament/InternalTournamentLifecycleStepper.jsx";
import InternalScheduleStage from "../../components/tournament/internal/InternalScheduleStage.jsx";
import InternalMatchRefereeSelect from "../../components/tournament/internal/InternalMatchRefereeSelect.jsx";
import InternalRefereeStage from "../../components/tournament/internal/InternalRefereeStage.jsx";
import { buildIndividualAllGroupStandings } from "../../features/individual-tournament/adapters/individualStandingsAdapter.js";
import BracketView from "../../components/tournament/BracketView.jsx";
import GroupStagePanel from "../../components/tournament/GroupStagePanel.jsx";
import TournamentAnimationDialog from "../../components/tournament/animation/TournamentAnimationDialog.jsx";
import {
  ANIMATION_MODES,
  buildPairingSteps,
  buildPairingWaitingPlayers,
  buildSnakeSteps,
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
import { buildRefereeSettingsPatch, buildMatchLiveRecord, resolveMatchLabels } from "../../tournament/engines/refereeEngine.js";
import TournamentManageGate from "../../components/tournament/TournamentManageGate.jsx";
import TournamentSetupShell from "../../components/tournament/TournamentSetupShell.jsx";
import TournamentSelectedPlayersPanel from "../../components/tournament/TournamentSelectedPlayersPanel.jsx";
import { buildTournamentNotFoundMessage } from "../../features/club/index.js";
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
  projectLivePrivatePairingPrepareInput,
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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    activeClub,
    activeClubId,
    activeClubReady,
    clubReadReady,
    clubs,
    refreshClubs,
    switchClub,
  } = useClub();
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
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [courts, setCourts] = useState([]);
  const [canonicalReferees, setCanonicalReferees] = useState([]);
  const [canonicalRefereesLoading, setCanonicalRefereesLoading] = useState(false);
  const [canonicalRefereesError, setCanonicalRefereesError] = useState(null);
  const [canonicalRefereesWarning, setCanonicalRefereesWarning] = useState(null);
  const [sessionSection, setSessionSection] = useState(null);
  const [winnerDrafts, setWinnerDrafts] = useState({});
  const [pendingMatchId, setPendingMatchId] = useState(null);
  const [lifecycleNotice, setLifecycleNotice] = useState(null);
  const workspaceTouchedRef = useRef(false);
  const [staleHydrationNotice, setStaleHydrationNotice] = useState(null);
  const [reopenBusy, setReopenBusy] = useState(false);
  const hydrationMetaRef = useRef({
    tournamentId: "",
    eventId: "",
    baselineVersion: null,
    baselineHydration: null,
    generation: 0,
  });
  const setupFormRef = useRef({
    eventType: preselectedEvent || EVENT_TYPE.MIXED_DOUBLE,
    groupCount: 4,
    selectedPlayerIds: [],
    previewEntries: [],
  });
  const anim = useTournamentAnimation();
  const guidedPairingRef = useRef({
    ok: true,
    skipped: true,
    pairingOptions: { privatePairingRules: [] },
  });
  const drawMutationGuardRef = useRef(false);
  const scheduleMutationGuardRef = useRef(false);

  const canViewSkillInSetup = useMemo(
    () =>
      canViewPlayerSkillLevel(
        user,
        { clubId: activeClubId, tournamentId, tournamentContext: true },
        { rbacEnabled }
      ),
    [user, activeClubId, tournamentId, rbacEnabled]
  );

  const clubScope = useMemo(
    () =>
      resolveInternalSetupCanonicalClubScope({
        activeClubReady,
        clubReadReady,
        activeClub,
      }),
    [activeClubReady, clubReadReady, activeClub]
  );

  // Canonical load uses ready activeClub only — never ID-only / id-override scope.
  const {
    tournament,
    loading: tournamentLoading,
    refreshing: tournamentRefreshing,
    error: tournamentLoadError,
    update,
  } = useCanonicalTournament(
    clubScope.shouldQuery ? clubScope.scope : null,
    tournamentId,
    localRevision
  );

  const durableMutationReady = assertInternalTournamentReadyForMutation(tournament);

  const writeCanonical = async (patch, options = {}) => {
    const current = options.currentTournament || tournament;
    const ready = assertInternalTournamentReadyForMutation(current);
    if (!ready.ok) {
      setError(formatCanonicalVersionConflictError(ready));
      return ready;
    }
    const result = await update(patch, {
      ...options,
      currentTournament: current,
      expectedVersion:
        options.expectedVersion != null
          ? options.expectedVersion
          : ready.expectedVersion,
    });
    if (!result.ok) {
      setError(formatCanonicalVersionConflictError(result) || result.error);
    }
    return result;
  };

  const tournamentClubId = useMemo(
    () =>
      resolveInternalSetupRuntimeClubId({
        persistedClubId: tournament?.clubId,
        activeClubId: activeClub?.id || activeClubId,
      }),
    [tournament?.clubId, activeClub?.id, activeClubId]
  );

  useEffect(() => {
    if (
      shouldAlignActiveClubToPersistedTournament({
        activeClubReady,
        activeClubId,
        persistedClubId: tournament?.clubId,
      })
    ) {
      switchClub(String(tournament.clubId).trim());
    }
  }, [activeClubReady, activeClubId, tournament?.clubId, switchClub]);

  useEffect(() => {
    if (tournamentClubId) {
      setSourceClubId(tournamentClubId);
    }
  }, [tournamentClubId]);

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

  const hostClubRecord = useMemo(
    () =>
      clubs.find(
        (club) =>
          String(club?.id || "").trim() ===
          String(sourceClubId || tournamentClubId || "").trim()
      ) ||
      (clubScope.ok ? activeClub : null),
    [clubs, sourceClubId, tournamentClubId, clubScope.ok, activeClub]
  );

  const playerTenantId = useMemo(
    () =>
      clubScope.ok
        ? resolveTeamTournamentAthleteTenantId({
            tournament,
            club: hostClubRecord || activeClub,
            clubId: sourceClubId || tournamentClubId || clubScope.clubId,
            clubs,
            currentTenantId: clubScope.tenantId || currentTenantId,
            tournamentTenantId: tournament?.tenantId || clubScope.tenantId,
          })
        : null,
    [
      clubScope.ok,
      clubScope.clubId,
      clubScope.tenantId,
      tournament,
      hostClubRecord,
      activeClub,
      sourceClubId,
      tournamentClubId,
      clubs,
      currentTenantId,
    ]
  );

  const [players, setPlayers] = useState([]);
  const [tenantPlayers, setTenantPlayers] = useState([]);
  const [playersLoadError, setPlayersLoadError] = useState(null);
  const [playerDiagnostics, setPlayerDiagnostics] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!clubScope.ok || !playerTenantId) {
        if (!cancelled) {
          setPlayers([]);
          setPlayersLoadError(null);
          setPlayerDiagnostics(null);
        }
        return;
      }
      const clubId = resolveTeamTournamentAthleteClubId({
        tournamentClubId: tournament?.clubId || tournamentClubId || clubScope.clubId,
        clubFromQuery: "",
        selectedClubId: sourceClubId || clubScope.clubId,
        activeClubId: clubScope.clubId || activeClubId,
      });
      if (!clubId) {
        if (!cancelled) {
          setPlayers([]);
          setPlayersLoadError(null);
          setPlayerDiagnostics(null);
        }
        return;
      }
      const result = await listAvailableAthletes({
        tournamentId,
        clubId,
        tenantId: playerTenantId,
        scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.CLUB,
        callerName: "InternalTournamentSetup.club",
      });
      if (cancelled) return;
      setPlayerDiagnostics(result.diagnostics || null);
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
      setPlayers(result.athletes || []);
      if (result.empty && result.emptyMessage) {
        setPlayersLoadError({
          code: result.code || "NO_ELIGIBLE_CANDIDATES",
          message: result.emptyMessage,
          severity: "warning",
        });
      } else {
        setPlayersLoadError(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    clubScope.ok,
    clubScope.clubId,
    sourceClubId,
    localRevision,
    playerTenantId,
    tournament?.clubId,
    tournamentClubId,
    tournamentId,
    activeClubId,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!clubScope.ok || !playerTenantId) {
      setTenantPlayers([]);
      return undefined;
    }
    listAvailableAthletes({
      tournamentId,
      clubId: sourceClubId || tournamentClubId || clubScope.clubId,
      tenantId: playerTenantId,
      scopeMode: TEAM_TOURNAMENT_ATHLETE_SCOPE.TENANT,
      callerName: "InternalTournamentSetup.tenant",
    }).then((result) => {
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
      setTenantPlayers(result.athletes || []);
    });
    return () => {
      cancelled = true;
    };
  }, [
    clubScope.ok,
    clubScope.clubId,
    playerTenantId,
    localRevision,
    tournamentId,
    sourceClubId,
    tournamentClubId,
  ]);

  useEffect(() => {
    let cancelled = false;
    const clubId = tournamentClubId || clubScope.clubId;
    const tenantId =
      tournament?.tenantId || clubScope.tenantId || playerTenantId || currentTenantId;
    if (!clubId) {
      setCourts([]);
      return undefined;
    }
    void loadInternalScheduleCourts({ clubId, tenantId }).then((result) => {
      if (cancelled) return;
      setCourts(result.courts || []);
    });
    return () => {
      cancelled = true;
    };
  }, [
    tournamentClubId,
    clubScope.clubId,
    tournament?.tenantId,
    clubScope.tenantId,
    playerTenantId,
    currentTenantId,
    localRevision,
  ]);

  useEffect(() => {
    let cancelled = false;
    const tenantId =
      tournament?.tenantId || clubScope.tenantId || playerTenantId || currentTenantId;
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
      clubId: tournamentClubId || clubScope.clubId,
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
      if (!cancelled) setCanonicalRefereesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [
    tournament?.tenantId,
    clubScope.tenantId,
    playerTenantId,
    currentTenantId,
    tournamentClubId,
    clubScope.clubId,
    user?.id,
  ]);

  const competitionUnit = resolveInternalCompetitionUnit(eventType);
  const isSingleEvent = competitionUnit === COMPETITION_UNIT.PLAYER;
  setupFormRef.current = {
    eventType,
    groupCount,
    selectedPlayerIds,
    previewEntries,
  };

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
  const persistedGroups = useMemo(
    () => listInternalPersistedGroups(savedEvent),
    [savedEvent]
  );

  useEffect(() => {
    if (!tournament?.id) return;
    const meta = hydrationMetaRef.current;
    const decision = decideInternalSetupHydration({
      tournament,
      hydratedTournamentId: meta.tournamentId,
      hydratedEventId: meta.eventId,
      baselineVersion: meta.baselineVersion,
      form: {
        ...setupFormRef.current,
        queryEventType: preselectedEvent || null,
      },
      baselineHydration: meta.baselineHydration,
      incomingGeneration: meta.generation + 1,
      appliedGeneration: meta.generation,
    });

    if (decision.action === "IGNORE_STALE") {
      return;
    }

    meta.tournamentId = decision.nextTournamentId;
    meta.eventId = decision.nextEventId;
    meta.generation += 1;

    if (decision.action === "HYDRATE_FULL" && decision.hydration) {
      if (decision.apply.eventType) setEventType(decision.hydration.eventType);
      if (decision.apply.groupCount) setGroupCount(decision.hydration.groupCount);
      if (
        decision.apply.selectedPlayerIds &&
        decision.hydration.selectedPlayerIds.length > 0
      ) {
        setSelectedPlayerIds(decision.hydration.selectedPlayerIds);
      }
      setPreviewEntries([]);
      meta.baselineVersion = decision.nextBaselineVersion;
      meta.baselineHydration = {
        eventType: decision.hydration.eventType,
        groupCount: decision.hydration.groupCount,
        selectedPlayerIds: decision.hydration.selectedPlayerIds,
        previewEntries: decision.hydration.previewEntries || [],
      };
      setStaleHydrationNotice(null);
      return;
    }

    if (decision.staleServerRevision) {
      setStaleHydrationNotice(
        "Máy chủ đã cập nhật giải trong khi bạn đang chỉnh sửa chưa lưu. Thay đổi local được giữ — tải lại khi sẵn sàng đồng bộ."
      );
    }
  }, [tournament?.id, tournament?.version, tournament?.updatedAt, preselectedEvent]);

  const lifecycle = useMemo(
    () => resolveInternalTournamentLifecycle(tournament),
    [tournament]
  );

  const sectionResolution = useMemo(
    () =>
      resolveInternalWorkspaceSection({
        requestedSection: searchParams.get(INTERNAL_WORKSPACE_SECTION_QUERY),
        lifecycle,
        event: savedEvent,
      }),
    [searchParams, lifecycle, savedEvent]
  );
  const workspaceSection = sessionSection || sectionResolution.section;

  const selectWorkspaceSection = (stepIdOrSection) => {
    workspaceTouchedRef.current = true;
    const section = Object.values(INTERNAL_WORKSPACE_SECTIONS).includes(stepIdOrSection)
      ? stepIdOrSection
      : mapLifecycleStepToWorkspaceSection(stepIdOrSection);
    setSessionSection(section);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(INTERNAL_WORKSPACE_SECTION_QUERY, section);
        return next;
      },
      { replace: true }
    );
  };

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

  const persistEvent = async (nextEvent, options = {}) => {
    const result = await writeCanonical(
      {
        events: [{ ...savedEvent, ...nextEvent }],
      },
      {
        processMatchId: options.processMatchId || null,
        processEventId: savedEvent?.id || null,
        currentTournament: tournament,
      }
    );

    if (!result.ok) {
      setError(formatCanonicalVersionConflictError(result) || result.error);
      if (isCanonicalVersionConflict(result)) {
        setLocalRevision((value) => value + 1);
      }
      return false;
    }

    if (options.processMatchId && result.lifecycleOk === false) {
      const classified = classifyCanonicalMatchLifecycleResult(result);
      if (classified.class === "OPTIONAL_ENRICHMENT") {
        setLifecycleNotice(classified.message);
      }
    }

    return {
      ok: true,
      tournament: result.tournament,
      lifecycleOk: result.lifecycleOk !== false,
      lifecycleError: result.lifecycleError || null,
    };
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

  const handleLockDraw = async () => {
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
    const updateResult = await writeCanonical({
      settings: result.tournament.settings,
    });
    if (updateResult.ok) {
      setLocalRevision((value) => value + 1);
      refreshClubs();
      setMessage("Đã khóa bốc thăm. Sẵn sàng công bố.");
    }
  };

  const handlePublishDraw = async () => {
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
    const updateResult = await writeCanonical({
      settings: result.tournament.settings,
      events,
    });
    if (updateResult.ok) {
      setLocalRevision((value) => value + 1);
      refreshClubs();
      setMessage("Đã công bố bốc thăm. Bracket bất biến.");
    }
  };

  const handleReopenDraw = async () => {
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
    const updateResult = await writeCanonical({
      settings: result.tournament.settings,
    });
    if (updateResult.ok) {
      setLocalRevision((value) => value + 1);
      refreshClubs();
      setMessage("Đã mở lại bốc thăm để chỉnh sửa.");
    }
  };

  const handleForceRedraw = async () => {
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
    const updateResult = await writeCanonical({
      settings: result.tournament.settings,
    });
    if (updateResult.ok) {
      setLocalRevision((value) => value + 1);
      refreshClubs();
      setMessage("Force redraw được phép. Bạn có thể chia bảng lại.");
    }
  };

  const handleForceReopenTournament = async () => {
    setError(null);
    setMessage(null);
    if (reopenBusy) return;
    if (
      !window.confirm(
        "Mở lại giải đã hoàn tất? Kết quả sẽ được mở khóa để chỉnh sửa (force reopen)."
      )
    ) {
      return;
    }
    const reopened = reopenClosedTournament(tournament, { force: true });
    if (!reopened.ok) {
      setError(reopened.error);
      return;
    }
    setReopenBusy(true);
    try {
      const updateResult = await writeCanonical(
        {
          settings: reopened.tournament.settings,
          events: reopened.tournament.events,
          status: TOURNAMENT_STATUS.ACTIVE,
        },
        {
          forceStatusReopen: true,
          currentTournament: tournament,
        }
      );
      if (!updateResult.ok) {
        return;
      }
      setLocalRevision((value) => value + 1);
      refreshClubs();
      setMessage("Đã mở lại giải (completed → active).");
    } finally {
      setReopenBusy(false);
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
    const result = await writeCanonical({
      founderPairingConstraints: founderConstraints,
    });

    if (!result.ok) {
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
        previewEntries,
        setPreviewEntries,
        setWarnings,
        setMessage,
        setError,
        setLocalRevision,
        refreshClubs,
        persistEvent,
        getPrivatePairingOptions: () => guidedPairingRef.current,
        tournamentTenantId: tournament?.tenantId || clubScope.tenantId,
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
      previewEntries,
      refreshClubs,
      clubScope.tenantId,
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

  const handleRefereeRosterChange = async (nextRoster) => {
    const result = await writeCanonical(
      buildRefereeSettingsPatch(tournament, { roster: nextRoster })
    );

    if (!result.ok) {
      return result;
    }

    setLocalRevision((value) => value + 1);
    refreshClubs();
    setMessage("Đã cập nhật danh sách trọng tài.");
    return { ok: true };
  };

  const handleGenerateBracket = async () => {
    setError(null);
    setMessage(null);

    const eligibility = resolveInternalKnockoutEligibility(savedEvent);
    if (eligibility.skipKnockout) {
      setMessage(ONE_GROUP_COMPLETION_MESSAGE);
      setWarnings([]);
      return;
    }

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

    const persisted = await persistEvent(generated.event);
    if (!persisted) {
      return;
    }

    const progress = resolveBracketProgress(generated.event);
    setWarnings(generated.warnings || []);
    setMessage(`Da tao bracket knock-out voi ${generated.knockoutMatchCount} tran.`);

    anim.showAnimation(
      {
        animationMode: ANIMATION_MODES.BRACKET_REVEAL,
        bracket: progress,
      },
      null
    );
  };

  const handleDraftBracketWinner = (bracketMatchId, winnerSide) => {
    setWinnerDrafts((current) => ({
      ...current,
      [bracketMatchId]: winnerSide,
    }));
  };

  const handleConfirmBracketWinner = async (bracketMatchId, winnerSide) => {
    setPendingMatchId(bracketMatchId);
    try {
      const result = setBracketWinner(savedEvent, bracketMatchId, winnerSide || null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (await persistEvent(result.event)) {
        setWinnerDrafts((current) => {
          const next = { ...current };
          delete next[bracketMatchId];
          return next;
        });
        setMessage(winnerSide ? "Đã lưu đội thắng." : "Đã xóa đội thắng.");
      }
    } finally {
      setPendingMatchId(null);
    }
  };

  const handleAssignMatchReferee = async (matchId, rosterId) => {
    setPendingMatchId(matchId);
    try {
      const assigned = assignInternalMatchReferee({
        tournament,
        event: savedEvent,
        matchId,
        rosterId,
      });
      if (!assigned.ok) {
        setError(assigned.error);
        return;
      }
      if (await persistEvent(assigned.event)) {
        if (assigned.referee) {
          const match = (assigned.event.matches || []).find(
            (item) => String(item.id) === String(matchId)
          );
          const liveRecord = buildInternalRefereeMatchLiveRecord({
            clubId: tournamentClubId,
            tournament,
            event: assigned.event,
            match,
            courts,
            buildMatchLiveRecordFn: buildMatchLiveRecord,
            resolveMatchLabelsFn: resolveMatchLabels,
          });
          if (liveRecord) {
            const live = await upsertMatchLive(liveRecord);
            if (!live.ok) {
              setMessage(
                `Đã phân công ${assigned.referee.name}. Phiên chấm điểm sẽ sẵn sàng khi đồng bộ được.`
              );
              return;
            }
          }
        }
        setMessage(
          assigned.referee ? `Đã phân công ${assigned.referee.name}.` : "Đã bỏ phân công trọng tài."
        );
      }
    } finally {
      setPendingMatchId(null);
    }
  };

  const handleSubmitGroupScore = async (matchId, scores) => {
    setPendingMatchId(matchId);
    const result = submitTournamentDirectorMatchScore(savedEvent, matchId, scores);
    if (!result.ok) {
      setPendingMatchId(null);
      setError(result.error);
      return false;
    }

    if (await persistEvent(result.event, { processMatchId: matchId })) {
      setPendingMatchId(null);
      if (result.bracketAutoGenerated) {
        setMessage(
          `Đã lưu kết quả vòng bảng. Tự động tạo bracket knock-out (${result.bracketKnockoutMatchCount} trận).`
        );
      } else {
        setMessage("Đã lưu kết quả vòng bảng.");
      }
      return true;
    }

    setPendingMatchId(null);
    return false;
  };

  const handleSubmitKnockoutScore = async (matchId, scores) => {
    setPendingMatchId(matchId);
    let workingEvent = savedEvent;
    const linked = (savedEvent?.matches || []).find((item) => String(item.id) === String(matchId));
    const draftSide = linked?.bracketMatchId ? winnerDrafts[linked.bracketMatchId] : null;
    if (draftSide) {
      const winnerResult = setBracketWinner(workingEvent, linked.bracketMatchId, draftSide);
      if (!winnerResult.ok) {
        setPendingMatchId(null);
        setError(winnerResult.error);
        return false;
      }
      workingEvent = winnerResult.event;
    }
    const result = submitKnockoutMatchScore(workingEvent, matchId, scores);
    if (!result.ok) {
      setPendingMatchId(null);
      setError(result.error);
      return false;
    }

    if (await persistEvent(result.event, { processMatchId: matchId })) {
      setPendingMatchId(null);
      setMessage("Đã lưu kết quả knock-out.");
      return true;
    }

    setPendingMatchId(null);
    return false;
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

  const handleResetBracket = async () => {
    const confirmed = window.confirm(
      "Reset bracket? Se xoa toan bo tran knock-out va winner hien tai."
    );
    if (!confirmed) {
      return;
    }

    const nextEvent = resetBracketState(savedEvent);
    if (await persistEvent(nextEvent)) {
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

  const prepareInternalPrivatePairing = async (extra = {}) => {
    const projected = projectLivePrivatePairingPrepareInput({
      tournament: tournament || null,
      activeClub: clubScope.ok ? activeClub : null,
      tournamentId,
      clubId: tournamentClubId,
      hostClubId: clubScope.clubId || activeClubId,
      competitionClass: COMPETITION_CLASS.INTERNAL,
      eventId: savedEvent?.id || `event-${tournamentId}`,
      pairingConstraints: founderConstraints,
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

    if (!durableMutationReady.ok) {
      setError(formatCanonicalVersionConflictError(durableMutationReady));
      return;
    }

    const prepared = await prepareInternalPrivatePairing();

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

    const prepared = await prepareInternalPrivatePairing();

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

    const prepared = await prepareInternalPrivatePairing();

    if (!prepared.ok) {
      setError(prepared.error?.message || "Không thể áp dụng quy tắc riêng.");
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

    const grouping = resolveInternalGroupingEntries({
      eventType,
      previewEntries,
      selectedPlayers: players.filter((player) =>
        selectedPlayerIds.includes(String(player.id))
      ),
      pairingOptions,
    });

    applyConstraintWarnings(pairingOptions);

    if (pairingOptions.privatePairingError) {
      setError(pairingOptions.privatePairingError.message);
      return;
    }

    if (!grouping.ok) {
      setError(grouping.error);
      return;
    }

    const entries = grouping.entries;

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

    const mutationReady = assertInternalTournamentReadyForMutation(tournament);
    if (!mutationReady.ok) {
      setError(formatCanonicalVersionConflictError(mutationReady));
      return;
    }

    if (drawMutationGuardRef.current) {
      return;
    }
    drawMutationGuardRef.current = true;
    selectWorkspaceSection(INTERNAL_WORKSPACE_SECTIONS.DRAW);

    try {
      const draw = buildInternalDrawEventWithoutMatches(plan);
      if (!draw.ok) {
        setError(draw.error || "Không lưu được bảng đấu.");
        return;
      }

      // ONE durable mutation: groups + draw-created settings/audit together.
      const drafted = {
        ...tournament,
        events: [draw.event],
        status: TOURNAMENT_STATUS.READY,
        settings: {
          ...(tournament?.settings || {}),
          internal: {
            ...(tournament?.settings?.internal || {}),
            groupCount: draw.groupCount,
            eventType: draw.event.eventType,
          },
        },
      };
      const created = recordDrawCreated(drafted, draw.event.groups || [], {
        userId: user?.id,
        actor: buildDrawActor(),
        clubId: tournamentClubId,
        before: summarizeGroups(savedEvent?.groups || []),
      });
      if (!created.ok) {
        setError(created.error || "Không ghi nhận bốc thăm.");
        return;
      }

      const result = await writeCanonical(
        {
          events: created.tournament.events,
          status: TOURNAMENT_STATUS.READY,
          settings: created.tournament.settings,
        },
        {
          currentTournament: tournament,
          expectedVersion: mutationReady.expectedVersion,
        }
      );

      if (!result.ok) {
        return;
      }

      const advanced = advanceHydrationBaselineAfterOwnWrite({
        tournament: result.tournament,
        committedKeys: ["eventType", "groupCount", "selectedPlayerIds", "previewEntries"],
        previousBaselineHydration: hydrationMetaRef.current.baselineHydration,
      });
      hydrationMetaRef.current.baselineVersion = advanced.baselineVersion;
      hydrationMetaRef.current.baselineHydration = advanced.baselineHydration;
      setPreviewEntries([]);

      setWarnings(draw.warnings || []);
      setLocalRevision((value) => value + 1);
      refreshClubs();
      setMessage(
        `Đã chia ${countInternalPersistedGroups(result.tournament) || draw.groupCount} bảng và lưu lên máy chủ. Bước tiếp theo: Tạo lịch thi đấu.`
      );

      const steps = buildSnakeSteps({
        entries: draw.event.entries,
        players: selectedPlayers,
        groupCount,
        finalGroups: draw.event.groups,
      });

      anim.showAnimation(
        {
          animationMode: ANIMATION_MODES.SNAKE_GROUP,
          groups: draw.event.groups,
          steps,
          matchCount: 0,
        },
        null
      );
    } finally {
      drawMutationGuardRef.current = false;
    }
  };

  const handleGenerateSchedule = async () => {
    setError(null);
    setWarnings([]);
    setMessage(null);

    const mutationReady = assertInternalTournamentReadyForMutation(tournament);
    if (!mutationReady.ok) {
      setError(formatCanonicalVersionConflictError(mutationReady));
      return { ok: false };
    }

    if (scheduleMutationGuardRef.current || scheduleBusy) {
      return { ok: false };
    }

    if ((savedEvent?.matches || []).some((match) => !match?.bracketMatchId)) {
      setMessage("Lịch vòng bảng đã tồn tại.");
      return { ok: true, tournament, alreadyExists: true };
    }

    if (!(savedEvent?.groups || []).length) {
      setError("Chưa có bảng đấu để tạo lịch.");
      return { ok: false };
    }

    scheduleMutationGuardRef.current = true;
    setScheduleBusy(true);

    try {
      const prepared = await prepareInternalPrivatePairing();
      const schedule = buildInternalScheduleFromPersistedGroups({
        tournament,
        players,
        pairingConstraints: founderConstraints,
        privatePairingRules: prepared.ok
          ? prepared.pairingOptions?.privatePairingRules || []
          : [],
        clubId: tournamentClubId,
        competitionClass: COMPETITION_CLASS.INTERNAL,
        envSource: prepared.pairingOptions?.envSource,
        seed: prepared.pairingOptions?.seed,
        allowedByPublishedRules: prepared.pairingOptions?.allowedByPublishedRules,
        contextTime: prepared.pairingOptions?.contextTime,
      });

      if (!schedule.ok) {
        setError(schedule.errors?.join(" ") || "Không tạo được lịch.");
        return { ok: false };
      }

      const result = await writeCanonical(
        {
          events: [schedule.event],
          status: TOURNAMENT_STATUS.READY,
        },
        {
          currentTournament: tournament,
          expectedVersion: mutationReady.expectedVersion,
        }
      );

      if (!result.ok) {
        return { ok: false };
      }

      setWarnings(schedule.warnings || []);
      setMessage(`Đã lưu ${schedule.matchCount} trận vòng bảng lên máy chủ.`);
      return { ok: true, tournament: result.tournament };
    } finally {
      scheduleMutationGuardRef.current = false;
      setScheduleBusy(false);
    }
  };

  const pageLoadingGate = resolveInternalPageLoadingGate({
    clubScopeOk: clubScope.ok,
    tournamentLoading,
    tournament,
  });

  if (pageLoadingGate.showFullPageLoading && pageLoadingGate.reason === "club-not-ready") {
    return (
      <Box>
        <Alert severity="info">
          {clubScope.error || INTERNAL_SETUP_CLUB_NOT_READY}
        </Alert>
      </Box>
    );
  }

  if (pageLoadingGate.showFullPageLoading && pageLoadingGate.reason === "initial-load") {
    return (
      <Box>
        <Alert severity="info">Đang tải giải nội bộ...</Alert>
      </Box>
    );
  }

  if (!tournament) {
    return (
      <Box>
        <Alert severity="error">
          {error ||
            buildTournamentNotFoundMessage(tournamentId, { kind: "giải nội bộ" })}
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
    <TournamentManageGate tournamentId={tournamentId} tournament={tournament}>
    <Box key={resolveInternalWorkspaceKey(tournament)}>
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
          <InternalTournamentLifecycleStepper
            lifecycle={lifecycle}
            selectedStepId={lifecycle?.CURRENT_STEP}
            onSelectStep={selectWorkspaceSection}
          />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            {Object.values(INTERNAL_WORKSPACE_SECTIONS).map((section) => (
              <Button
                key={section}
                size="small"
                variant={workspaceSection === section ? "contained" : "outlined"}
                onClick={() => selectWorkspaceSection(section)}
              >
                {INTERNAL_WORKSPACE_SECTION_LABELS[section]}
              </Button>
            ))}
            {tournamentRefreshing ? (
              <Chip size="small" label="Đang đồng bộ..." variant="outlined" />
            ) : null}
          </Stack>
          {staleHydrationNotice ? (
            <Alert
              severity="warning"
              sx={{ mb: 2 }}
              onClose={() => setStaleHydrationNotice(null)}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    const hydrated = hydrateInternalSetupFromTournament(tournament, {
                      queryEventType: preselectedEvent || null,
                    });
                    setEventType(hydrated.eventType);
                    setGroupCount(hydrated.groupCount);
                    setSelectedPlayerIds(hydrated.selectedPlayerIds);
                    hydrationMetaRef.current.baselineVersion = tournament?.version ?? null;
                    hydrationMetaRef.current.baselineHydration = {
                      eventType: hydrated.eventType,
                      groupCount: hydrated.groupCount,
                      selectedPlayerIds: hydrated.selectedPlayerIds,
                      previewEntries: hydrated.previewEntries || [],
                    };
                    setStaleHydrationNotice(null);
                    setLocalRevision((value) => value + 1);
                  }}
                >
                  Tải lại từ máy chủ
                </Button>
              }
            >
              {staleHydrationNotice}
            </Alert>
          ) : null}
          {(isTournamentClosed(tournament) ||
            tournament?.status === TOURNAMENT_STATUS.COMPLETED) && (
            <Alert
              severity="info"
              sx={{ mb: 2 }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  disabled={reopenBusy}
                  onClick={() => void handleForceReopenTournament()}
                >
                  Mở lại giải
                </Button>
              }
            >
              Giải đã hoàn tất. Dùng &quot;Mở lại giải&quot; (force reopen + CAS) nếu cần chỉnh sửa.
            </Alert>
          )}
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
          {lifecycleNotice ? (
            <Alert
              severity="warning"
              sx={{ mb: 2 }}
              onClose={() => setLifecycleNotice(null)}
            >
              {lifecycleNotice}
            </Alert>
          ) : null}
          {tournament && !durableMutationReady.ok ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              {INTERNAL_VERSION_SYNCING_USER_MESSAGE}
            </Alert>
          ) : null}
          {playersLoadError && (
            <Alert
              severity={playersLoadError.severity === "warning" ? "warning" : "error"}
              sx={{ mb: 2 }}
            >
              {playersLoadError.message}
            </Alert>
          )}
          {import.meta.env?.DEV && searchParams.get("debug") === "1" && playerDiagnostics ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Candidate diagnostics: sourceCount={playerDiagnostics.sourceCount},
              membershipCount={playerDiagnostics.membershipCount},
              activeMembershipCount={playerDiagnostics.activeMembershipCount},
              eligibleCount={playerDiagnostics.eligibleCount},
              WRONG_SCOPE={playerDiagnostics.WRONG_SCOPE},
              MEMBERSHIP_INACTIVE={playerDiagnostics.MEMBERSHIP_INACTIVE},
              MISSING_IDENTITY_LINK={playerDiagnostics.MISSING_IDENTITY_LINK}
            </Alert>
          ) : null}
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
          tournament={tournament}
          clubId={tournamentClubId || clubScope.clubId}
          tenantId={
            tournament?.tenantId ||
            clubScope.tenantId ||
            resolveTeamTournamentAthleteTenantId({
              tournament,
              club: activeClub,
              clubId: tournamentClubId || clubScope.clubId,
              clubs,
              currentTenantId: clubScope.tenantId || currentTenantId,
              tournamentTenantId: tournament?.tenantId || clubScope.tenantId,
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
      {(workspaceSection === INTERNAL_WORKSPACE_SECTIONS.SETUP ||
        workspaceSection === INTERNAL_WORKSPACE_SECTIONS.DRAW) && (
      <>
      <Grid container spacing={2} sx={{ mb: 2 }}>
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
            onPersist={async (nextTournament) => {
              const result = await writeCanonical({
                events: nextTournament.events,
                settings: nextTournament.settings,
                status: nextTournament.status,
              });
              if (result.ok) {
                setLocalRevision((value) => value + 1);
                refreshClubs();
                return true;
              }
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
              disabled={!durableMutationReady.ok || selectedPlayerIds.length === 0}
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
              <Button
                fullWidth
                variant="outlined"
                onClick={handleSuggestPairs}
                disabled={!durableMutationReady.ok}
              >
                {isSingleEvent ? "Đề xuất danh sách" : "Đề xuất ghép cặp"}
              </Button>
              <Button
                fullWidth
                variant="contained"
                onClick={handleBuildGroups}
                disabled={!durableMutationReady.ok}
              >
                Chia bảng
              </Button>
            </Stack>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={handleGenerateSchedule}
              disabled={
                !durableMutationReady.ok ||
                scheduleBusy ||
                !(savedEvent?.groups || []).length ||
                (savedEvent?.matches || []).some((match) => !match?.bracketMatchId)
              }
            >
              {scheduleBusy ? "Đang tạo lịch..." : "Tạo lịch thi đấu"}
            </Button>
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
              Bảng đấu ({persistedGroups.length})
            </Typography>
            {!persistedGroups.length ? (
              <Typography variant="body2" color="text.secondary">
                Chưa chia bảng. Chọn VĐV, đề xuất cặp rồi bấm &quot;Chia bảng&quot;.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {persistedGroups.map((group) => {
                  const card = projectInternalGroupDrawCard(
                    group,
                    savedEvent?.eventType || eventType,
                    savedEvent
                  );
                  return (
                  <Paper key={group.id} variant="outlined" sx={{ p: 1.25 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography fontWeight="bold">{group.name || group.label || group.id}</Typography>
                      <Chip
                        size="small"
                        label={card.chipLabel}
                      />
                    </Stack>
                    {card.athleteCountLabel ? (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {card.athleteCountLabel}
                      </Typography>
                    ) : null}
                    {card.teamLabels.length ? (
                      <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                        {card.teamLabels.map((label, index) => (
                          <Typography key={`${group.id}-${index}`} variant="body2">
                            {index + 1}. {label}
                          </Typography>
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        {resolveInternalGroupMemberLabels(group, savedEvent).join(" | ") || "Chưa có thành viên"}
                      </Typography>
                    )}
                  </Paper>
                  );
                })}
                <DrawPublishControls
                  tournament={tournament}
                  groups={persistedGroups}
                  drawPublish={drawPublish}
                  hasReopenPermission={hasDrawReopenPermission}
                  onLock={handleLockDraw}
                  onPublish={handlePublishDraw}
                  onReopen={handleReopenDraw}
                  onForceRedraw={handleForceRedraw}
                  compact
                />
                <Button
                  variant="outlined"
                  size="small"
                  fullWidth
                  onClick={() => selectWorkspaceSection(INTERNAL_WORKSPACE_SECTIONS.SCHEDULE)}
                >
                  Mở lịch thi đấu
                </Button>
              </Stack>
            )}
          </Paper>

          <TournamentGroupEditor
            groups={persistedGroups}
            entries={savedEvent?.entries || editorEntries}
            players={players}
            canIntervene={canInterveneSetup && persistedGroups.length > 0}
            tournamentId={tournamentId}
            eventId={savedEvent?.id || ""}
            onApply={handleGroupInterventionApply}
            onAudit={pairingIntervention.auditGroupChange}
          />
        </Grid>
      </Grid>
      </>
      )}

      {workspaceSection === INTERNAL_WORKSPACE_SECTIONS.SCHEDULE ? (
        <Box sx={{ mt: 2 }}>
          <InternalScheduleStage
            tournament={tournament}
            event={savedEvent}
            courts={courts}
            entryLabels={Object.fromEntries(
              (savedEvent?.entries || []).map((entry) => [entry.id, entry.name || entry.id])
            )}
            busy={scheduleBusy}
            actor={
              user
                ? { id: user.id, email: user.email || "", name: user.displayName || user.name || "" }
                : null
            }
            clubId={tournamentClubId}
            onCreateMatches={handleGenerateSchedule}
            onSaveCourtSchedule={async (nextSchedule) =>
              writeCanonical(
                { courtSchedule: nextSchedule },
                { currentTournament: tournament, expectedVersion: tournament?.version }
              )
            }
            onPersistSettings={async (nextTournament, nextMatches) => {
              const result = await writeCanonical(
                {
                  settings: nextTournament.settings,
                  courtSchedule: nextTournament.courtSchedule,
                  events: nextTournament.events?.[0]
                    ? [
                        {
                          ...nextTournament.events[0],
                          matches: nextMatches || nextTournament.events[0].matches,
                        },
                      ]
                    : nextTournament.events,
                },
                { currentTournament: tournament, expectedVersion: tournament?.version }
              );
              return result.ok;
            }}
          />
        </Box>
      ) : null}

      {workspaceSection === INTERNAL_WORKSPACE_SECTIONS.REFEREE ? (
        <InternalRefereeStage
          tournament={tournament}
          event={savedEvent}
          entryLabels={Object.fromEntries(
            (savedEvent?.entries || []).map((entry) => [entry.id, entry.name || entry.id])
          )}
          pendingMatchId={pendingMatchId}
          onRosterChange={handleRefereeRosterChange}
          onAssign={handleAssignMatchReferee}
          enableCanonicalDirectory
          canonicalCandidates={canonicalReferees}
          canonicalLoading={canonicalRefereesLoading}
          canonicalError={canonicalRefereesError}
          canonicalWarning={canonicalRefereesWarning}
        />
      ) : null}

      {workspaceSection === INTERNAL_WORKSPACE_SECTIONS.RESULTS &&
        savedEvent?.groups?.length > 0 && (
        <Stack spacing={2} sx={{ mt: 2 }}>
          <GroupStagePanel
            event={savedEvent}
            players={players}
            onSubmitScore={handleSubmitGroupScore}
            draftScope={scoreDraftScope}
            pendingMatchId={pendingMatchId}
            renderMatchExtras={(match) => (
              <InternalMatchRefereeSelect
                match={match}
                roster={listEligibleInternalReferees(tournament)}
                pending={String(pendingMatchId || "") === String(match.id)}
                onAssign={handleAssignMatchReferee}
              />
            )}
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
        </Stack>
      )}

      {workspaceSection === INTERNAL_WORKSPACE_SECTIONS.BRACKET && (
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", sm: "center" }}
              sx={{ mb: 1.5 }}
            >
              <Typography variant="subtitle1" fontWeight="bold">
                {shouldSkipKnockoutForInternal(savedEvent)
                  ? "Kết thúc 1 bảng / Nhà vô địch"
                  : "Sơ đồ knock-out"}
              </Typography>
              <Stack direction="row" spacing={1}>
                {!shouldSkipKnockoutForInternal(savedEvent) &&
                  savedEvent?.bracket?.rounds?.length > 0 && (
                  <Button
                    component={RouterLink}
                    to={`/tournament/internal/${tournamentId}/bracket`}
                    variant="outlined"
                  >
                    Mở sơ đồ đầy đủ
                  </Button>
                )}
                {!shouldSkipKnockoutForInternal(savedEvent) &&
                  !savedEvent?.bracket?.rounds?.length && (
                  <Button variant="contained" onClick={handleGenerateBracket}>
                    Tạo bracket từ BXH
                  </Button>
                )}
              </Stack>
            </Stack>

            {shouldSkipKnockoutForInternal(savedEvent) ? (
              <Alert severity="info" sx={{ mb: 1 }}>
                {ONE_GROUP_COMPLETION_MESSAGE} Hoàn tất mọi trận vòng bảng rồi vào Trao giải / Đóng giải.
              </Alert>
            ) : !savedEvent?.bracket?.rounds?.length ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Chưa có sơ đồ. Nhập điểm vòng bảng xong rồi bấm &quot;Tạo bracket từ BXH&quot;.
                Cần số bảng chẵn (2, 4, 8...).
              </Typography>
            ) : null}

            {!shouldSkipKnockoutForInternal(savedEvent) ? (
            <BracketView
              progress={bracketProgress}
              unlockedRounds={savedEvent?.bracket?.unlockedRounds || {}}
              knockoutMatchesByBracketId={knockoutMatchesByBracketId}
              onSelectWinner={handleDraftBracketWinner}
              onConfirmWinner={handleConfirmBracketWinner}
              winnerDrafts={winnerDrafts}
              onToggleRoundLock={handleToggleRoundLock}
              onSubmitScore={handleSubmitKnockoutScore}
              onReset={handleResetBracket}
              canReset={Boolean(savedEvent?.bracket?.rounds?.length)}
              draftScope={scoreDraftScope}
              pendingMatchId={pendingMatchId}
              renderMatchExtras={(match) => (
                <InternalMatchRefereeSelect
                  match={match}
                  roster={listEligibleInternalReferees(tournament)}
                  pending={String(pendingMatchId || "") === String(match.id)}
                  onAssign={handleAssignMatchReferee}
                />
              )}
            />
            ) : null}
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

      </>
      )}
    </TournamentSetupShell>
    </Box>
    </TournamentManageGate>
  );
}
