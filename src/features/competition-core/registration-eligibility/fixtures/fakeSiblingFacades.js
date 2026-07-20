/**
 * In-memory fake sibling public facades for Core-03 adapter / runtime QA tests.
 * Call history is test-only and is not part of the production public surface.
 */

/**
 * @param {{
 *   participants?: Array<{ id: string, [k: string]: unknown }>,
 *   entries?: Array<{ id: string, competitionId: string, [k: string]: unknown }>,
 *   ruleResult?: unknown|((ruleSet: unknown, context: unknown) => unknown),
 *   divisionResult?: unknown|((req: unknown) => unknown),
 *   rosterResult?: unknown|((req: unknown) => unknown),
 * }} [options]
 */
export function createFakeSiblingFacades(options = {}) {
  const participants = new Map(
    (options.participants || []).map((p) => [String(p.id), { ...p, id: String(p.id) }])
  );
  const entries = (options.entries || []).map((e) => ({ ...e, id: String(e.id) }));

  const calls = {
    evaluateCanonicalRules: 0,
    getById: 0,
    listByCompetition: 0,
    findActiveDuplicate: 0,
    evaluateDivisionEligibility: 0,
    validateTeamRoster: 0,
    createEntryFromRegistration: 0,
  };

  return {
    calls,
    core01RuleEngine: {
      async evaluateCanonicalRules(ruleSet, context, _options) {
        calls.evaluateCanonicalRules += 1;
        if (typeof options.ruleResult === "function") {
          return options.ruleResult(ruleSet, context, _options);
        }
        if (options.ruleResult !== undefined) return options.ruleResult;
        return {
          enabled: true,
          feasible: true,
          eligible: true,
          validation: { ok: true, errors: [] },
          hardViolations: [],
          softScore: 0,
          softNotes: [],
          explanations: [],
          engineVersion: "cc03a-v2",
          ruleSetId: ruleSet?.id || "competition-core-default",
          ruleSetVersion: ruleSet?.version || "1",
        };
      },
    },
    core02ParticipantLookup: {
      async getById(id) {
        calls.getById += 1;
        return participants.get(String(id)) ?? null;
      },
    },
    core02EntryLookup: {
      async listByCompetition(competitionId) {
        calls.listByCompetition += 1;
        return entries
          .filter((e) => e.competitionId === String(competitionId))
          .map((e) => ({ ...e }));
      },
      async findActiveDuplicate(scope) {
        calls.findActiveDuplicate += 1;
        return entries
          .filter((e) => {
            if (e.competitionId !== scope.competitionId) return false;
            if ((e.divisionId ?? null) !== (scope.divisionId ?? null)) return false;
            const status = String(e.status || "").toUpperCase();
            return status === "ACTIVE" || status === "APPROVED" || status === "PENDING";
          })
          .map((e) => ({ ...e }));
      },
    },
    core04DivisionEligibility: {
      async evaluateDivisionEligibility(request) {
        calls.evaluateDivisionEligibility += 1;
        if (typeof options.divisionResult === "function") {
          return options.divisionResult(request);
        }
        if (options.divisionResult !== undefined) return options.divisionResult;
        return {
          ok: true,
          errors: [],
          warnings: [],
          value: {
            schemaVersion: "1",
            eligibilityDescriptor: { ref: "desc-1" },
            capacity: { available: 10 },
          },
        };
      },
    },
    core05TeamRoster: {
      async validateTeamRoster(request) {
        calls.validateTeamRoster += 1;
        if (typeof options.rosterResult === "function") {
          return options.rosterResult(request);
        }
        if (options.rosterResult !== undefined) return options.rosterResult;
        return {
          ok: true,
          issues: [],
          value: {
            team: { id: request.teamId, competitionId: request.competitionId },
            roster: {
              rosterVersion: request.rosterVersion ?? 1,
              members: [{ id: "m1", status: "ACTIVE" }, { id: "m2", status: "ACTIVE" }],
            },
          },
        };
      },
    },
  };
}
