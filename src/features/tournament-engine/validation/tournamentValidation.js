import { INELIGIBLE_SEED_STATUSES, PARTICIPANT_STATUS } from "../constants/defaults.js";

function uniquePlayerIds(participants = []) {
  const seen = new Set();
  const duplicates = [];

  participants.forEach((participant) => {
    (participant.playerIds || [participant.id]).forEach((playerId) => {
      const key = String(playerId);
      if (seen.has(key)) {
        duplicates.push(key);
      }
      seen.add(key);
    });
  });

  return duplicates;
}

export function validateSeedInput(context = {}) {
  const errors = [];
  const warnings = [];
  const participants = context.participants || [];

  if (participants.length === 0) {
    errors.push("Giải chưa có người chơi hoặc đội tham gia.");
  }

  const eligible = participants.filter(
    (p) => !INELIGIBLE_SEED_STATUSES.has(String(p.status || PARTICIPANT_STATUS.ACTIVE))
  );

  if (participants.length > 0 && eligible.length === 0) {
    errors.push("Không có VĐV/đội đủ điều kiện để xếp hạt giống.");
  }

  const duplicates = uniquePlayerIds(participants);
  if (duplicates.length > 0) {
    errors.push("Có người chơi trùng trong nhiều đội.");
  }

  participants.forEach((participant) => {
    const playerCount = (participant.playerIds || []).length;
    if (playerCount === 0 && !participant.id) {
      errors.push(`Đội "${participant.name || "?"}" thiếu thành viên.`);
    }
    if (!participant.elo && !participant.skillLevel) {
      warnings.push(`${participant.name || participant.id}: thiếu ELO và trình độ — dùng mặc định.`);
    }
  });

  return { ok: errors.length === 0, errors, warnings };
}

export function validateDrawInput(context = {}) {
  const errors = [];
  const warnings = [];
  const participants = (context.participants || []).filter(
    (p) => !INELIGIBLE_SEED_STATUSES.has(String(p.status || PARTICIPANT_STATUS.ACTIVE))
  );
  const groupCount = Math.max(1, Number(context.groupCount) || 2);

  if (participants.length < groupCount) {
    errors.push(`Cần ít nhất ${groupCount} đội/người chơi để chia ${groupCount} bảng.`);
  }

  if (participants.length < 2) {
    errors.push("Cần ít nhất 2 đội/người chơi để bốc thăm.");
  }

  const unseeded = participants.filter((p) => p.unseeded || !p.seed);
  if (unseeded.length === participants.length) {
    warnings.push("Chưa có hạt giống — draw sẽ dùng phân bổ cân bằng heuristic.");
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function validateScheduleInput(context = {}) {
  const errors = [];
  const warnings = [];
  const config = context.scheduleConfig || {};
  const courts = context.courts || [];
  const matches = context.matches || [];

  if (matches.length === 0) {
    errors.push("Chưa có trận đấu để lập lịch. Hãy chạy Bốc thăm trước.");
  }

  const availableCourts = courts.filter((court) => !court.locked);
  if (availableCourts.length === 0) {
    errors.push("Không có sân khả dụng (tất cả sân đang bị khóa).");
  }

  if (!config.startTime) {
    errors.push("Thiếu thời gian bắt đầu giải.");
  }

  if (!config.endTime) {
    warnings.push("Chưa cấu hình thời gian kết thúc — không kiểm tra vượt khung giờ.");
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function validateCourtAssignmentInput(context = {}) {
  const errors = [];
  const warnings = [];
  const courts = context.courts || [];
  const matches = (context.matches || []).filter(
    (match) => match.status !== "completed" && match.status !== "forfeit"
  );

  if (matches.length === 0) {
    errors.push("Không có trận cần gán sân.");
  }

  const availableCourts = courts.filter((court) => !court.locked);
  if (availableCourts.length === 0) {
    errors.push("Không có sân khả dụng.");
  }

  const lockedCount = courts.filter((court) => court.locked).length;
  if (lockedCount > 0) {
    warnings.push(`${lockedCount} sân đang bị khóa sẽ bỏ qua khi gán tự động.`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function validateRankingInput(context = {}) {
  const errors = [];
  const warnings = [];
  const groups = context.groups || [];
  const matches = context.matches || [];

  if (groups.length === 0 && matches.length === 0) {
    errors.push("Chưa có bảng hoặc trận đấu để xếp hạng.");
  }

  if (!context.rankingRules?.criteria?.length) {
    warnings.push("Chưa cấu hình rule ranking — dùng mặc định.");
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function validateEngineContext(context = {}, phase = "seed") {
  switch (phase) {
    case "seed":
      return validateSeedInput(context);
    case "draw":
      return validateDrawInput(context);
    case "schedule":
      return validateScheduleInput(context);
    case "court":
      return validateCourtAssignmentInput(context);
    case "ranking":
      return validateRankingInput(context);
    case "time":
      return { ok: true, errors: [], warnings: [] };
    default:
      return { ok: true, errors: [], warnings: [] };
  }
}
