import { seedTeamsIntoGroups } from "../../pages/tournament.seeding.logic.js";
import { createGroupRecord } from "../../models/tournament/group.js";
import { entriesToTeams } from "./teamPairingEngine.js";

export function assignEntriesToGroupsSnake(entries = [], groupCount = 4, players = []) {
  const teams = entriesToTeams(entries, players).sort(
    (a, b) => Number(b.avgLevel || 0) - Number(a.avgLevel || 0)
  );

  const seeded = seedTeamsIntoGroups(teams, groupCount, {
    mode: "skill_controlled",
  });

  return seeded.map((group, index) => {
    const groupEntries = group.teams
      .map((team) => entries.find((entry) => entry.id === team.id))
      .filter(Boolean);

    return createGroupRecord({
      id: `group-${group.group}-${Date.now()}-${index}`,
      label: group.group,
      name: `Bảng ${group.group}`,
      entryIds: groupEntries.map((entry) => entry.id),
      entries: groupEntries,
      matches: [],
      standings: [],
      pointsConfig: {
        win: 2,
        loss: 1,
        forfeit: 0,
      },
    });
  });
}

export function summarizeGroupBalance(groups = []) {
  const sizes = groups.map((group) => group.entryIds?.length || group.entries?.length || 0);
  const max = sizes.length ? Math.max(...sizes) : 0;
  const min = sizes.length ? Math.min(...sizes) : 0;

  return {
    groupCount: groups.length,
    sizes,
    balanced: max - min <= 1,
    max,
    min,
  };
}
