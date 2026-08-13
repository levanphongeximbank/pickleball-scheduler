import { getTournamentQuery } from "../../../features/tournament/services/tournamentQueries.js";
import { updateTournamentCommand } from "../../../features/tournament/services/tournamentCommands.js";
import { TOURNAMENT_STATUS } from "../../../models/tournament/index.js";
import {
  assertInternalTournamentReadyForMutation,
  chainExpectedVersionFromResult,
  formatCanonicalVersionConflictError,
  resolveCanonicalExpectedVersion,
} from "../../../features/tournament/internal/canonicalTournamentCas.js";
import {
  buildInternalDrawEventWithoutMatches,
  buildInternalScheduleFromPersistedGroups,
  buildInternalTournamentPlan,
  canGenerateBracket,
  generateKnockoutBracket,
  resolveBracketProgress,
  suggestEntriesFromPlayers,
} from "../../../tournament/engines/index.js";
import { shouldSkipKnockoutForInternal } from "../../../features/tournament/internal/index.js";
import {
  ANIMATION_MODES,
  buildGroupMatchPairingSteps,
  buildPairingSteps,
  buildPairingWaitingPlayers,
  buildSnakeSteps,
  buildRandomDrawSteps,
} from "./animationUtils.js";
import { PAIRING_CONTROL_MODES } from "./pairing/usePairingSequence.js";

function buildKnockoutMatchMap(event) {
  const map = {};
  (event?.matches || []).forEach((match) => {
    if (match.bracketMatchId) {
      map[match.bracketMatchId] = match;
    }
  });
  return map;
}

function buildBracketRevealPayload(ctx, courts = []) {
  return {
    animationMode: ANIMATION_MODES.BRACKET_REVEAL,
    bracket: ctx.bracketProgress,
    event: ctx.bracketEvent,
    courts: ctx.courts || courts || [],
    knockoutMatchesByBracketId: buildKnockoutMatchMap(ctx.bracketEvent),
    autoStart: true,
  };
}

function buildPairingPayload({ entries, selectedPlayers, isSingleEvent }) {
  return {
    animationMode: ANIMATION_MODES.PAIRING_REVEAL,
    pairings: entries,
    steps: buildPairingSteps(entries),
    waitingPlayers: buildPairingWaitingPlayers(entries, selectedPlayers),
    title: isSingleEvent ? "Danh sách VĐV" : "Ghép cặp",
    subtitle: "Reveal từng cặp — danh sách chờ hiển thị từng VĐV",
    revealItemLabel: isSingleEvent ? "VĐV" : "Cặp",
    autoStart: true,
  };
}

function buildDrawPayload({ plan, selectedPlayers, groupCount }) {
  return {
    animationMode: ANIMATION_MODES.SNAKE_GROUP,
    groups: plan.event.groups,
    steps: buildSnakeSteps({
      entries: plan.event.entries,
      players: selectedPlayers,
      groupCount,
      finalGroups: plan.event.groups,
    }),
    matchCount: plan.matchCount,
    autoStart: true,
  };
}

function buildMatchPairingPayload({ plan, courts, tournamentName }) {
  const steps = buildGroupMatchPairingSteps({
    groups: plan.event.groups,
    matches: plan.event.matches,
    entries: plan.event.entries,
    courts,
  });

  return {
    animationMode: ANIMATION_MODES.GROUP_MATCH_PAIRING,
    tournamentName,
    groups: plan.event.groups,
    entries: plan.event.entries,
    steps,
    courts,
    autoStart: true,
    controlMode: PAIRING_CONTROL_MODES.AUTO,
    autoNextGroup: true,
  };
}

export function createInternalFlowAdapters(deps) {
  const {
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
    getPrivatePairingOptions,
    tournamentTenantId,
  } = deps;

  function resolvePrivatePairingOptions() {
    const prepared = typeof getPrivatePairingOptions === "function" ? getPrivatePairingOptions() : null;
    if (prepared?.ok === false) {
      return prepared;
    }
    return {
      ok: true,
      pairingOptions: prepared?.pairingOptions || {
        privatePairingRules: [],
        competitionClass: prepared?.pairingOptions?.competitionClass,
      },
    };
  }

  function getCachedSavedEvent() {
    return tournament?.events?.[0] || null;
  }

  function resolveTenantId(current) {
    return String(
      current?.tenantId || tournament?.tenantId || tournamentTenantId || ""
    ).trim();
  }

  async function fetchFreshTournament() {
    const tenantId = resolveTenantId(tournament);
    const scope = tenantId
      ? { id: tournamentClubId, clubId: tournamentClubId, tenantId }
      : tournamentClubId;
    const result = await getTournamentQuery(scope, tournamentId, tenantId ? { tenantId } : {});
    if (!result.ok) return null;
    return result.tournament || null;
  }

  async function fetchFreshSavedEvent() {
    const fresh = await fetchFreshTournament();
    return fresh?.events?.[0] || null;
  }

  async function persistDrawBeforeAnimation(ctx) {
    const plan = resolvePlan(ctx);
    if (!plan?.ok) {
      setError(plan?.errors?.[0] || "Không lập được kế hoạch chia bảng.");
      return false;
    }
    ctx.plan = plan;

    const draw = buildInternalDrawEventWithoutMatches(plan);
    if (!draw.ok) {
      setError(draw.error || "Không lưu được bảng đấu.");
      return false;
    }

    const fresh = await fetchFreshTournament();
    const current = fresh || tournament;
    if ((current?.events?.[0]?.groups || []).length > 0) {
      // Already durable — do not rewrite on presentation replay.
      ctx.persistedDraw = true;
      ctx.lastTournament = current;
      ctx.expectedVersion = resolveCanonicalExpectedVersion(current);
      return true;
    }

    const drafted = {
      ...current,
      events: [draw.event],
      status: TOURNAMENT_STATUS.READY,
      settings: {
        ...(current?.settings || {}),
        internal: {
          ...(current?.settings?.internal || {}),
          groupCount: (draw.event.groups || []).length,
          eventType: draw.event.eventType,
        },
      },
    };

    let settings = drafted.settings;
    try {
      const { recordDrawCreated } = await import(
        "../../../tournament/engines/publishDrawEngine.js"
      );
      const created = recordDrawCreated(drafted, draw.event.groups || [], {
        reason: "guided_draw_generated",
      });
      if (created?.ok) {
        settings = created.tournament.settings;
      }
    } catch {
      // Draw-created metadata is best-effort; groups still persist in one write.
    }

    const ready = assertInternalTournamentReadyForMutation(current);
    if (!ready.ok) {
      setError(formatCanonicalVersionConflictError(ready));
      return false;
    }

    const casScope = {
      id: tournamentClubId,
      clubId: tournamentClubId,
      tenantId: resolveTenantId(current),
    };
    const result = await updateTournamentCommand(
      casScope.tenantId ? casScope : tournamentClubId,
      tournamentId,
      {
        events: [draw.event],
        status: TOURNAMENT_STATUS.READY,
        settings,
      },
      {
        tenantId: casScope.tenantId || undefined,
        currentTournament: current,
        expectedVersion: ready.expectedVersion,
      }
    );

    if (!result.ok) {
      setError(formatCanonicalVersionConflictError(result) || result.error);
      return false;
    }

    ctx.persistedDraw = true;
    ctx.lastTournament = result.tournament;
    ctx.expectedVersion = chainExpectedVersionFromResult(result);
    setWarnings(draw.warnings || []);
    setLocalRevision((value) => value + 1);
    refreshClubs();
    return true;
  }

  async function persistScheduleBeforeAnimation(ctx) {
    const freshTournament = await fetchFreshTournament();
    const current = freshTournament || ctx.lastTournament || tournament;
    const savedEvent = current?.events?.[0];
    if ((savedEvent?.matches || []).some((match) => !match?.bracketMatchId)) {
      ctx.persistedSchedule = true;
      ctx.scheduleEvent = savedEvent;
      ctx.lastTournament = current;
      ctx.expectedVersion =
        ctx.expectedVersion ?? resolveCanonicalExpectedVersion(current);
      return true;
    }

    const prepared = resolvePrivatePairingOptions();
    const schedule = buildInternalScheduleFromPersistedGroups({
      tournament: current,
      players,
      pairingConstraints: [],
      privatePairingRules: prepared.pairingOptions?.privatePairingRules || [],
      clubId: tournamentClubId,
      competitionClass: prepared.pairingOptions?.competitionClass,
      envSource: prepared.pairingOptions?.envSource,
      seed: prepared.pairingOptions?.seed,
      allowedByPublishedRules: prepared.pairingOptions?.allowedByPublishedRules,
      contextTime: prepared.pairingOptions?.contextTime,
    });

    if (!schedule.ok) {
      setError(schedule.errors?.join(" ") || "Không tạo được lịch.");
      return false;
    }

    const chainedVersion =
      ctx.expectedVersion != null
        ? ctx.expectedVersion
        : assertInternalTournamentReadyForMutation(current).expectedVersion;
    if (chainedVersion == null) {
      setError(formatCanonicalVersionConflictError({
        ok: false,
        code: "VERSION_REQUIRED",
        reason: "missing_version",
      }));
      return false;
    }

    const casScope = {
      id: tournamentClubId,
      clubId: tournamentClubId,
      tenantId: resolveTenantId(current),
    };
    const result = await updateTournamentCommand(
      casScope.tenantId ? casScope : tournamentClubId,
      tournamentId,
      {
        events: [schedule.event],
        status: TOURNAMENT_STATUS.READY,
      },
      {
        tenantId: casScope.tenantId || undefined,
        currentTournament: current,
        expectedVersion: chainedVersion,
      }
    );

    if (!result.ok) {
      setError(formatCanonicalVersionConflictError(result) || result.error);
      return false;
    }

    ctx.lastTournament = result.tournament;
    ctx.expectedVersion = chainExpectedVersionFromResult(result);

    ctx.persistedSchedule = true;
    ctx.scheduleEvent = schedule.event;
    ctx.plan = {
      ok: true,
      event: schedule.event,
      matchCount: schedule.matchCount,
    };
    setWarnings(schedule.warnings || []);
    setLocalRevision((value) => value + 1);
    refreshClubs();
    return true;
  }

  function resolveEntries(ctx) {
    if (ctx.entries) {
      return ctx.entries;
    }
    const prepared = resolvePrivatePairingOptions();
    if (prepared.ok === false) {
      return [];
    }
    return suggestEntriesFromPlayers(
      players.filter((player) => selectedPlayerIds.includes(String(player.id))),
      eventType,
      {
        tournamentId,
        eventId: getCachedSavedEvent()?.id || `event-${tournamentId}`,
        ...(prepared.pairingOptions || {}),
      }
    );
  }

  function resolvePlan(ctx) {
    if (ctx.plan?.ok) {
      return ctx.plan;
    }

    const prepared = resolvePrivatePairingOptions();
    if (prepared.ok === false) {
      return {
        ok: false,
        errors: [
          prepared.error?.message || "Không lập được kế hoạch theo quy tắc riêng.",
        ],
        privatePairingError: prepared.error || null,
      };
    }

    const entries = resolveEntries(ctx);
    return buildInternalTournamentPlan({
      tournament,
      players,
      selectedPlayerIds,
      eventType,
      groupCount,
      manualEntries: entries,
      ...(prepared.pairingOptions || {}),
    });
  }

  function refreshBracketContext(ctx, savedEvent = getCachedSavedEvent()) {
    if (!savedEvent || !canGenerateBracket(savedEvent).ok) {
      ctx.includeBracket = false;
      return;
    }

    const generated = generateKnockoutBracket(savedEvent);
    if (!generated.ok) {
      ctx.includeBracket = false;
      ctx.bracketError = generated.errors?.join(" ");
      return;
    }

    ctx.bracketEvent = generated.event;
    ctx.bracketProgress = resolveBracketProgress(generated.event);
    ctx.bracketWarnings = generated.warnings || [];
    ctx.includeBracket = true;
  }

  return {
    validateStart(ctx) {
      const entries = resolveEntries(ctx);
      if (!entries.length) {
        return {
          ok: false,
          error: isSingleEvent
            ? "Không tạo được danh sách VĐV. Kiểm tra giới tính và số VĐV đã chọn."
            : "Không tạo được cặp nào. Kiểm tra giới tính và số VĐV đã chọn.",
        };
      }

      const plan = resolvePlan({ ...ctx, entries });
      if (!plan.ok) {
        return {
          ok: false,
          error:
            plan.privatePairingError?.message ||
            plan.errors?.join(" ") ||
            "Không lập được kế hoạch giải.",
        };
      }

      ctx.entries = entries;
      ctx.plan = plan;
      ctx.selectedPlayers = players.filter((player) =>
        selectedPlayerIds.includes(String(player.id))
      );
      ctx.includeBracket =
        !shouldSkipKnockoutForInternal(plan.event) && canGenerateBracket(plan.event).ok;
      ctx.courts = courts;

      return { ok: true };
    },

    async persistBeforeAnimation(animationMode, ctx) {
      switch (animationMode) {
        case ANIMATION_MODES.SNAKE_GROUP:
          return persistDrawBeforeAnimation(ctx);
        case ANIMATION_MODES.GROUP_MATCH_PAIRING:
          return persistScheduleBeforeAnimation(ctx);
        case ANIMATION_MODES.BRACKET_REVEAL: {
          const savedEvent = (await fetchFreshSavedEvent()) || getCachedSavedEvent();
          if (shouldSkipKnockoutForInternal(savedEvent)) {
            setError(
              "Giải có 1 bảng — kết thúc sau vòng bảng (không có vòng knock-out)."
            );
            return false;
          }
          refreshBracketContext(ctx, savedEvent);
          if (!ctx.bracketEvent) {
            // Nothing to persist — mark so animation completion cannot fall back to a write.
            ctx.persistedBracket = true;
            return true;
          }
          if (!(await persistEvent(ctx.bracketEvent))) {
            return false;
          }
          ctx.persistedBracket = true;
          return true;
        }
        default:
          return true;
      }
    },

    buildPayload(animationMode, ctx) {
      const plan = resolvePlan(ctx);
      const selectedPlayers = ctx.selectedPlayers || [];

      switch (animationMode) {
        case ANIMATION_MODES.PAIRING_REVEAL:
          return buildPairingPayload({
            entries: resolveEntries(ctx),
            selectedPlayers,
            isSingleEvent,
          });
        case ANIMATION_MODES.SNAKE_GROUP:
          return buildDrawPayload({ plan, selectedPlayers, groupCount });
        case ANIMATION_MODES.GROUP_MATCH_PAIRING: {
          const event = ctx.scheduleEvent || plan?.event;
          return buildMatchPairingPayload({
            plan: { ok: true, event, matchCount: (event?.matches || []).length },
            courts,
            tournamentName: tournament?.name || "Giải đấu",
          });
        }
        case ANIMATION_MODES.BRACKET_REVEAL:
          refreshBracketContext(ctx);
          return buildBracketRevealPayload(ctx, courts);
        default:
          return { animationMode };
      }
    },

    async persist(animationMode, ctx) {
      switch (animationMode) {
        case ANIMATION_MODES.PAIRING_REVEAL:
          setPreviewEntries(resolveEntries(ctx));
          return true;
        case ANIMATION_MODES.SNAKE_GROUP:
        case ANIMATION_MODES.GROUP_MATCH_PAIRING:
          return true;
        case ANIMATION_MODES.BRACKET_REVEAL: {
          // IT-REV-007: no post-animation durable write fallback.
          if (ctx.persistedBracket) return true;
          if (shouldSkipKnockoutForInternal(getCachedSavedEvent())) {
            return true;
          }
          setError(
            "Nhánh đấu chưa được lưu trước trình chiếu. Không ghi thêm sau animation."
          );
          return false;
        }
        default:
          return true;
      }
    },

    async afterPersist(animationMode, ctx) {
      if (animationMode === ANIMATION_MODES.GROUP_MATCH_PAIRING) {
        const savedEvent = (await fetchFreshSavedEvent()) || getCachedSavedEvent();
        refreshBracketContext(ctx, savedEvent);
      }
    },

    getHandoffSummary(animationMode, ctx) {
      const plan = resolvePlan(ctx);

      switch (animationMode) {
        case ANIMATION_MODES.PAIRING_REVEAL:
          return isSingleEvent
            ? `Đã đề xuất ${resolveEntries(ctx).length} VĐV.`
            : `Đã đề xuất ${resolveEntries(ctx).length} cặp/đội.`;
        case ANIMATION_MODES.SNAKE_GROUP:
          return `Đã chia ${plan.event?.groups?.length || 0} bảng (đã lưu). Tiếp theo: tạo lịch thi đấu.`;
        case ANIMATION_MODES.GROUP_MATCH_PAIRING:
          return `Đã lưu ${(ctx.scheduleEvent?.matches || plan?.event?.matches || []).filter((m) => !m.bracketMatchId).length} trận vòng bảng.`;
        case ANIMATION_MODES.BRACKET_REVEAL:
          return "Đã tạo sơ đồ knock-out.";
        default:
          return "Bước hoàn tất.";
      }
    },

    onFlowComplete(ctx) {
      const plan = resolvePlan(ctx);
      if (ctx.includeBracket && ctx.bracketEvent) {
        setMessage(`Hoàn tất trình chiếu — ${plan.matchCount} trận vòng bảng + sơ đồ knock-out.`);
        return;
      }

      setMessage(`Hoàn tất trình chiếu — ${plan.matchCount} trận vòng bảng.`);
    },
  };
}

export function createOfficialFlowAdapters(deps) {
  const {
    variant = "ai_balance",
    tournament,
    players,
    courts,
    selectedPlayerIds,
    eventType,
    groupCount,
    isAiBalance,
    displayEntries = [],
    buildPlan,
    buildPatch,
    persistTournament,
    persistEvent,
    setPreviewEntries,
    setWarnings,
    setMessage,
    setError,
    setLocalRevision,
    refreshClubs,
    suggestEntries,
    getSavedEvent,
  } = deps;

  function getFreshSavedEvent() {
    return getSavedEvent?.() || null;
  }

  function resolveEntries(ctx) {
    if (variant === "open") {
      return displayEntries;
    }

    if (ctx.entries?.length) {
      return ctx.entries;
    }

    return suggestEntries(
      players.filter((player) => selectedPlayerIds.includes(String(player.id))),
      eventType
    );
  }

  function resolvePlan(ctx) {
    if (ctx.plan?.ok) {
      return ctx.plan;
    }

    return buildPlan({
      manualEntries: resolveEntries(ctx),
    });
  }

  function refreshBracketContext(ctx) {
    const savedEvent = getFreshSavedEvent();
    if (!savedEvent || !canGenerateBracket(savedEvent).ok) {
      ctx.includeBracket = false;
      return;
    }

    const generated = generateKnockoutBracket(savedEvent);
    if (!generated.ok) {
      ctx.includeBracket = false;
      ctx.bracketError = generated.errors?.join(" ");
      return;
    }

    ctx.bracketEvent = generated.event;
    ctx.bracketProgress = resolveBracketProgress(generated.event);
    ctx.bracketWarnings = generated.warnings || [];
    ctx.includeBracket = true;
  }

  return {
    validateStart(ctx) {
      const entries = resolveEntries(ctx);
      if (variant === "open") {
        if (entries.length < 2) {
          return { ok: false, error: "Cần ít nhất 2 đội/VĐV đã đăng ký." };
        }
      } else if (!entries.length) {
        return { ok: false, error: "Không tạo được cặp/VĐV nào. Kiểm tra danh sách đã chọn." };
      }

      const plan = resolvePlan({ ...ctx, entries });
      if (!plan.ok) {
        return {
          ok: false,
          error:
            plan.privatePairingError?.message ||
            plan.errors?.join(" ") ||
            "Không lập được kế hoạch giải.",
        };
      }

      ctx.entries = entries;
      ctx.plan = plan;
      ctx.selectedPlayers =
        variant === "open"
          ? players
          : players.filter((player) => selectedPlayerIds.includes(String(player.id)));
      ctx.includeBracket = canGenerateBracket(plan.event).ok;
      ctx.courts = courts;

      return { ok: true };
    },

    buildPayload(animationMode, ctx) {
      const plan = resolvePlan(ctx);
      const selectedPlayers = ctx.selectedPlayers || [];

      switch (animationMode) {
        case ANIMATION_MODES.PAIRING_REVEAL:
          return {
            ...buildPairingPayload({
              entries: resolveEntries(ctx),
              selectedPlayers,
              isSingleEvent: false,
            }),
            title: isAiBalance ? "Ghép cặp AI Balance" : "Ghép cặp giải mở",
          };
        case ANIMATION_MODES.SNAKE_GROUP:
          return buildDrawPayload({ plan, selectedPlayers, groupCount });
        case ANIMATION_MODES.RANDOM_DRAW:
          return {
            animationMode: ANIMATION_MODES.RANDOM_DRAW,
            groups: plan.event.groups,
            steps: buildRandomDrawSteps(plan.event.groups),
            matchCount: plan.matchCount,
            autoStart: true,
          };
        case ANIMATION_MODES.GROUP_MATCH_PAIRING:
          return buildMatchPairingPayload({
            plan,
            courts,
            tournamentName: tournament?.name || "Giải đấu",
          });
        case ANIMATION_MODES.BRACKET_REVEAL:
          refreshBracketContext(ctx);
          return buildBracketRevealPayload(ctx, courts);
        default:
          return { animationMode };
      }
    },

    async persist(animationMode, ctx) {
      const plan = resolvePlan(ctx);

      switch (animationMode) {
        case ANIMATION_MODES.PAIRING_REVEAL: {
          const entries = resolveEntries(ctx);
          setPreviewEntries(entries);
          // Accepted AI pairs become durable on confirm (animation complete/skip).
          const savedEvent = getFreshSavedEvent();
          if (savedEvent) {
            const saved = await persistEvent({ ...savedEvent, entries });
            if (!saved) {
              return false;
            }
          } else if (persistTournament) {
            const { createOfficialEventRecord, upsertOfficialEvent } = await import(
              "../../../tournament/engines/officialTournamentEngine.js"
            );
            const event = createOfficialEventRecord(tournament, { eventType });
            const events = upsertOfficialEvent(tournament?.events || [], {
              ...event,
              entries,
            });
            const saved = await persistTournament({ events });
            if (!saved) {
              return false;
            }
          }
          return true;
        }
        case ANIMATION_MODES.SNAKE_GROUP:
        case ANIMATION_MODES.RANDOM_DRAW: {
          // Option A: draw may already be persisted before animation starts.
          const existing = getFreshSavedEvent();
          if (ctx.drawAlreadyPersisted || (existing?.matches?.length || 0) > 0) {
            setWarnings(plan.warnings || []);
            return true;
          }

          const patch = buildPatch(tournament, plan);
          if (!patch.ok) {
            setError(patch.error || "Không lưu được bảng đấu.");
            return false;
          }

          // Persist full entries + groups + matches (animation is presentation only).
          const saved = await persistTournament({ events: patch.events });
          if (!saved) {
            return false;
          }

          setWarnings(patch.warnings || []);
          setLocalRevision((value) => value + 1);
          refreshClubs();
          return true;
        }
        case ANIMATION_MODES.GROUP_MATCH_PAIRING: {
          const savedEvent = getFreshSavedEvent();
          if ((savedEvent?.matches?.length || 0) > 0) {
            return true;
          }

          const patch = buildPatch(tournament, plan);
          if (!patch.ok) {
            setError(patch.error || "Không lưu được lịch thi đấu.");
            return false;
          }

          const saved = await persistTournament({ events: patch.events });
          if (!saved) {
            return false;
          }

          setLocalRevision((value) => value + 1);
          refreshClubs();
          return true;
        }
        case ANIMATION_MODES.BRACKET_REVEAL: {
          refreshBracketContext(ctx);
          if (!ctx.bracketEvent) {
            setError(ctx.bracketError || "Không tạo được sơ đồ knock-out.");
            return false;
          }

          if (!(await persistEvent(ctx.bracketEvent))) {
            return false;
          }

          setWarnings(ctx.bracketWarnings || []);
          return true;
        }
        default:
          return true;
      }
    },

    afterPersist(animationMode, ctx) {
      if (animationMode === ANIMATION_MODES.GROUP_MATCH_PAIRING) {
        refreshBracketContext(ctx);
      }
    },

    getHandoffSummary(animationMode, ctx) {
      const plan = resolvePlan(ctx);

      switch (animationMode) {
        case ANIMATION_MODES.PAIRING_REVEAL:
          return `Đã đề xuất ${resolveEntries(ctx).length} cặp/đội.`;
        case ANIMATION_MODES.SNAKE_GROUP:
        case ANIMATION_MODES.RANDOM_DRAW:
          return variant === "open"
            ? `Đã chia ${plan.event.groups.length} bảng (bốc thăm).`
            : `Đã chia ${plan.event.groups.length} bảng.`;
        case ANIMATION_MODES.GROUP_MATCH_PAIRING:
          return `Đã ghép ${plan.matchCount} trận vòng bảng.`;
        case ANIMATION_MODES.BRACKET_REVEAL:
          return "Đã tạo sơ đồ knock-out.";
        default:
          return "Bước hoàn tất.";
      }
    },

    onFlowComplete(ctx) {
      const plan = resolvePlan(ctx);
      if (ctx.includeBracket && ctx.bracketEvent) {
        setMessage(`Hoàn tất trình chiếu — ${plan.matchCount} trận + sơ đồ knock-out.`);
        return;
      }

      setMessage(`Hoàn tất trình chiếu — ${plan.matchCount} trận vòng bảng.`);
    },
  };
}
