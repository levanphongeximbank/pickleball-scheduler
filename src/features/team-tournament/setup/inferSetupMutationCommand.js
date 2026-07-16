import { stableCanonicalStringify } from "../canonical/teamTournamentCanonical.js";

const SCHEDULE_MATCHUP_FIELDS = new Set([
  "scheduledAt",
  "lineupLockAt",
  "courtLabel",
  "scheduleMeta",
  "groupId",
  "roundNumber",
  "matchNumberInRound",
  "stage",
  "nextMatchupId",
]);

function list(value) {
  return Array.isArray(value) ? value : [];
}

function same(left, right) {
  return stableCanonicalStringify(left) === stableCanonicalStringify(right);
}

function withoutSchedule(matchup = {}) {
  return Object.fromEntries(
    Object.entries(matchup).filter(([key]) => !SCHEDULE_MATCHUP_FIELDS.has(key))
  );
}

function scheduleEntries(matchups) {
  return list(matchups).map((matchup) => ({
    matchupId: matchup.id,
    scheduledAt: matchup.scheduledAt ?? null,
    lineupLockAt: matchup.lineupLockAt ?? null,
    courtLabel: matchup.courtLabel ?? null,
    groupId: matchup.groupId ?? matchup.scheduleMeta?.groupId ?? null,
    roundNumber: matchup.roundNumber ?? matchup.scheduleMeta?.roundNumber ?? null,
    matchNumberInRound:
      matchup.matchNumberInRound ?? matchup.scheduleMeta?.matchNumberInRound ?? null,
    stage: matchup.stage ?? matchup.scheduleMeta?.stage ?? null,
  }));
}

function changedDiscipline(previous, next) {
  const before = list(previous.disciplines);
  const after = list(next.disciplines);
  const beforeById = new Map(before.map((item) => [String(item.id), item]));
  const afterById = new Map(after.map((item) => [String(item.id), item]));
  const removed = before.filter((item) => !afterById.has(String(item.id)));
  const addedOrUpdated = after.filter(
    (item) => !beforeById.has(String(item.id)) || !same(beforeById.get(String(item.id)), item)
  );
  const idsSame =
    before.length === after.length &&
    before.every((item) => afterById.has(String(item.id)));
  const onlyOrderChanged =
    idsSame &&
    before.every((item) => {
      const candidate = afterById.get(String(item.id));
      const beforeRest = { ...item };
      const afterRest = { ...candidate };
      delete beforeRest.sortOrder;
      delete afterRest.sortOrder;
      return same(beforeRest, afterRest);
    }) &&
    !same(before, after);

  return { before, after, removed, addedOrUpdated, onlyOrderChanged };
}

/**
 * Infer the single P1.3 setup command that best represents a full UI state diff.
 * P1.3 supports one domain command per mutation, so mixed changes prioritize the
 * largest persisted domain: matchups, schedule, groups, then disciplines.
 */
export function buildSetupMutationFromTeamDataDiff({
  previous = {},
  next = {},
  tournamentId,
  expectedTournamentVersion,
  rulesVersion = "",
} = {}) {
  const beforeMatchups = list(previous.matchups);
  const afterMatchups = list(next.matchups);
  const matchupsStructuralChanged = !same(
    beforeMatchups.map(withoutSchedule),
    afterMatchups.map(withoutSchedule)
  );
  const scheduleChanged =
    !same(scheduleEntries(beforeMatchups), scheduleEntries(afterMatchups)) ||
    !same(previous.schedulePublish || {}, next.schedulePublish || {});
  const groupsChanged = !same(list(previous.groups), list(next.groups));
  const disciplines = changedDiscipline(previous, next);
  const disciplinesChanged = !same(disciplines.before, disciplines.after);

  let commandName;
  let payload;
  let confirmDestructive = false;

  if (matchupsStructuralChanged) {
    commandName = "matchups.replace";
    payload = { matchups: afterMatchups };
    confirmDestructive = beforeMatchups.length > 0;
  } else if (scheduleChanged) {
    const schedulePublishChanged = !same(
      previous.schedulePublish || {},
      next.schedulePublish || {}
    );
    const status = next.schedulePublish?.status;
    if (schedulePublishChanged && status === "locked") {
      commandName = "schedule.lock";
      payload = { schedulePublish: next.schedulePublish || {} };
      confirmDestructive = true;
    } else if (schedulePublishChanged && status === "published") {
      commandName = "schedule.publish";
      payload = { schedulePublish: next.schedulePublish || {} };
    } else {
      const entries = scheduleEntries(afterMatchups);
      commandName = entries.length === 1 ? "schedule.update" : "schedule.batch";
      payload =
        commandName === "schedule.update"
          ? { scheduleEntry: entries[0] || null }
          : { schedule: entries };
    }
  } else if (groupsChanged) {
    commandName = list(next.groups).length === 0 && list(previous.groups).length > 0
      ? "groups.clear"
      : "groups.replace";
    payload = commandName === "groups.clear" ? {} : { groups: list(next.groups) };
    confirmDestructive = commandName === "groups.clear";
  } else if (disciplinesChanged) {
    if (disciplines.removed.length === 1 && disciplines.addedOrUpdated.length === 0) {
      commandName = "discipline.remove";
      payload = { disciplineId: disciplines.removed[0].id };
      confirmDestructive = true;
    } else if (disciplines.onlyOrderChanged) {
      commandName = "discipline.reorder";
      payload = {
        orderedIds: disciplines.after.map((item) => item.id),
        disciplines: disciplines.after,
      };
    } else {
      commandName = "discipline.save";
      payload = { discipline: disciplines.addedOrUpdated[0] || disciplines.after[0] || null };
    }
  } else {
    return {
      commandName: null,
      payload: {},
      engineInput: { previous, next },
      engineOutput: {},
      confirmDestructive: false,
      rulesVersion,
      error: "NO_PERSISTED_SETUP_DOMAIN_CHANGE",
    };
  }

  return {
    commandName,
    payload,
    engineInput: { previous, next, tournamentId, expectedTournamentVersion },
    engineOutput: { commandName, payload },
    confirmDestructive,
    rulesVersion,
  };
}
