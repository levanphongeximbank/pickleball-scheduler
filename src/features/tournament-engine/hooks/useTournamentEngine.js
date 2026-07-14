import { useCallback, useEffect, useMemo, useState } from "react";

import { useClub } from "../../../context/ClubContext.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import { usePlatformRuntime } from "../../../core/platform/app/usePlatformRuntime.js";
import { loadCourtsForClub } from "../../../domain/clubStorage.js";
import { getTournament, updateTournament } from "../../../domain/tournamentService.js";
import {
  buildEngineContext,
  mergeEngineStateIntoSettings,
  applyEnginePlanToEvent,
} from "../services/tournamentEngineAdapter.js";
import {
  runSeedEngine,
  runDrawEngine,
  runScheduleEngine,
  runCourtAssignmentEngine,
  runTimePredictionEngine,
  runRankingEngine,
  runFullTournamentPlan,
} from "../orchestrator/tournamentEngine.js";
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
  DRAW_PUBLISH_STATUS,
} from "../../../tournament/engines/publishDrawEngine.js";
import {
  canRegenerateSchedule,
  forceRepublishSchedule,
  getSchedulePublishStatus,
  lockSchedule,
  publishSchedule,
  recordScheduleCreated,
  reopenSchedule,
  resolveScheduleReopenPermission,
  SCHEDULE_PUBLISH_STATUS,
} from "../../../tournament/engines/publishScheduleEngine.js";
import {
  createPlatformEvent,
  createEventStore,
  createPlatformEventDispatcher,
  EVENT_TYPES,
} from "../../../core/platform/events/index.js";
import { appendWorkflowHistoryEntry, resetWorkflowHistory } from "./workflowHistory.js";

function buildActor(user) {
  if (!user) {
    return null;
  }
  return {
    id: user.id,
    email: user.email || "",
    name: user.displayName || user.name || "",
  };
}

function buildLogOptions(activeClubId, user, before, after, action) {
  const actor = buildActor(user);
  return {
    clubId: activeClubId,
    createdBy: actor?.email || actor?.id || null,
    actor,
    before,
    after,
    action,
  };
}

function mergeDrawSettings(tournament, drawSettingsPatch) {
  return {
    ...tournament,
    settings: {
      ...(tournament.settings || {}),
      draw: {
        ...(tournament.settings?.draw || {}),
        ...drawSettingsPatch,
      },
    },
  };
}

export function useTournamentEngineState(tournamentId) {
  const { activeClubId, players } = useClub();
  const { user, can, rbacEnabled } = useAuth();
  const runtime = usePlatformRuntime();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [engineState, setEngineState] = useState(null);
  const [workflowHistory, setWorkflowHistory] = useState([]);
  const [platformEvents, setPlatformEvents] = useState([]);
  const [platformNotifications, setPlatformNotifications] = useState([]);
  const [eventStore] = useState(() => createEventStore());
  const eventDispatcher = useMemo(
    () =>
      createPlatformEventDispatcher({
        auditService: runtime?.auditService,
        notificationService: runtime?.notificationService,
      }),
    [runtime?.auditService, runtime?.notificationService]
  );

  const hasReopenPermission = useMemo(
    () =>
      resolveDrawReopenPermission({
        canPermission: can,
        rbacEnabled,
        canIntervene: false,
      }) ||
      resolveScheduleReopenPermission({
        canPermission: can,
        rbacEnabled,
        canIntervene: false,
      }),
    [can, rbacEnabled]
  );

  const tournament = useMemo(
    () => (tournamentId ? getTournament(activeClubId, tournamentId) : null),
    [activeClubId, tournamentId, engineState]
  );

  const drawPublish = useMemo(
    () => getDrawPublishStatus(tournament),
    [tournament]
  );

  const schedulePublish = useMemo(
    () => getSchedulePublishStatus(tournament),
    [tournament]
  );

  const courts = useMemo(
    () => loadCourtsForClub(activeClubId).filter((c) => c.active !== false),
    [activeClubId]
  );

  useEffect(() => {
    if (tournament?.settings?.engineV4?.workflowHistory) {
      setWorkflowHistory(tournament.settings.engineV4.workflowHistory);
    }
  }, [tournament]);

  const context = useMemo(() => {
    if (!tournament) {
      return null;
    }
    const saved = tournament.settings?.engineV4 || {};
    return buildEngineContext({
      tournament,
      players,
      courts,
      engineState: engineState || saved,
    });
  }, [tournament, players, courts, engineState]);

  const persistEngineState = useCallback(
    (patch) => {
      if (!tournament) {
        return { ok: false, error: "Không tìm thấy giải." };
      }
      const merged = mergeEngineStateIntoSettings(tournament, {
        ...(tournament.settings?.engineV4 || {}),
        ...patch,
      });
      const result = updateTournament(activeClubId, tournamentId, {
        settings: merged.settings,
      });
      if (result.ok) {
        const nextEngineState = result.tournament.settings?.engineV4 || patch;
        setEngineState(nextEngineState);
        if (Array.isArray(nextEngineState.workflowHistory)) {
          setWorkflowHistory(nextEngineState.workflowHistory);
        }
      }
      return result;
    },
    [activeClubId, tournament, tournamentId]
  );

  const persistTournamentPatch = useCallback(
    (patch) => {
      if (!tournament) {
        return { ok: false, error: "Không tìm thấy giải." };
      }
      const result = updateTournament(activeClubId, tournamentId, patch);
      if (result.ok) {
        setEngineState(result.tournament.settings?.engineV4 || engineState);
      }
      return result;
    },
    [activeClubId, engineState, tournament, tournamentId]
  );

  const syncPlatformNotifications = useCallback(() => {
    const notifications = runtime?.notificationService?.list?.() || [];
    setPlatformNotifications(notifications);
    return notifications;
  }, [runtime?.notificationService]);

  const markNotificationAsRead = useCallback(
    (notificationId) => {
      const updated = runtime?.notificationService?.markAsRead?.(notificationId);
      if (updated) {
        syncPlatformNotifications();
      }
      return updated;
    },
    [runtime?.notificationService, syncPlatformNotifications]
  );

  const markAllNotificationsAsRead = useCallback(() => {
    const updated = runtime?.notificationService?.markAllAsRead?.();
    if (updated) {
      syncPlatformNotifications();
    }
    return updated;
  }, [runtime?.notificationService, syncPlatformNotifications]);

  const emitPlatformEvent = useCallback(
    (entry) => {
      const event = createPlatformEvent({
        type: EVENT_TYPES.WORKFLOW_STARTED,
        action: entry.action,
        entityType: "workflow",
        entityId: tournamentId || "tournament-workflow",
        metadata: {
          status: entry.status,
          detail: entry.detail,
          actor: entry.actor,
        },
        tenantId: activeClubId || null,
      });
      eventStore.add(event);
      eventDispatcher(event, { tenantId: activeClubId || null, notify: true });
      setPlatformEvents(eventStore.list());
      syncPlatformNotifications();
      return event;
    },
    [activeClubId, eventDispatcher, eventStore, syncPlatformNotifications, tournamentId]
  );

  const recordWorkflowHistory = useCallback(
    (entry) => {
      const nextHistory = appendWorkflowHistoryEntry(workflowHistory, entry);
      setWorkflowHistory(nextHistory);
      persistEngineState({ workflowHistory: nextHistory });
      emitPlatformEvent(entry);
    },
    [emitPlatformEvent, persistEngineState, workflowHistory]
  );

  const clearWorkflowHistory = useCallback(() => {
    const nextHistory = resetWorkflowHistory();
    setWorkflowHistory(nextHistory);
    persistEngineState({ workflowHistory: nextHistory });
  }, [persistEngineState]);

  const runWithLoading = useCallback(async (fn) => {
    setLoading(true);
    setError("");
    try {
      const result = fn();
      if (!result.ok) {
        setError((result.errors || []).join(" ") || result.error || "Engine thất bại.");
      }
      return result;
    } catch (err) {
      setError(err?.message || "Lỗi không xác định.");
      return { ok: false, errors: [err?.message] };
    } finally {
      setLoading(false);
    }
  }, []);

  const generateSeed = useCallback(async () => {
    if (!context || !tournament) {
      return { ok: false };
    }
    const regenCheck = canRegenerateDraw(tournament);
    if (!regenCheck.ok) {
      setError(regenCheck.error);
      return regenCheck;
    }

    return runWithLoading(() => {
      const beforeParticipants = context.participants || [];
      const result = runSeedEngine(
        context,
        buildLogOptions(activeClubId, user, { participants: beforeParticipants }, null, "seed")
      );
      if (result.ok) {
        persistEngineState({
          participants: result.data.participants,
          seedResult: result.data,
        });
        recordWorkflowHistory({
          action: "seed",
          status: "success",
          detail: `Generated ${result.data.participants.length} seed entries`,
          actor: buildActor(user),
          before: { participants: beforeParticipants.map((p) => p.id) },
          after: { participants: result.data.participants.map((p) => p.id) },
        });
      }
      return result;
    });
  }, [
    activeClubId,
    context,
    persistEngineState,
    recordWorkflowHistory,
    runWithLoading,
    tournament,
    user,
  ]);

  const generateDraw = useCallback(async () => {
    if (!context || !tournament) {
      return { ok: false };
    }
    const regenCheck = canRegenerateDraw(tournament);
    if (!regenCheck.ok) {
      setError(regenCheck.error);
      return regenCheck;
    }

    return runWithLoading(() => {
      const seedParticipants =
        engineState?.seedResult?.participants ||
        tournament.settings?.engineV4?.seedResult?.participants ||
        context.participants ||
        [];
      const drawContext = {
        ...context,
        participants: seedParticipants,
      };
      const beforeGroups = engineState?.groups || context.groups || [];
      const result = runDrawEngine(
        drawContext,
        buildLogOptions(
          activeClubId,
          user,
          { groups: summarizeGroups(beforeGroups) },
          null,
          "draw"
        )
      );
      if (result.ok) {
        const groups = result.data.groups;
        persistEngineState({
          groups,
          drawResult: result.data,
        });

        const created = recordDrawCreated(tournament, groups, {
          userId: user?.id,
          actor: buildActor(user),
          clubId: activeClubId,
          before: summarizeGroups(beforeGroups),
        });
        if (created.ok) {
          persistTournamentPatch({ settings: created.tournament.settings });
        }

        recordWorkflowHistory({
          action: "draw",
          status: "success",
          detail: `Generated ${groups.length} groups`,
          actor: buildActor(user),
          before: summarizeGroups(beforeGroups),
          after: summarizeGroups(groups),
        });
      }
      return result;
    });
  }, [
    activeClubId,
    context,
    engineState,
    persistEngineState,
    persistTournamentPatch,
    recordWorkflowHistory,
    runWithLoading,
    tournament,
    user,
  ]);

  const generateSchedule = useCallback(async (regenerate = false) => {
    if (!context) {
      return { ok: false };
    }
    if (tournament) {
      const editCheck = canRegenerateSchedule(tournament);
      if (!editCheck.ok) {
        return editCheck;
      }
    }
    return runWithLoading(() => {
      const scheduleContext = {
        ...context,
        participants:
          engineState?.seedResult?.participants ||
          tournament?.settings?.engineV4?.seedResult?.participants ||
          context.participants,
        groups: engineState?.groups || context.groups || [],
        matches: engineState?.matches || context.matches || [],
      };
      const beforeMatches = scheduleContext.matches || [];
      const result = runScheduleEngine(
        scheduleContext,
        { regenerate: Boolean(regenerate) },
        buildLogOptions(
          activeClubId,
          user,
          { matches: beforeMatches.length },
          null,
          "schedule"
        )
      );
      if (result.ok) {
        const recorded = tournament
          ? recordScheduleCreated(tournament, result.data.matches, {
              userId: user?.id,
              actor: buildActor(user),
              clubId: activeClubId,
              minRestMinutes: result.data.minRestMinutes,
              before: { matchCount: beforeMatches.length },
            })
          : null;
        if (recorded?.ok) {
          persistTournamentPatch({ settings: recorded.tournament.settings });
        }
        persistEngineState({
          matches: result.data.matches,
          scheduleResult: result.data,
        });
        recordWorkflowHistory({
          action: regenerate ? "schedule-regenerate" : "schedule",
          status: "success",
          detail: `Prepared ${result.data.matches.length} matches (minRest=${result.data.minRestMinutes})`,
          actor: buildActor(user),
          before: { matchCount: beforeMatches.length },
          after: { matchCount: result.data.matches.length },
        });
      }
      return result;
    });
  }, [
    activeClubId,
    context,
    engineState,
    persistEngineState,
    persistTournamentPatch,
    recordWorkflowHistory,
    runWithLoading,
    tournament,
    user,
  ]);

  const assignCourtsAuto = useCallback(async () => {
    if (!context) {
      return { ok: false };
    }
    return runWithLoading(() => {
      const courtContext = {
        ...context,
        matches: engineState?.matches || context.matches || [],
      };
      const result = runCourtAssignmentEngine(
        courtContext,
        {},
        buildLogOptions(
          activeClubId,
          user,
          { matchCount: courtContext.matches.length },
          null,
          "courts"
        )
      );
      if (result.ok) {
        persistEngineState({
          matches: result.data.matches,
          courtResult: result.data,
        });
        recordWorkflowHistory({
          action: "courts",
          status: "success",
          detail: `Assigned courts for ${result.data.matches.length} matches`,
          actor: buildActor(user),
        });
      }
      return result;
    });
  }, [
    activeClubId,
    context,
    engineState,
    persistEngineState,
    recordWorkflowHistory,
    runWithLoading,
    user,
  ]);

  const predictTime = useCallback(async () => {
    if (!context) {
      return { ok: false };
    }
    return runWithLoading(() => {
      const result = runTimePredictionEngine(
        context,
        buildLogOptions(activeClubId, user, null, null, "time")
      );
      if (result.ok) {
        persistEngineState({ timeResult: result.data });
      }
      return result;
    });
  }, [activeClubId, context, persistEngineState, runWithLoading, user]);

  const updateRanking = useCallback(async () => {
    if (!context) {
      return { ok: false };
    }
    return runWithLoading(() => {
      const rankingContext = {
        ...context,
        matches: engineState?.matches || context.matches || [],
      };
      const result = runRankingEngine(
        rankingContext,
        buildLogOptions(activeClubId, user, null, null, "ranking")
      );
      if (result.ok) {
        persistEngineState({ rankingResult: result.data });
        recordWorkflowHistory({
          action: "ranking",
          status: "success",
          detail: `Updated ranking for ${result.data.rankings?.length || 0} entries`,
          actor: buildActor(user),
        });
      }
      return result;
    });
  }, [
    activeClubId,
    context,
    engineState,
    persistEngineState,
    recordWorkflowHistory,
    runWithLoading,
    user,
  ]);

  const runFullPlan = useCallback(async () => {
    if (!context || !tournament) {
      return { ok: false };
    }
    const regenCheck = canRegenerateDraw(tournament);
    if (!regenCheck.ok) {
      setError(regenCheck.error);
      return regenCheck;
    }

    return runWithLoading(() => {
      const result = runFullTournamentPlan(
        context,
        buildLogOptions(activeClubId, user, null, null, "full-plan")
      );
      if (result.ok) {
        persistEngineState({
          participants: result.data.seed.participants,
          groups: result.data.draw.groups,
          matches: result.data.courts?.matches || result.data.schedule.matches,
          seedResult: result.data.seed,
          drawResult: result.data.draw,
          scheduleResult: result.data.schedule,
          courtResult: result.data.courts,
          timeResult: result.data.time,
          rankingResult: result.data.ranking,
        });

        const created = recordDrawCreated(tournament, result.data.draw.groups, {
          userId: user?.id,
          actor: buildActor(user),
          clubId: activeClubId,
        });
        if (created.ok) {
          persistTournamentPatch({ settings: created.tournament.settings });
        }

        recordWorkflowHistory({
          action: "full-plan",
          status: "success",
          detail: `Ran full tournament plan for ${context.participants?.length || 0} participants`,
          actor: buildActor(user),
        });
      }
      return result;
    });
  }, [
    activeClubId,
    context,
    persistEngineState,
    persistTournamentPatch,
    recordWorkflowHistory,
    runWithLoading,
    tournament,
    user,
  ]);

  const lockDrawPublish = useCallback(async () => {
    if (!tournament) {
      return { ok: false, error: "Không tìm thấy giải." };
    }
    const groups = engineState?.groups || context?.groups || [];
    return runWithLoading(() => {
      const result = lockDraw(tournament, groups, {
        userId: user?.id,
        actor: buildActor(user),
        clubId: activeClubId,
      });
      if (result.ok) {
        persistTournamentPatch({ settings: result.tournament.settings });
        recordWorkflowHistory({
          action: "draw-lock",
          status: "success",
          detail: `Locked draw with ${groups.length} groups`,
          actor: buildActor(user),
          after: summarizeGroups(groups),
        });
      }
      return result;
    });
  }, [
    activeClubId,
    context,
    engineState,
    persistTournamentPatch,
    recordWorkflowHistory,
    runWithLoading,
    tournament,
    user,
  ]);

  const publishDrawResult = useCallback(async () => {
    if (!tournament) {
      return { ok: false, error: "Không tìm thấy giải." };
    }
    const groups = engineState?.groups || context?.groups || [];
    return runWithLoading(() => {
      const result = publishDraw(tournament, groups, {
        userId: user?.id,
        actor: buildActor(user),
        clubId: activeClubId,
      });
      if (result.ok) {
        const applied = applyEnginePlanToEvent(result.tournament, {
          draw: { groups: result.snapshot || groups },
        });
        persistTournamentPatch({
          settings: result.tournament.settings,
          events: applied.ok ? applied.tournament.events : tournament.events,
        });
        recordWorkflowHistory({
          action: "draw-publish",
          status: "success",
          detail: `Published draw snapshot (${groups.length} groups)`,
          actor: buildActor(user),
          after: summarizeGroups(result.snapshot || groups),
        });
      }
      return result;
    });
  }, [
    activeClubId,
    context,
    engineState,
    persistTournamentPatch,
    recordWorkflowHistory,
    runWithLoading,
    tournament,
    user,
  ]);

  const reopenDrawPublish = useCallback(async () => {
    if (!tournament) {
      return { ok: false, error: "Không tìm thấy giải." };
    }
    return runWithLoading(() => {
      const result = reopenDraw(tournament, {
        userId: user?.id,
        actor: buildActor(user),
        clubId: activeClubId,
        hasReopenPermission,
      });
      if (result.ok) {
        persistTournamentPatch({ settings: result.tournament.settings });
        recordWorkflowHistory({
          action: "draw-reopen",
          status: "success",
          detail: "Reopened draw for editing",
          actor: buildActor(user),
        });
      }
      return result;
    });
  }, [
    activeClubId,
    hasReopenPermission,
    persistTournamentPatch,
    recordWorkflowHistory,
    runWithLoading,
    tournament,
    user,
  ]);

  const forceRedraw = useCallback(async () => {
    if (!tournament) {
      return { ok: false, error: "Không tìm thấy giải." };
    }
    return runWithLoading(() => {
      const result = forceRedrawDraw(tournament, {
        userId: user?.id,
        actor: buildActor(user),
        clubId: activeClubId,
        hasReopenPermission,
      });
      if (result.ok) {
        persistTournamentPatch({ settings: result.tournament.settings });
        recordWorkflowHistory({
          action: "draw-force-redraw",
          status: "success",
          detail: "Force redraw authorized after publish",
          actor: buildActor(user),
        });
      }
      return result;
    });
  }, [
    activeClubId,
    hasReopenPermission,
    persistTournamentPatch,
    recordWorkflowHistory,
    runWithLoading,
    tournament,
    user,
  ]);

  const lockSchedulePublish = useCallback(async () => {
    if (!tournament) {
      return { ok: false, error: "Không tìm thấy giải." };
    }
    const matches = engineState?.matches || context?.matches || [];
    return runWithLoading(() => {
      const result = lockSchedule(tournament, matches, {
        userId: user?.id,
        actor: buildActor(user),
        clubId: activeClubId,
      });
      if (result.ok) {
        persistTournamentPatch({ settings: result.tournament.settings });
        recordWorkflowHistory({
          action: "schedule-lock",
          status: "success",
          detail: `Locked schedule (${matches.length} matches)`,
          actor: buildActor(user),
        });
      }
      return result;
    });
  }, [
    activeClubId,
    context,
    engineState,
    persistTournamentPatch,
    recordWorkflowHistory,
    runWithLoading,
    tournament,
    user,
  ]);

  const publishScheduleResult = useCallback(async () => {
    if (!tournament) {
      return { ok: false, error: "Không tìm thấy giải." };
    }
    const matches = engineState?.matches || context?.matches || [];
    return runWithLoading(() => {
      const result = publishSchedule(tournament, matches, {
        userId: user?.id,
        actor: buildActor(user),
        clubId: activeClubId,
      });
      if (result.ok) {
        const applied = applyEnginePlanToEvent(result.tournament, {
          schedule: { matches: result.snapshot || matches },
        });
        persistTournamentPatch({
          settings: result.tournament.settings,
          events: applied.ok ? applied.tournament.events : tournament.events,
        });
        recordWorkflowHistory({
          action: "schedule-publish",
          status: "success",
          detail: `Published schedule snapshot (${matches.length} matches)`,
          actor: buildActor(user),
        });
      }
      return result;
    });
  }, [
    activeClubId,
    context,
    engineState,
    persistTournamentPatch,
    recordWorkflowHistory,
    runWithLoading,
    tournament,
    user,
  ]);

  const reopenSchedulePublish = useCallback(async () => {
    if (!tournament) {
      return { ok: false, error: "Không tìm thấy giải." };
    }
    return runWithLoading(() => {
      const result = reopenSchedule(tournament, {
        userId: user?.id,
        actor: buildActor(user),
        clubId: activeClubId,
        hasReopenPermission,
      });
      if (result.ok) {
        persistTournamentPatch({ settings: result.tournament.settings });
        recordWorkflowHistory({
          action: "schedule-reopen",
          status: "success",
          detail: "Reopened schedule for editing",
          actor: buildActor(user),
        });
      }
      return result;
    });
  }, [
    activeClubId,
    hasReopenPermission,
    persistTournamentPatch,
    recordWorkflowHistory,
    runWithLoading,
    tournament,
    user,
  ]);

  const forceRepublish = useCallback(async () => {
    if (!tournament) {
      return { ok: false, error: "Không tìm thấy giải." };
    }
    return runWithLoading(() => {
      const result = forceRepublishSchedule(tournament, {
        userId: user?.id,
        actor: buildActor(user),
        clubId: activeClubId,
        hasReopenPermission,
      });
      if (result.ok) {
        persistTournamentPatch({ settings: result.tournament.settings });
        recordWorkflowHistory({
          action: "schedule-force-publish",
          status: "success",
          detail: "Force republish after publish",
          actor: buildActor(user),
        });
      }
      return result;
    });
  }, [
    activeClubId,
    hasReopenPermission,
    persistTournamentPatch,
    recordWorkflowHistory,
    runWithLoading,
    tournament,
    user,
  ]);

  const updateScheduleMatches = useCallback(
    (matches) => {
      if (!tournament) {
        return { ok: false, error: "Không tìm thấy giải." };
      }
      const editCheck = canRegenerateSchedule(tournament);
      if (!editCheck.ok) {
        return editCheck;
      }
      persistEngineState({
        matches,
        scheduleResult: {
          ...(engineState?.scheduleResult || {}),
          matches,
        },
      });
      return { ok: true, matches };
    },
    [engineState, persistEngineState, tournament]
  );

  const applyToTournament = useCallback(async () => {
    if (!tournament) {
      return { ok: false, error: "Không tìm thấy giải." };
    }
    const state = tournament.settings?.engineV4 || engineState || {};
    const plan = {
      seed: state.seedResult,
      draw: state.drawResult,
      schedule: state.scheduleResult,
      courts: state.courtResult,
    };
    const applied = applyEnginePlanToEvent(tournament, plan);
    if (!applied.ok) {
      return applied;
    }
    return updateTournament(activeClubId, tournamentId, {
      events: applied.tournament.events,
      settings: applied.tournament.settings,
    });
  }, [activeClubId, tournament, tournamentId, engineState]);

  const saveConfig = useCallback(
    (configPatch) => {
      return persistEngineState(configPatch);
    },
    [persistEngineState]
  );

  return {
    tournament,
    context,
    courts,
    players,
    matches: context?.matches || [],
    loading,
    error,
    engineState: engineState || tournament?.settings?.engineV4 || {},
    drawPublish,
    schedulePublish,
    hasReopenPermission,
    workflowHistory,
    platformEvents,
    platformNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    generateSeed,
    generateDraw,
    generateSchedule,
    assignCourtsAuto,
    predictTime,
    updateRanking,
    runFullPlan,
    lockDrawPublish,
    publishDrawResult,
    reopenDrawPublish,
    forceRedraw,
    lockSchedulePublish,
    publishScheduleResult,
    reopenSchedulePublish,
    forceRepublish,
    updateScheduleMatches,
    applyToTournament,
    saveConfig,
    clearWorkflowHistory,
    DRAW_PUBLISH_STATUS,
    SCHEDULE_PUBLISH_STATUS,
  };
}

export { mergeDrawSettings, buildActor, buildLogOptions, summarizeGroups };
