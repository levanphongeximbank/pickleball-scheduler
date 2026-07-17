import { createSeededRng, seededShuffle } from "../core/seededRandom.js";

function snakeGroups(teams, groupCount) {
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    id: `group-${index + 1}`,
    name: `Bảng ${index + 1}`,
    teamIds: [],
  }));
  let cursor = 0;
  let forward = true;
  teams.forEach((team) => {
    groups[cursor].teamIds.push(String(team.id));
    if (forward) {
      if (cursor === groupCount - 1) forward = false;
      else cursor += 1;
    } else if (cursor === 0) forward = true;
    else cursor -= 1;
  });
  return groups;
}

export function generateGroupDrawInitialCandidates(input = {}) {
  const teams = Array.isArray(input.teams) ? input.teams : [];
  const groupCount = Math.max(1, Number(input.groupCount) || 1);
  const maxCandidates = Math.max(1, Number(input.maxCandidates) || 96);
  const seed = input.randomSeed ?? input.seed ?? 1;
  const sorted = [...teams].sort((a, b) =>
    Number(b.avgLevel || 0) - Number(a.avgLevel || 0) || String(a.id).localeCompare(String(b.id))
  );
  const candidates = [];
  const add = (groups, strategy) => {
    const signature = groups.map((group) => [...group.teamIds].sort().join(",")).sort().join("|");
    if (!candidates.some((candidate) => candidate.signature === signature)) {
      candidates.push({ id: `group-${candidates.length + 1}`, strategy, signature, groups });
    }
  };
  (input.baselinePlans || []).forEach((plan, index) => add(plan.groups || plan, `baseline_${index}`));
  add(snakeGroups(sorted, groupCount), "snake");
  const rng = createSeededRng(`${seed}:groups`);
  for (let index = 0; candidates.length < maxCandidates && index < maxCandidates * 3; index += 1) {
    const shuffled = seededShuffle(sorted, rng);
    add(snakeGroups(shuffled, groupCount), `seeded_shuffle_${index}`);
  }
  return candidates.slice(0, maxCandidates);
}
