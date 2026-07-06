import {
  advanceTournamentStatus,
  getTournament,
} from "../../../domain/tournamentService.js";
import { TOURNAMENT_STATUS } from "../../../models/tournament/index.js";
import {
  buildInternalTournamentPatch,
  buildInternalTournamentPlan,
  canGenerateBracket,
  generateKnockoutBracket,
  resolveBracketProgress,
  suggestEntriesFromPlayers,
} from "../../../tournament/engines/index.js";
import {
  ANIMATION_MODES,
  buildGroupMatchPairingSteps,
  buildPairingSteps,
  buildPairingWaitingPlayers,
  buildSnakeSteps,
  stripMatchesFromEvent,
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
  } = deps;

  function getFreshSavedEvent() {
    return getTournament(tournamentClubId, tournamentId)?.events?.[0] || null;
  }

  function resolveEntries(ctx) {
    return (
      ctx.entries ||
      suggestEntriesFromPlayers(
        players.filter((player) => selectedPlayerIds.includes(String(player.id))),
        eventType,
        {
          tournamentId,
          eventId: getFreshSavedEvent()?.id || `event-${tournamentId}`,
        }
      )
    );
  }

  function resolvePlan(ctx) {
    if (ctx.plan?.ok) {
      return ctx.plan;
    }

    const entries = resolveEntries(ctx);
    return buildInternalTournamentPlan({
      tournament,
      players,
      selectedPlayerIds,
      eventType,
      groupCount,
      manualEntries: entries,
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
        return { ok: false, error: plan.errors?.join(" ") || "Không lập được kế hoạch giải." };
      }

      ctx.entries = entries;
      ctx.plan = plan;
      ctx.selectedPlayers = players.filter((player) =>
        selectedPlayerIds.includes(String(player.id))
      );
      ctx.includeBracket = canGenerateBracket(plan.event).ok;
      ctx.courts = courts;

      return { ok: true };
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

    persist(animationMode, ctx) {
      const plan = resolvePlan(ctx);

      switch (animationMode) {
        case ANIMATION_MODES.PAIRING_REVEAL:
          setPreviewEntries(resolveEntries(ctx));
          return true;
        case ANIMATION_MODES.SNAKE_GROUP: {
          const patch = buildInternalTournamentPatch(tournament, plan);
          if (!patch.ok) {
            setError(patch.error || "Không lưu được bảng đấu.");
            return false;
          }

          const eventWithoutMatches = stripMatchesFromEvent(patch.events[0]);
          const result = advanceTournamentStatus(
            tournamentClubId,
            tournamentId,
            TOURNAMENT_STATUS.READY,
            { events: [eventWithoutMatches] }
          );

          if (!result.ok) {
            setError(result.error);
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

          const patch = buildInternalTournamentPatch(tournament, plan);
          if (!patch.ok) {
            setError(patch.error || "Không lưu được lịch thi đấu.");
            return false;
          }

          const result = advanceTournamentStatus(
            tournamentClubId,
            tournamentId,
            TOURNAMENT_STATUS.READY,
            { events: patch.events }
          );

          if (!result.ok) {
            setError(result.error);
            return false;
          }

          setWarnings(patch.warnings || []);
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

          if (!persistEvent(ctx.bracketEvent)) {
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
          return isSingleEvent
            ? `Đã đề xuất ${resolveEntries(ctx).length} VĐV.`
            : `Đã đề xuất ${resolveEntries(ctx).length} cặp/đội.`;
        case ANIMATION_MODES.SNAKE_GROUP:
          return `Đã chia ${plan.event.groups.length} bảng với ${plan.matchCount} trận vòng bảng.`;
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
        return { ok: false, error: plan.errors?.join(" ") || "Không lập được kế hoạch giải." };
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

    persist(animationMode, ctx) {
      const plan = resolvePlan(ctx);

      switch (animationMode) {
        case ANIMATION_MODES.PAIRING_REVEAL:
          setPreviewEntries(resolveEntries(ctx));
          return true;
        case ANIMATION_MODES.SNAKE_GROUP:
        case ANIMATION_MODES.RANDOM_DRAW: {
          const patch = buildPatch(tournament, plan);
          if (!patch.ok) {
            setError(patch.error || "Không lưu được bảng đấu.");
            return false;
          }

          const events = patch.events.map((event) =>
            String(event.id) === String(patch.event?.id) ? stripMatchesFromEvent(event) : event
          );

          const saved = persistTournament({ events });
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

          const saved = persistTournament({ events: patch.events });
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

          if (!persistEvent(ctx.bracketEvent)) {
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
