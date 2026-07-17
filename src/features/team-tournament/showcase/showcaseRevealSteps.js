/**
 * P1.5A Showcase — reveal-step adapters.
 *
 * Pure translators from a FROZEN draw session (engine ran once) into the
 * ordered reveal steps that the full-screen presentation plays back.
 *
 * These adapters never run engines and never mutate membership/group
 * assignment. They only read `session.teamCards` and
 * `session.groupSession.groupCards`, then verify parity (no duplicates, no
 * missing, fingerprint match) before the projector starts.
 */

function safeString(value) {
  return String(value ?? "");
}

/**
 * Build the athlete → team reveal sequence.
 * Each step places exactly one athlete into the correct (frozen) team.
 *
 * @param {object} session frozen team session
 * @returns {{
 *   ok: boolean,
 *   error?: string,
 *   steps: Array<object>,
 *   teams: Array<object>,
 *   totalTeams: number,
 *   totalAthletes: number,
 *   fingerprint: string,
 * }}
 */
export function buildShowcaseTeamRevealSteps(session) {
  const teams = Array.isArray(session?.teamCards) ? session.teamCards : [];
  if (!teams.length) {
    return {
      ok: false,
      error: "Chưa có kết quả đội cố định.",
      steps: [],
      teams: [],
      totalTeams: 0,
      totalAthletes: 0,
      fingerprint: "",
    };
  }

  const steps = [];
  const seen = new Set();
  let duplicate = false;

  teams.forEach((team, teamIndex) => {
    const athletes = Array.isArray(team.athletes) ? team.athletes : [];
    athletes.forEach((athlete, athleteIndexInTeam) => {
      const athleteId = safeString(athlete.id);
      if (athleteId && seen.has(athleteId)) {
        duplicate = true;
      }
      if (athleteId) {
        seen.add(athleteId);
      }
      steps.push({
        index: steps.length,
        kind: "athlete",
        athlete,
        athleteId,
        athleteIndexInTeam,
        teamId: safeString(team.id),
        teamIndex,
        teamName: team.name || `Đội ${teamIndex + 1}`,
        seed: team.seed || teamIndex + 1,
        teamSize: athletes.length,
        isLastOfTeam: athleteIndexInTeam === athletes.length - 1,
      });
    });
  });

  if (!steps.length) {
    return {
      ok: false,
      error: "Đội chưa có vận động viên để công bố.",
      steps: [],
      teams,
      totalTeams: teams.length,
      totalAthletes: 0,
      fingerprint: safeString(session?.membershipFingerprint),
    };
  }

  if (duplicate) {
    return {
      ok: false,
      error: "Phát hiện vận động viên trùng giữa các đội — đã dừng trình chiếu.",
      steps: [],
      teams,
      totalTeams: teams.length,
      totalAthletes: steps.length,
      fingerprint: safeString(session?.membershipFingerprint),
    };
  }

  return {
    ok: true,
    steps,
    teams,
    totalTeams: teams.length,
    totalAthletes: steps.length,
    fingerprint: safeString(session?.membershipFingerprint),
  };
}

/**
 * Build the team → group reveal sequence.
 * Each step places exactly one team into the correct (frozen) group.
 *
 * @param {object} session frozen team+group session
 * @returns {{
 *   ok: boolean,
 *   error?: string,
 *   steps: Array<object>,
 *   groups: Array<object>,
 *   totalGroups: number,
 *   totalTeams: number,
 *   fingerprint: string,
 * }}
 */
export function buildShowcaseGroupRevealSteps(session) {
  const groups = Array.isArray(session?.groupSession?.groupCards)
    ? session.groupSession.groupCards
    : [];
  if (!groups.length) {
    return {
      ok: false,
      error: "Chưa có kết quả chia bảng cố định.",
      steps: [],
      groups: [],
      totalGroups: 0,
      totalTeams: 0,
      fingerprint: "",
    };
  }

  const steps = [];
  const seen = new Set();
  let duplicate = false;

  groups.forEach((group, groupIndex) => {
    const teams = Array.isArray(group.teams) ? group.teams : [];
    teams.forEach((team, teamIndexInGroup) => {
      const teamId = safeString(team.id);
      if (teamId && seen.has(teamId)) {
        duplicate = true;
      }
      if (teamId) {
        seen.add(teamId);
      }
      steps.push({
        index: steps.length,
        kind: "team",
        team,
        teamId,
        teamIndexInGroup,
        groupId: safeString(group.id),
        groupIndex,
        groupName: group.name || `Bảng ${String.fromCharCode(65 + groupIndex)}`,
        groupSize: teams.length,
        isLastOfGroup: teamIndexInGroup === teams.length - 1,
      });
    });
  });

  if (!steps.length) {
    return {
      ok: false,
      error: "Bảng chưa có đội để công bố.",
      steps: [],
      groups,
      totalGroups: groups.length,
      totalTeams: 0,
      fingerprint: safeString(session?.groupSession?.groupFingerprint),
    };
  }

  if (duplicate) {
    return {
      ok: false,
      error: "Phát hiện đội trùng giữa các bảng — đã dừng trình chiếu.",
      steps: [],
      groups,
      totalGroups: groups.length,
      totalTeams: steps.length,
      fingerprint: safeString(session?.groupSession?.groupFingerprint),
    };
  }

  return {
    ok: true,
    steps,
    groups,
    totalGroups: groups.length,
    totalTeams: steps.length,
    fingerprint: safeString(session?.groupSession?.groupFingerprint),
  };
}

/**
 * Verify a built team reveal sequence covers every frozen athlete exactly once.
 */
export function assertTeamRevealParity(session, built) {
  if (!built?.ok) return false;
  const teams = Array.isArray(session?.teamCards) ? session.teamCards : [];
  const expected = teams.reduce(
    (sum, team) => sum + (Array.isArray(team.athletes) ? team.athletes.length : 0),
    0
  );
  if (expected !== built.steps.length) return false;
  const uniqueAthletes = new Set(built.steps.map((step) => step.athleteId));
  if (uniqueAthletes.size !== built.steps.length) return false;
  return built.fingerprint === safeString(session?.membershipFingerprint);
}

/**
 * Verify a built group reveal sequence covers every frozen team exactly once.
 */
export function assertGroupRevealParity(session, built) {
  if (!built?.ok) return false;
  const groups = Array.isArray(session?.groupSession?.groupCards)
    ? session.groupSession.groupCards
    : [];
  const expected = groups.reduce(
    (sum, group) => sum + (Array.isArray(group.teams) ? group.teams.length : 0),
    0
  );
  if (expected !== built.steps.length) return false;
  const uniqueTeams = new Set(built.steps.map((step) => step.teamId));
  if (uniqueTeams.size !== built.steps.length) return false;
  return built.fingerprint === safeString(session?.groupSession?.groupFingerprint);
}

/**
 * Given the ordered team-reveal steps and how many have been revealed so far,
 * derive the per-team roster that should currently be visible.
 * Presentation-only; does not alter frozen membership.
 */
export function selectRevealedTeamState(built, revealedCount) {
  const teams = built?.teams || [];
  const clamped = Math.max(0, Math.min(Number(revealedCount) || 0, built?.steps?.length || 0));
  const revealedByTeam = new Map();
  for (let i = 0; i < clamped; i += 1) {
    const step = built.steps[i];
    if (!step) continue;
    const list = revealedByTeam.get(step.teamId) || [];
    list.push(step.athlete);
    revealedByTeam.set(step.teamId, list);
  }
  const lastStep = clamped > 0 ? built.steps[clamped - 1] : null;
  const teamsView = teams.map((team) => ({
    ...team,
    revealedAthletes: revealedByTeam.get(String(team.id)) || [],
  }));
  return {
    revealedCount: clamped,
    total: built?.steps?.length || 0,
    isComplete: clamped >= (built?.steps?.length || 0),
    activeTeamIndex: lastStep ? lastStep.teamIndex : 0,
    currentStep: lastStep,
    teams: teamsView,
  };
}

/**
 * Given the ordered group-reveal steps and how many have been revealed so far,
 * derive the per-group team list that should currently be visible.
 */
export function selectRevealedGroupState(built, revealedCount) {
  const groups = built?.groups || [];
  const clamped = Math.max(0, Math.min(Number(revealedCount) || 0, built?.steps?.length || 0));
  const revealedByGroup = new Map();
  for (let i = 0; i < clamped; i += 1) {
    const step = built.steps[i];
    if (!step) continue;
    const list = revealedByGroup.get(step.groupId) || [];
    list.push(step.team);
    revealedByGroup.set(step.groupId, list);
  }
  const lastStep = clamped > 0 ? built.steps[clamped - 1] : null;
  const groupsView = groups.map((group) => ({
    ...group,
    revealedTeams: revealedByGroup.get(String(group.id)) || [],
  }));
  return {
    revealedCount: clamped,
    total: built?.steps?.length || 0,
    isComplete: clamped >= (built?.steps?.length || 0),
    activeGroupIndex: lastStep ? lastStep.groupIndex : 0,
    currentStep: lastStep,
    groups: groupsView,
  };
}
