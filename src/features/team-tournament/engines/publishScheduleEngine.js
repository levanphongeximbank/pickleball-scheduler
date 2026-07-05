import { MATCHUP_STATUS } from "../constants.js";
import { normalizeTeamData } from "../models/index.js";

export const SCHEDULE_PUBLISH_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  LOCKED: "locked",
};

const EDITABLE_STATUSES = new Set([
  SCHEDULE_PUBLISH_STATUS.DRAFT,
  SCHEDULE_PUBLISH_STATUS.PUBLISHED,
]);

function patchSettings(teamData, patch) {
  return normalizeTeamData({
    ...teamData,
    settings: {
      ...teamData.settings,
      ...patch,
    },
  });
}

export function normalizeSchedulePublish(state = {}) {
  const status = Object.values(SCHEDULE_PUBLISH_STATUS).includes(state.status)
    ? state.status
    : SCHEDULE_PUBLISH_STATUS.DRAFT;

  return {
    status,
    publishedAt: state.publishedAt || null,
    lockedAt: state.lockedAt || null,
    publishedBy: state.publishedBy ? String(state.publishedBy).trim() : "",
    lockedBy: state.lockedBy ? String(state.lockedBy).trim() : "",
  };
}

export function getSchedulePublishStatus(teamData) {
  return normalizeSchedulePublish(teamData?.settings?.schedulePublish || {});
}

export function canEditSchedule(teamData) {
  const publish = getSchedulePublishStatus(teamData);
  return EDITABLE_STATUSES.has(publish.status);
}

export function canPublishSchedule(teamData) {
  const publish = getSchedulePublishStatus(teamData);
  if (publish.status === SCHEDULE_PUBLISH_STATUS.LOCKED) {
    return { ok: false, error: "Lịch đã khóa, không thể công bố lại." };
  }

  const matchups = teamData?.matchups || [];
  if (matchups.length === 0) {
    return { ok: false, error: "Chưa có lượt đối đầu để công bố lịch." };
  }

  const unscheduled = matchups.filter((matchup) => !matchup.scheduledAt);
  if (unscheduled.length > 0) {
    return {
      ok: false,
      error: `Còn ${unscheduled.length} lượt chưa có thời gian thi đấu.`,
    };
  }

  return { ok: true };
}

export function publishSchedule(teamData, options = {}) {
  const validation = canPublishSchedule(teamData);
  if (!validation.ok) {
    return validation;
  }

  const now = options.now || new Date().toISOString();
  const publish = normalizeSchedulePublish({
    status: SCHEDULE_PUBLISH_STATUS.PUBLISHED,
    publishedAt: now,
    publishedBy: options.userId || options.publishedBy || "",
    lockedAt: null,
    lockedBy: "",
  });

  const nextMatchups = (teamData.matchups || []).map((matchup) => {
    if (matchup.status === MATCHUP_STATUS.SCHEDULED) {
      return { ...matchup, status: MATCHUP_STATUS.LINEUP_OPEN };
    }
    return matchup;
  });

  const nextData = patchSettings(
    normalizeTeamData({ ...teamData, matchups: nextMatchups }),
    { schedulePublish: publish }
  );

  return {
    ok: true,
    teamData: nextData,
    schedulePublish: publish,
  };
}

export function lockPublishedSchedule(teamData, options = {}) {
  const publish = getSchedulePublishStatus(teamData);
  if (publish.status !== SCHEDULE_PUBLISH_STATUS.PUBLISHED) {
    return { ok: false, error: "Chỉ khóa lịch đã công bố." };
  }

  const now = options.now || new Date().toISOString();
  const locked = normalizeSchedulePublish({
    ...publish,
    status: SCHEDULE_PUBLISH_STATUS.LOCKED,
    lockedAt: now,
    lockedBy: options.userId || options.lockedBy || "",
  });

  return {
    ok: true,
    teamData: patchSettings(teamData, { schedulePublish: locked }),
    schedulePublish: locked,
  };
}

export function unlockSchedule(teamData, options = {}) {
  const publish = getSchedulePublishStatus(teamData);
  if (publish.status !== SCHEDULE_PUBLISH_STATUS.LOCKED) {
    return { ok: false, error: "Lịch chưa ở trạng thái khóa." };
  }

  const next = normalizeSchedulePublish({
    status: SCHEDULE_PUBLISH_STATUS.PUBLISHED,
    publishedAt: publish.publishedAt,
    publishedBy: publish.publishedBy,
    lockedAt: null,
    lockedBy: "",
  });

  return {
    ok: true,
    teamData: patchSettings(teamData, { schedulePublish: next }),
    schedulePublish: next,
  };
}

export function isScheduleLocked(teamData) {
  return getSchedulePublishStatus(teamData).status === SCHEDULE_PUBLISH_STATUS.LOCKED;
}
