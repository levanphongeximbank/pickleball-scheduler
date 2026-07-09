export function constraintsToCourtPolicies(constraints = []) {
  const policies = [];

  constraints.forEach((constraint) => {
    if (constraint.enabled === false) {
      return;
    }

    if (constraint.type === "prefer_partner") {
      constraint.targetPlayerIds.forEach((targetId) => {
        policies.push({
          type: "prefer_teammate",
          playerA: constraint.anchorPlayerId,
          playerB: targetId,
          enabled: true,
          priority: constraint.mode === "hard" ? "HIGH" : "MEDIUM",
          source: "founder",
        });
      });
      return;
    }

    if (constraint.type === "avoid_partner") {
      constraint.targetPlayerIds.forEach((targetId) => {
        policies.push({
          type: "avoid_teammate",
          playerA: constraint.anchorPlayerId,
          playerB: targetId,
          enabled: true,
          priority: constraint.mode === "hard" ? "HIGH" : "MEDIUM",
          source: "founder",
        });
      });
    }
  });

  return policies;
}
