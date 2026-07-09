import { assignEntriesToGroupsSnake } from "../../../tournament/engines/seededGroupEngine.js";
import { evaluateGroupConstraints, getEntryPlayerIds } from "./constraintEvaluator.js";

function cloneGroups(groups = []) {
  return groups.map((group) => ({
    ...group,
    entryIds: [...(group.entryIds || [])],
    entries: [...(group.entries || [])],
  }));
}

function findGroupIndexByEntry(groups, entryId) {
  return groups.findIndex((group) =>
    (group.entryIds || []).some((id) => String(id) === String(entryId))
  );
}

function findEntryContainingPlayer(entries, playerId) {
  return entries.find((entry) => getEntryPlayerIds(entry).includes(String(playerId)));
}

function swapEntriesBetweenGroups(groups, entries, entryIdA, groupIndexA, entryIdB, groupIndexB) {
  const next = cloneGroups(groups);
  const groupA = next[groupIndexA];
  const groupB = next[groupIndexB];
  if (!groupA || !groupB) {
    return null;
  }

  const slotA = groupA.entryIds.findIndex((id) => String(id) === String(entryIdA));
  const slotB = groupB.entryIds.findIndex((id) => String(id) === String(entryIdB));
  if (slotA < 0 || slotB < 0) {
    return null;
  }

  groupA.entryIds[slotA] = String(entryIdB);
  groupB.entryIds[slotB] = String(entryIdA);

  return syncGroupEntries(next, entries);
}

function syncGroupEntries(groups, entries) {
  const entryMap = new Map(entries.map((entry) => [String(entry.id), entry]));
  return groups.map((group) => {
    const groupEntries = (group.entryIds || [])
      .map((id) => entryMap.get(String(id)))
      .filter(Boolean);
    return {
      ...group,
      entries: groupEntries,
      entryIds: groupEntries.map((entry) => entry.id),
    };
  });
}

function tryResolveGroupConflicts(groups, entries, constraints) {
  let working = syncGroupEntries(groups, entries);
  let evaluation = evaluateGroupConstraints(working, constraints);
  const maxPasses = 40;

  for (let pass = 0; pass < maxPasses && !evaluation.ok; pass += 1) {
    const violation = evaluation.hardViolations[0];
    if (!violation) {
      break;
    }

    const anchorEntry = findEntryContainingPlayer(entries, violation.constraint.anchorPlayerId);
    const targetId = violation.constraint.targetPlayerIds.find((playerId) => {
      const entry = findEntryContainingPlayer(entries, playerId);
      if (!entry) {
        return false;
      }
      const group = working.find((item) => (item.entryIds || []).includes(entry.id));
      const anchorGroup = working.find((item) =>
        anchorEntry ? (item.entryIds || []).includes(anchorEntry.id) : false
      );
      return group && anchorGroup && group.id === anchorGroup.id;
    });
    const targetEntry = targetId ? findEntryContainingPlayer(entries, targetId) : null;
    if (!anchorEntry || !targetEntry) {
      break;
    }

    const fromIndex = findGroupIndexByEntry(working, anchorEntry.id);
    const conflictIndex = findGroupIndexByEntry(working, targetEntry.id);
    if (fromIndex < 0 || conflictIndex < 0 || fromIndex === conflictIndex) {
      break;
    }

    let swapped = false;
    for (let donorIndex = 0; donorIndex < working.length; donorIndex += 1) {
      if (donorIndex === conflictIndex) {
        continue;
      }
      const donorEntryId = working[donorIndex].entryIds?.[0];
      if (!donorEntryId) {
        continue;
      }
      const candidate = swapEntriesBetweenGroups(
        working,
        entries,
        targetEntry.id,
        conflictIndex,
        donorEntryId,
        donorIndex
      );
      if (!candidate) {
        continue;
      }
      const synced = syncGroupEntries(candidate, entries);
      const nextEval = evaluateGroupConstraints(synced, constraints);
      if (nextEval.hardViolations.length < evaluation.hardViolations.length) {
        working = synced;
        evaluation = nextEval;
        swapped = true;
        break;
      }
    }

    if (!swapped) {
      break;
    }
  }

  return { groups: working, evaluation };
}

export function assignGroupsWithConstraints(entries = [], groupCount = 4, players = [], constraints = []) {
  const baseGroups = assignEntriesToGroupsSnake(entries, groupCount, players);
  const groupConstraints = (constraints || []).filter(
    (item) => item.type === "avoid_same_group"
  );

  if (groupConstraints.length === 0) {
    return {
      groups: baseGroups,
      warnings: [],
      ok: true,
    };
  }

  const resolved = tryResolveGroupConflicts(baseGroups, entries, constraints);
  const warnings = resolved.evaluation.violations.map((item) => item.message);

  return {
    groups: resolved.groups,
    warnings: [...new Set(warnings)],
    ok: resolved.evaluation.ok,
  };
}
