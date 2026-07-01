import { updateTournament } from "../../../domain/tournamentService.js";
import { writeAuditLog } from "../../identity/services/auditService.js";
import { buildEngineContext } from "../../tournament-engine/services/tournamentEngineAdapter.js";
import { guardAiAccess } from "../guards/aiAccessGuard.js";
import {
  AI_AUDIT_ACTIONS,
  AI_SUGGESTION_TYPE,
  GROUP_SUGGESTION_MODE,
  PAIRING_STRATEGY,
} from "../constants/aiConfig.js";
import { buildSeedSuggestion } from "../engines/seedSuggestion.js";
import { buildGroupSuggestion } from "../engines/groupSuggestion.js";
import { buildPairingSuggestion } from "../engines/pairingSuggestion.js";
import { buildTimePrediction } from "../engines/timePrediction.js";
import { validateSchedule } from "../engines/scheduleValidator.js";
import { buildRuleSuggestions } from "../engines/ruleSuggestion.js";
import { computeOverallAiScore } from "../scoring/aiScoring.js";
import { buildAiSummaryBullets } from "../explain/aiExplain.js";
import { explainWithProvider } from "../providers/aiProvider.js";
import {
  getSuggestionById,
  listSuggestions,
  saveSuggestion,
  updateSuggestionStatus,
  AI_SUGGESTION_STATUS,
} from "./aiSuggestionStorage.js";
import { teamToEntry } from "../../../tournament/engines/teamPairingEngine.js";

function wrapSuggestion(type, result, context, userId, tenantId) {
  if (!result.ok) {
    return result;
  }

  const record = saveSuggestion({
    tenantId,
    tournamentId: context.tournamentId,
    type,
    inputSnapshot: {
      participantCount: context.participants?.length,
      groupCount: context.groupCount,
      eventType: context.eventType,
    },
    outputPayload: result.data,
    confidence: result.confidence || "medium",
    createdBy: userId || "",
  });

  return {
    ok: true,
    suggestionId: record.id,
    data: result.data,
    warnings: result.warnings,
    confidence: result.confidence,
    expiresAt: record.expiresAt,
  };
}

function buildContextFromTournament(tournament, players, courts, options = {}) {
  return buildEngineContext({
    tournament,
    players,
    courts,
    ...options,
  });
}

export function generateSeedSuggestion(tournamentId, tenantId, options = {}) {
  const { clubId, players = [], courts = [] } = options;
  const guard = guardAiAccess({ clubId, tournamentId, tenantId });
  if (!guard.ok) {
    return guard;
  }

  const context = buildContextFromTournament(guard.tournament, players, courts);
  const result = buildSeedSuggestion(context);
  return wrapSuggestion(
    AI_SUGGESTION_TYPE.SEED,
    result,
    context,
    guard.user?.id,
    tenantId
  );
}

export function generatePairingSuggestion(
  tournamentId,
  tenantId,
  strategy = PAIRING_STRATEGY.BALANCED,
  options = {}
) {
  const { clubId, players = [], courts = [], partnerHistory = {} } = options;
  const guard = guardAiAccess({ clubId, tournamentId, tenantId });
  if (!guard.ok) {
    return guard;
  }

  const context = buildContextFromTournament(guard.tournament, players, courts);
  const result = buildPairingSuggestion(
    { ...context, players, partnerHistory },
    strategy
  );
  return wrapSuggestion(
    AI_SUGGESTION_TYPE.PAIRING,
    result,
    context,
    guard.user?.id,
    tenantId
  );
}

export function generateGroupSuggestion(
  tournamentId,
  tenantId,
  mode = GROUP_SUGGESTION_MODE.COMPETITIVE_BALANCED,
  options = {}
) {
  const { clubId, players = [], courts = [] } = options;
  const guard = guardAiAccess({ clubId, tournamentId, tenantId });
  if (!guard.ok) {
    return guard;
  }

  const context = buildContextFromTournament(guard.tournament, players, courts);
  const result = buildGroupSuggestion(context, mode);
  return wrapSuggestion(
    AI_SUGGESTION_TYPE.GROUP,
    result,
    context,
    guard.user?.id,
    tenantId
  );
}

export function predictTournamentTime(tournamentId, tenantId, options = {}) {
  const { clubId, players = [], courts = [] } = options;
  const guard = guardAiAccess({ clubId, tournamentId, tenantId });
  if (!guard.ok) {
    return guard;
  }

  const context = buildContextFromTournament(guard.tournament, players, courts);
  const result = buildTimePrediction(context);
  return wrapSuggestion(
    AI_SUGGESTION_TYPE.TIME_PREDICTION,
    result,
    context,
    guard.user?.id,
    tenantId
  );
}

export function validateTournamentSchedule(tournamentId, tenantId, options = {}) {
  const { clubId, players = [], courts = [] } = options;
  const guard = guardAiAccess({ clubId, tournamentId, tenantId });
  if (!guard.ok) {
    return guard;
  }

  const context = buildContextFromTournament(guard.tournament, players, courts);
  const result = validateSchedule(context);
  return wrapSuggestion(
    AI_SUGGESTION_TYPE.SCHEDULE_VALIDATION,
    result,
    context,
    guard.user?.id,
    tenantId
  );
}

export function generateRuleSuggestions(tournamentId, tenantId, options = {}) {
  const { clubId, players = [], courts = [] } = options;
  const guard = guardAiAccess({ clubId, tournamentId, tenantId });
  if (!guard.ok) {
    return guard;
  }

  const context = buildContextFromTournament(guard.tournament, players, courts);
  const result = buildRuleSuggestions(context);
  return wrapSuggestion(
    AI_SUGGESTION_TYPE.RULE_SUGGESTION,
    result,
    context,
    guard.user?.id,
    tenantId
  );
}

export async function getAiTournamentSummary(tournamentId, tenantId, options = {}) {
  const { clubId, players = [], courts = [] } = options;
  const guard = guardAiAccess({ clubId, tournamentId, tenantId });
  if (!guard.ok) {
    return guard;
  }

  const context = buildContextFromTournament(guard.tournament, players, courts);
  const groupResult = buildGroupSuggestion(context, GROUP_SUGGESTION_MODE.MANUAL_REVIEW);
  const timeResult = buildTimePrediction(context);
  const scheduleResult = validateSchedule(context);

  const balanceScore = groupResult.data?.overallBalanceScore ?? 70;
  const fairnessScore = groupResult.data?.fairnessScore ?? 70;
  const timeWarnings = timeResult.warnings || [];
  const scheduleIssues = scheduleResult.data?.issues || [];
  const participantCandidates = (players?.length ? players : context.participants?.length ? context.participants : []).filter(Boolean);
  const unknownPlayers = participantCandidates.filter(
    (p) => p.elo == null && p.skillLevel == null
  ).length;
  const hasCourtSchedule = Boolean(guard.tournament?.courtSchedule?.startTime && guard.tournament?.courtSchedule?.endTime);
  const tournamentStatus = String(guard.tournament?.status || "").toLowerCase();
  const eventStatuses = (guard.tournament?.events || []).map((event) => String(event.status || "").toLowerCase());
  const hasStarted = Boolean(
    tournamentStatus === "active" ||
    eventStatuses.some((status) => ["started", "in_progress", "live", "active", "playing", "ongoing", "running"].includes(status)) ||
    (guard.tournament?.events || []).some((event) => {
      const matches = Array.isArray(event.matches) ? event.matches : [];
      return matches.length > 0 || ["started", "in_progress", "completed"].includes(String(event.status || ""));
    })
  );
  const hasCompletedRound = Boolean(
    tournamentStatus === "completed" ||
    eventStatuses.some((status) => ["completed", "finished", "played", "done", "closed"].includes(status)) ||
    (guard.tournament?.events || []).some((event) => {
      const matches = Array.isArray(event.matches) ? event.matches : [];
      return matches.some((match) => ["completed", "finished", "played"].includes(String(match.status || "").toLowerCase()));
    })
  );
  const eventMatches = (guard.tournament?.events || []).flatMap((event) => Array.isArray(event.matches) ? event.matches : []);
  const normalizeMatchStatus = (status) => {
    const raw = String(status || "").trim().toLowerCase();
    const aliases = {
      in_progress: "active",
      inprogress: "active",
      active: "active",
      live: "active",
      started: "active",
      ongoing: "active",
      running: "active",
      playing: "active",
      completed: "completed",
      finished: "completed",
      played: "completed",
      done: "completed",
      closed: "completed",
      pending: "pending",
      waiting: "pending",
      scheduled: "pending",
      ready: "pending",
      postponed: "postponed",
      cancelled: "postponed",
      forfeit: "postponed",
    };
    return aliases[raw] || raw;
  };
  const completedMatches = eventMatches.filter((match) => normalizeMatchStatus(match.status) === "completed").length;
  const activeMatches = eventMatches.filter((match) => normalizeMatchStatus(match.status) === "active").length;
  const matchProgress = {
    totalMatches: eventMatches.length,
    completedMatches,
    activeMatches,
    percent: eventMatches.length > 0 ? Math.round((completedMatches / eventMatches.length) * 100) : 0,
    label: eventMatches.length > 0 ? `${completedMatches}/${eventMatches.length}` : "Chưa có trận",
  };

  const timeRisk = timeWarnings.length > 0 ? 25 : 0;
  const scheduleRisk =
    (scheduleResult.data?.summary?.critical || 0) * 15 +
    (scheduleResult.data?.summary?.warning || 0) * 5;

  const overallScore = computeOverallAiScore({
    balanceScore,
    fairnessScore,
    timeRisk,
    scheduleRisk,
    dataConfidence:
      unknownPlayers > context.participants.length * 0.3 ? "low" : "medium",
  });

  const bullets = buildAiSummaryBullets({
    balanceScore,
    timeWarnings,
    scheduleIssues,
    unknownPlayers,
  });

  const phase = hasCompletedRound ? "review" : hasStarted ? "live" : "setup";
  const phaseLabel = phase === "live"
    ? "Đang diễn ra"
    : phase === "review"
      ? "Đang xem lại"
      : "Chuẩn bị bắt đầu";
  const phaseHint = phase === "live"
    ? "Theo dõi tiến độ trận và điều chỉnh kịp thời nếu có chậm tiến độ."
    : phase === "review"
      ? "Đánh giá kết quả và chuẩn bị điều chỉnh cho vòng tiếp theo."
      : "Chuẩn bị dữ liệu, lịch sân và vận hành trước khi mở giải.";
  const nextActions = [
    phase === "setup"
      ? (unknownPlayers > 0
          ? "Bổ sung dữ liệu ELO hoặc skill level cho người chơi chưa rõ thông tin trước khi bắt đầu."
          : scheduleIssues.length > 0
            ? "Xem lại lịch sân và xung đột trước khi công bố." : "Đảm bảo lịch sân và dữ liệu người chơi đã sẵn sàng.")
      : phase === "live"
        ? (timeWarnings.length > 0
            ? "Rút ngắn luồng trận hoặc thêm khung nghỉ để giữ tiến độ đúng kế hoạch."
            : "Theo dõi thời gian thực tế và cập nhật nếu có trận chậm hoặc chồng lịch.")
        : (balanceScore < 70
            ? "Đánh giá lại cách chia bảng sau một số vòng để tăng công bằng cho vòng tiếp theo."
            : "Ghi nhận kết quả vòng vừa rồi và chuẩn bị điều chỉnh nếu cần thiết."),
    phase === "setup" && balanceScore < 70
      ? "Điều chỉnh cách chia bảng để tăng độ cân bằng trước khi bắt đầu."
      : phase === "live" && timeWarnings.length > 0
        ? "Giảm số vòng hoặc điều chỉnh thời gian nghỉ để giải vẫn đúng khung."
        : phase === "review" && balanceScore < 70
          ? "Đánh giá lại cấu trúc bảng sau vòng đầu để cải thiện vòng tiếp theo."
          : "Giữ cấu trúc hiện tại và theo dõi sát diễn biến giải.",
    phase === "setup"
      ? "Chuẩn bị kịch bản vận hành và kiểm tra lại các ràng buộc sân trước khi mở giải."
      : phase === "live"
        ? "Theo dõi lịch thi đấu và cập nhật nếu xuất hiện xung đột trong ngày."
        : "Đóng góp nhận xét sau mỗi vòng để chuẩn bị cho vòng tiếp theo.",
  ].filter(Boolean);
  const workflowChecklist = [
    {
      title: "Dữ liệu người chơi",
      description: unknownPlayers > 0
        ? "Bổ sung ELO hoặc skill level cho những người chơi chưa rõ trước khi bắt đầu giải."
        : "Dữ liệu người chơi đã đủ để vận hành tốt.",
      stage: "before",
      completed: unknownPlayers === 0,
      status: unknownPlayers === 0 ? "completed" : phase === "setup" ? "pending" : "active",
      recommended: phase === "setup" && unknownPlayers > 0,
      priority: unknownPlayers > 0 ? "high" : "medium",
    },
    {
      title: "Lịch sân và khung giờ",
      description: scheduleIssues.length > 0
        ? "Kiểm tra lại xung đột sân, thời gian nghỉ và khung kết thúc trước khi công bố."
        : "Lịch sân đang ổn và cần theo dõi trong ngày thi đấu.",
      stage: "before",
      completed: hasCourtSchedule && scheduleIssues.length === 0,
      status: hasCourtSchedule && scheduleIssues.length === 0 ? "completed" : phase === "setup" ? "pending" : "active",
      recommended: phase === "setup" && scheduleIssues.length > 0,
      priority: scheduleIssues.length > 0 ? "high" : "medium",
    },
    {
      title: "Bắt đầu giải",
      description: timeWarnings.length > 0
        ? "Điều chỉnh luồng trận hoặc giảm số vòng để kịp thời gian vận hành."
        : "Bắt đầu giải theo lịch đã đề xuất và ghi nhận tiến độ thực tế.",
      stage: "during",
      completed: hasStarted,
      status: hasStarted ? "completed" : phase === "live" ? "active" : "pending",
      recommended: phase === "live" && !hasStarted,
      priority: phase === "live" && !hasStarted ? "high" : "medium",
    },
    {
      title: "Sau mỗi vòng",
      description: "Đánh giá lại cân bằng bảng và cập nhật điều chỉnh nếu có bất thường.",
      stage: "after",
      completed: hasCompletedRound,
      status: hasCompletedRound ? "completed" : phase === "review" ? "active" : "pending",
      recommended: phase === "review" || (phase === "live" && hasStarted && balanceScore < 70),
      priority: phase === "review" ? "medium" : "low",
    },
  ];

  const fallbackExplanation = [
    `Điểm tổng thể ${overallScore}/100 cho giải đấu hiện tại.`,
    balanceScore >= 80
      ? "Cấu trúc bảng có xu hướng cân bằng tốt và phù hợp cho vòng bảng đầu tiên."
      : balanceScore >= 60
        ? "Cấu trúc bảng khá ổn, nhưng có một số nhóm cần xem lại để tăng công bằng."
        : "Cấu trúc bảng chưa thật sự cân bằng, nên cân nhắc điều chỉnh phân nhóm trước khi vận hành."
    ,
    timeWarnings.length > 0
      ? "Có cảnh báo về thời gian thi đấu và khung giờ diễn ra giải."
      : "Không phát hiện cảnh báo thời gian đáng kể ở mức hiện tại.",
    scheduleIssues.length > 0
      ? `Có ${scheduleIssues.length} vấn đề về lịch đấu cần kiểm tra trước khi công bố.`
      : "Lịch thi đấu hiện tại chưa có vấn đề nghiêm trọng cần xử lý.",
  ].join(" ");

  const providerResult = await explainWithProvider(
    {
      module: "summary",
      data: {
        scope: tenantId,
        score: overallScore,
        balanceScore,
        fairnessScore,
        timeRisk,
        scheduleRisk,
      },
      locale: "vi",
    },
    fallbackExplanation
  );

  return {
    ok: true,
    canApply: guard.canApply,
    viewOnly: guard.viewOnly,
    summary: {
      overallScore,
      balanceScore,
      fairnessScore,
      timeRisk,
      scheduleRisk,
      phase,
      phaseLabel,
      phaseHint,
      matchProgress,
      dataConfidence: unknownPlayers > 0 ? "medium" : "high",
      issueCounts: scheduleResult.data?.summary || { critical: 0, warning: 0, info: 0 },
      bullets,
      nextActions,
      workflowChecklist,
      explanation: providerResult.text || fallbackExplanation,
    },
  };
}

function applySeedSuggestion(tournament, payload) {
  const event = tournament.events?.[0];
  if (!event) {
    return { ok: false, error: "Giải chưa có nội dung." };
  }

  const seedMap = new Map((payload.seeds || []).map((s) => [s.playerId, s]));
  const entries = (event.entries || []).map((entry) => {
    const seed = seedMap.get(String(entry.id));
    if (!seed) {
      return entry;
    }
    return {
      ...entry,
      seed: seed.seedRank,
      seedScore: seed.aiScore / 100,
    };
  });

  const events = [...tournament.events];
  events[0] = { ...event, entries };
  return { ok: true, tournament: { ...tournament, events }, before: event.entries, after: entries };
}

function applyGroupSuggestion(tournament, payload) {
  const event = tournament.events?.[0];
  if (!event) {
    return { ok: false, error: "Giải chưa có nội dung." };
  }

  const rawGroups = payload.rawGroups;
  if (!rawGroups?.length) {
    return { ok: false, error: "Đề xuất không có dữ liệu bảng để áp dụng." };
  }

  const events = [...tournament.events];
  events[0] = { ...event, groups: rawGroups };
  return { ok: true, tournament: { ...tournament, events }, before: event.groups, after: rawGroups };
}

function applyPairingSuggestion(tournament, payload, players) {
  const event = tournament.events?.[0];
  if (!event) {
    return { ok: false, error: "Giải chưa có nội dung." };
  }

  const playerMap = new Map(players.map((p) => [String(p.id), p]));
  const entries = (payload.teams || []).map((team) => {
    const members = team.playerIds.map((id) => playerMap.get(String(id))).filter(Boolean);
    return teamToEntry(
      { id: team.teamId || team.playerIds.join("|"), name: members.map((m) => m.name).join(" / "), members },
      { tournamentId: tournament.id, eventId: event.id }
    );
  });

  const events = [...tournament.events];
  events[0] = { ...event, entries };
  return { ok: true, tournament: { ...tournament, events }, before: event.entries, after: entries };
}

export async function applyAiSuggestion(suggestionId, tenantId, userId, options = {}) {
  const { clubId, players = [] } = options;
  const guard = guardAiAccess({
    clubId,
    tournamentId: options.tournamentId,
    tenantId,
    requireApply: true,
  });
  if (!guard.ok) {
    return guard;
  }

  const suggestion = getSuggestionById(suggestionId, tenantId);
  if (!suggestion) {
    return { ok: false, error: "Không tìm thấy đề xuất AI.", code: "NOT_FOUND" };
  }

  if (suggestion.tenantId !== String(tenantId)) {
    return { ok: false, error: "Đề xuất không thuộc tenant hiện tại.", code: "FORBIDDEN" };
  }

  if (suggestion.status === AI_SUGGESTION_STATUS.EXPIRED) {
    return { ok: false, error: "Đề xuất AI đã hết hạn.", code: "EXPIRED" };
  }

  if (suggestion.status !== AI_SUGGESTION_STATUS.PENDING) {
    return { ok: false, error: `Đề xuất đã "${suggestion.status}".`, code: "INVALID_STATUS" };
  }

  let applyResult;
  const payload = suggestion.outputPayload;

  switch (suggestion.type) {
    case AI_SUGGESTION_TYPE.SEED:
      applyResult = applySeedSuggestion(guard.tournament, payload);
      break;
    case AI_SUGGESTION_TYPE.GROUP:
      applyResult = applyGroupSuggestion(guard.tournament, payload);
      break;
    case AI_SUGGESTION_TYPE.PAIRING:
      applyResult = applyPairingSuggestion(guard.tournament, payload, players);
      break;
  default:
      return {
        ok: false,
        error: `Loại đề xuất "${suggestion.type}" không hỗ trợ apply tự động.`,
        code: "NOT_APPLICABLE",
      };
  }

  if (!applyResult.ok) {
    return applyResult;
  }

  const updateResult = updateTournament(clubId, guard.tournament.id, applyResult.tournament);
  if (!updateResult.ok) {
    return updateResult;
  }

  updateSuggestionStatus(suggestionId, tenantId, {
    status: AI_SUGGESTION_STATUS.APPLIED,
    appliedBy: userId,
    appliedAt: new Date().toISOString(),
  });

  await writeAuditLog({
    action: AI_AUDIT_ACTIONS.APPLIED,
    resourceType: "ai_suggestion",
    resourceId: suggestionId,
    clubId,
    venueId: tenantId,
    metadata: {
      tenantId,
      tournamentId: suggestion.tournamentId,
      suggestionId,
      suggestionType: suggestion.type,
      userId,
      before: applyResult.before,
      after: applyResult.after,
    },
  });

  return { ok: true, tournament: updateResult.tournament, suggestionId };
}

export async function dismissAiSuggestion(suggestionId, tenantId, userId, options = {}) {
  const { clubId, tournamentId } = options;
  const guard = guardAiAccess({ clubId, tournamentId, tenantId, requireApply: true });
  if (!guard.ok) {
    return guard;
  }

  const suggestion = getSuggestionById(suggestionId, tenantId);
  if (!suggestion) {
    return { ok: false, error: "Không tìm thấy đề xuất AI." };
  }

  const statusResult = updateSuggestionStatus(suggestionId, tenantId, {
    status: AI_SUGGESTION_STATUS.DISMISSED,
    dismissedBy: userId,
    dismissedAt: new Date().toISOString(),
  });

  if (!statusResult.ok) {
    return statusResult;
  }

  await writeAuditLog({
    action: AI_AUDIT_ACTIONS.DISMISSED,
    resourceType: "ai_suggestion",
    resourceId: suggestionId,
    clubId,
    venueId: tenantId,
    metadata: {
      tenantId,
      tournamentId: suggestion.tournamentId,
      suggestionId,
      suggestionType: suggestion.type,
      userId,
    },
  });

  return { ok: true, suggestionId };
}

export function listAiSuggestions(tournamentId, tenantId, filters = {}) {
  const guard = guardAiAccess({
    clubId: filters.clubId,
    tournamentId,
    tenantId,
  });
  if (!guard.ok) {
    return guard;
  }
  return { ok: true, suggestions: listSuggestions(tournamentId, tenantId, filters) };
}
