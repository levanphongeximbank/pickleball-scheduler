import { CONSTRAINT_SEVERITY } from "../../competition-core/constants/constraintSeverity.js";
import { PRIVATE_PAIRING_CONFLICT_CODE } from "../constants/codes.js";
import { PRIVATE_PAIRING_CONSTRAINT_TYPE } from "../constants/constraintTypes.js";
import { RELATION_MODE } from "../constants/enums.js";
import { normalizePrivatePairingRules } from "../contracts/normalizePrivatePairingRule.js";
import { rulesOverlapInContext } from "./scopeTimeOverlap.js";

/**
 * @typedef {Object} PrivatePairingConflict
 * @property {string} code
 * @property {'fatal'|'warning'} severity
 * @property {string[]} ruleIds
 * @property {string[]} playerIds
 * @property {{ scopeType?: string, scopeId?: string|null }} [scope]
 * @property {string} messageKey
 * @property {Record<string, unknown>} [details]
 * @property {string} [suggestedResolution]
 */

/**
 * @typedef {Object} PrivatePairingConflictResult
 * @property {boolean} ok
 * @property {PrivatePairingConflict[]} fatalConflicts
 * @property {PrivatePairingConflict[]} warnings
 */

/**
 * @param {Partial<PrivatePairingConflict>} partial
 * @returns {PrivatePairingConflict}
 */
export function createPrivatePairingConflict(partial) {
  return {
    code: String(partial.code),
    severity: partial.severity === "warning" ? "warning" : "fatal",
    ruleIds: Array.isArray(partial.ruleIds) ? [...partial.ruleIds].map(String).sort() : [],
    playerIds: Array.isArray(partial.playerIds)
      ? [...new Set(partial.playerIds.map(String))].sort()
      : [],
    scope: partial.scope ? { ...partial.scope } : undefined,
    messageKey: String(partial.messageKey || partial.code),
    details: partial.details ? { ...partial.details } : undefined,
    suggestedResolution: partial.suggestedResolution,
  };
}

function pairKey(a, b) {
  return [String(a), String(b)].sort().join("|");
}

function isActive(rule) {
  return rule?.active !== false;
}

function expandTargets(rule) {
  return (rule.targetPlayerIds || []).map(String).filter(Boolean);
}

function compareConflicts(a, b) {
  if (a.code !== b.code) {
    return a.code.localeCompare(b.code);
  }
  const idsA = a.ruleIds.join(",");
  const idsB = b.ruleIds.join(",");
  if (idsA !== idsB) {
    return idsA.localeCompare(idsB);
  }
  return a.playerIds.join(",").localeCompare(b.playerIds.join(","));
}

function dedupeConflicts(list) {
  const seen = new Set();
  return list
    .slice()
    .sort(compareConflicts)
    .filter((item) => {
      const key = [item.code, item.ruleIds.join("|"), item.playerIds.join("|")].join("::");
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

class UnionFind {
  constructor() {
    /** @type {Map<string, string>} */
    this.parent = new Map();
  }

  find(x) {
    const key = String(x);
    if (!this.parent.has(key)) {
      this.parent.set(key, key);
    }
    const parent = this.parent.get(key);
    if (parent !== key) {
      this.parent.set(key, this.find(parent));
    }
    return this.parent.get(key);
  }

  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) {
      return;
    }
    if (ra < rb) {
      this.parent.set(rb, ra);
    } else {
      this.parent.set(ra, rb);
    }
  }

  components() {
    /** @type {Map<string, Set<string>>} */
    const groups = new Map();
    for (const node of this.parent.keys()) {
      const root = this.find(node);
      if (!groups.has(root)) {
        groups.set(root, new Set());
      }
      groups.get(root).add(node);
    }
    return groups;
  }
}

/**
 * Pure, deterministic conflict detector. Does not mutate input.
 *
 * @param {Array<Record<string, unknown>>} rulesInput
 * @param {Partial<{ teamSize: number }>} [context]
 * @returns {PrivatePairingConflictResult}
 */
export function detectPrivatePairingConflicts(rulesInput = [], context = {}) {
  const inputCopy = Array.isArray(rulesInput) ? rulesInput.map((item) => ({ ...item })) : [];
  const rules = normalizePrivatePairingRules(inputCopy).filter(isActive);
  const teamSize = Number(context.teamSize ?? 2);

  /** @type {PrivatePairingConflict[]} */
  const fatalConflicts = [];
  /** @type {PrivatePairingConflict[]} */
  const warnings = [];

  const seenIds = new Map();
  rules.forEach((rule) => {
    if (seenIds.has(rule.id)) {
      fatalConflicts.push(
        createPrivatePairingConflict({
          code: PRIVATE_PAIRING_CONFLICT_CODE.DUPLICATE_RULE_ID,
          severity: "fatal",
          ruleIds: [rule.id],
          playerIds: [rule.primaryPlayerId].filter(Boolean),
          messageKey: PRIVATE_PAIRING_CONFLICT_CODE.DUPLICATE_RULE_ID,
          suggestedResolution: "Assign unique rule ids.",
        })
      );
    }
    seenIds.set(rule.id, rule);
  });

  /** @type {Map<string, Array<{ rule: (typeof rules)[number] }>>} */
  const byPairAndType = new Map();

  const indexKey = (pair, type) => `${pair}::${type}`;

  rules.forEach((rule) => {
    const primary = String(rule.primaryPlayerId || "");
    if (!primary) {
      return;
    }
    expandTargets(rule).forEach((target) => {
      const key = indexKey(pairKey(primary, target), rule.constraintType);
      const bucket = byPairAndType.get(key) || [];
      bucket.push({ rule });
      byPairAndType.set(key, bucket);
    });
  });

  const allPairKeys = new Set(
    [...byPairAndType.keys()].map((key) => key.split("::")[0])
  );

  allPairKeys.forEach((pair) => {
    const [playerA, playerB] = pair.split("|");
    const get = (type) => byPairAndType.get(indexKey(pair, type)) || [];

    const mustPartner = get(PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER);
    const mustNotPartner = get(PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER);
    const preferPartner = get(PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER);
    const avoidPartner = get(PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_PARTNER);
    const mustOpponent = get(PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_OPPONENT);
    const mustNotOpponent = get(PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_OPPONENT);

    mustPartner.forEach((m) => {
      mustNotPartner.forEach((n) => {
        if (!rulesOverlapInContext(m.rule, n.rule)) {
          return;
        }
        fatalConflicts.push(
          createPrivatePairingConflict({
            code: PRIVATE_PAIRING_CONFLICT_CODE.MUST_AND_MUST_NOT_PARTNER,
            severity: "fatal",
            ruleIds: [m.rule.id, n.rule.id],
            playerIds: [playerA, playerB],
            scope: { scopeType: m.rule.scopeType, scopeId: m.rule.scopeId },
            messageKey: PRIVATE_PAIRING_CONFLICT_CODE.MUST_AND_MUST_NOT_PARTNER,
            suggestedResolution: "Remove or disable one of the contradictory partner rules.",
          })
        );
      });

      mustOpponent.forEach((o) => {
        if (!rulesOverlapInContext(m.rule, o.rule)) {
          return;
        }
        fatalConflicts.push(
          createPrivatePairingConflict({
            code: PRIVATE_PAIRING_CONFLICT_CODE.PARTNER_AND_OPPONENT_CONFLICT,
            severity: "fatal",
            ruleIds: [m.rule.id, o.rule.id],
            playerIds: [playerA, playerB],
            scope: { scopeType: m.rule.scopeType, scopeId: m.rule.scopeId },
            messageKey: PRIVATE_PAIRING_CONFLICT_CODE.PARTNER_AND_OPPONENT_CONFLICT,
            suggestedResolution: "A player cannot be both required partner and required opponent.",
          })
        );
      });

      avoidPartner.forEach((a) => {
        if (!rulesOverlapInContext(m.rule, a.rule)) {
          return;
        }
        if (a.rule.severity === CONSTRAINT_SEVERITY.SOFT) {
          warnings.push(
            createPrivatePairingConflict({
              code: PRIVATE_PAIRING_CONFLICT_CODE.HARD_RULE_OVERRIDES_SOFT_RULE,
              severity: "warning",
              ruleIds: [m.rule.id, a.rule.id],
              playerIds: [playerA, playerB],
              scope: { scopeType: m.rule.scopeType, scopeId: m.rule.scopeId },
              messageKey: PRIVATE_PAIRING_CONFLICT_CODE.HARD_RULE_OVERRIDES_SOFT_RULE,
              details: {
                hardType: m.rule.constraintType,
                softType: a.rule.constraintType,
              },
              suggestedResolution: "Soft avoid cannot be satisfied while must-partner is active.",
            })
          );
        }
      });
    });

    mustOpponent.forEach((m) => {
      mustNotOpponent.forEach((n) => {
        if (!rulesOverlapInContext(m.rule, n.rule)) {
          return;
        }
        fatalConflicts.push(
          createPrivatePairingConflict({
            code: PRIVATE_PAIRING_CONFLICT_CODE.MUST_AND_MUST_NOT_OPPONENT,
            severity: "fatal",
            ruleIds: [m.rule.id, n.rule.id],
            playerIds: [playerA, playerB],
            scope: { scopeType: m.rule.scopeType, scopeId: m.rule.scopeId },
            messageKey: PRIVATE_PAIRING_CONFLICT_CODE.MUST_AND_MUST_NOT_OPPONENT,
            suggestedResolution: "Remove or disable one of the contradictory opponent rules.",
          })
        );
      });
    });

    preferPartner.forEach((p) => {
      avoidPartner.forEach((a) => {
        if (!rulesOverlapInContext(p.rule, a.rule)) {
          return;
        }
        if (
          p.rule.severity === CONSTRAINT_SEVERITY.SOFT &&
          a.rule.severity === CONSTRAINT_SEVERITY.SOFT
        ) {
          warnings.push(
            createPrivatePairingConflict({
              code: PRIVATE_PAIRING_CONFLICT_CODE.SOFT_SOFT_OPPOSITE_PREFERENCE,
              severity: "warning",
              ruleIds: [p.rule.id, a.rule.id],
              playerIds: [playerA, playerB],
              scope: { scopeType: p.rule.scopeType, scopeId: p.rule.scopeId },
              messageKey: PRIVATE_PAIRING_CONFLICT_CODE.SOFT_SOFT_OPPOSITE_PREFERENCE,
              suggestedResolution:
                "Review soft prefer vs soft avoid; soft conflicts do not block save.",
            })
          );
        }
      });

      mustNotPartner.forEach((n) => {
        if (!rulesOverlapInContext(p.rule, n.rule)) {
          return;
        }
        warnings.push(
          createPrivatePairingConflict({
            code: PRIVATE_PAIRING_CONFLICT_CODE.HARD_RULE_OVERRIDES_SOFT_RULE,
            severity: "warning",
            ruleIds: [n.rule.id, p.rule.id],
            playerIds: [playerA, playerB],
            scope: { scopeType: n.rule.scopeType, scopeId: n.rule.scopeId },
            messageKey: PRIVATE_PAIRING_CONFLICT_CODE.HARD_RULE_OVERRIDES_SOFT_RULE,
            details: {
              hardType: n.rule.constraintType,
              softType: p.rule.constraintType,
            },
            suggestedResolution: "Soft prefer cannot be satisfied while must-not-partner is active.",
          })
        );
      });
    });
  });

  // Capacity: ALL_OF and forced multi must-partner
  /** @type {Map<string, typeof rules>} */
  const mustByPrimary = new Map();
  rules
    .filter((rule) => rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER)
    .forEach((rule) => {
      const key = String(rule.primaryPlayerId);
      const bucket = mustByPrimary.get(key) || [];
      bucket.push(rule);
      mustByPrimary.set(key, bucket);

      if (
        rule.relationMode === RELATION_MODE.ALL_OF &&
        rule.targetPlayerIds.length > Math.max(teamSize - 1, 0)
      ) {
        fatalConflicts.push(
          createPrivatePairingConflict({
            code: PRIVATE_PAIRING_CONFLICT_CODE.TEAM_CAPACITY_EXCEEDED,
            severity: "fatal",
            ruleIds: [rule.id],
            playerIds: [rule.primaryPlayerId, ...rule.targetPlayerIds],
            scope: { scopeType: rule.scopeType, scopeId: rule.scopeId },
            messageKey: PRIVATE_PAIRING_CONFLICT_CODE.TEAM_CAPACITY_EXCEEDED,
            details: {
              relationMode: RELATION_MODE.ALL_OF,
              targetCount: rule.targetPlayerIds.length,
              teamSize,
            },
            suggestedResolution: "Reduce ALL_OF targets or increase team size.",
          })
        );
      }
    });

  mustByPrimary.forEach((bucket, primary) => {
    const forcedTargets = new Set();
    const involvedIds = [];
    bucket.forEach((rule) => {
      const peers = bucket.filter((other) => rulesOverlapInContext(rule, other));
      if (!peers.length) {
        return;
      }
      if (rule.relationMode === RELATION_MODE.ALL_OF) {
        rule.targetPlayerIds.forEach((id) => forcedTargets.add(String(id)));
        involvedIds.push(rule.id);
      } else if (rule.targetPlayerIds.length === 1) {
        // Single-target ANY_OF is effectively forced
        forcedTargets.add(String(rule.targetPlayerIds[0]));
        involvedIds.push(rule.id);
      }
      // Multi-target ANY_OF: only needs one partner — not all forced into capacity count
    });

    if (forcedTargets.size > Math.max(teamSize - 1, 0)) {
      fatalConflicts.push(
        createPrivatePairingConflict({
          code: PRIVATE_PAIRING_CONFLICT_CODE.TEAM_CAPACITY_EXCEEDED,
          severity: "fatal",
          ruleIds: [...new Set(involvedIds)],
          playerIds: [primary, ...forcedTargets],
          scope: { scopeType: bucket[0]?.scopeType, scopeId: bucket[0]?.scopeId },
          messageKey: PRIVATE_PAIRING_CONFLICT_CODE.TEAM_CAPACITY_EXCEEDED,
          details: { forcedTargetCount: forcedTargets.size, teamSize },
          suggestedResolution: "Reduce must-partner requirements so they fit team size.",
        })
      );
    }
  });

  // Partner chain (A-B, B-C) via edges that actually force co-team:
  // ALL_OF edges + single-target MUST_PARTNER. Overlapping scope/time only.
  const uf = new UnionFind();
  /** @type {Map<string, Set<string>>} */
  const ruleIdsByPlayer = new Map();

  const mustPartnerRules = rules.filter(
    (rule) => rule.constraintType === PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER
  );

  mustPartnerRules.forEach((rule) => {
    const shouldForceEdge =
      rule.relationMode === RELATION_MODE.ALL_OF || rule.targetPlayerIds.length === 1;
    if (!shouldForceEdge) {
      return;
    }

    // Only union with other overlapping must rules in the same component pass:
    // For chain detection we union all forced edges that pairwise overlap in scope/time with
    // at least one other must rule OR stand alone (self chain within ALL_OF).
    const related = mustPartnerRules.filter(
      (other) => other.id === rule.id || rulesOverlapInContext(rule, other)
    );
    if (!related.length) {
      return;
    }

    const primary = String(rule.primaryPlayerId);
    rule.targetPlayerIds.forEach((target) => {
      uf.union(primary, target);
    });
    [primary, ...rule.targetPlayerIds.map(String)].forEach((playerId) => {
      if (!ruleIdsByPlayer.has(playerId)) {
        ruleIdsByPlayer.set(playerId, new Set());
      }
      ruleIdsByPlayer.get(playerId).add(rule.id);
    });
  });

  uf.components().forEach((members) => {
    if (members.size <= teamSize) {
      return;
    }
    const playerIds = [...members].sort();
    const ruleIds = new Set();
    playerIds.forEach((playerId) => {
      (ruleIdsByPlayer.get(playerId) || []).forEach((id) => ruleIds.add(id));
    });
    fatalConflicts.push(
      createPrivatePairingConflict({
        code: PRIVATE_PAIRING_CONFLICT_CODE.IMPOSSIBLE_PARTNER_CHAIN,
        severity: "fatal",
        ruleIds: [...ruleIds],
        playerIds,
        messageKey: PRIVATE_PAIRING_CONFLICT_CODE.IMPOSSIBLE_PARTNER_CHAIN,
        details: { componentSize: members.size, teamSize },
        suggestedResolution: "Break the must-partner chain or increase team size.",
      })
    );
  });

  const fatal = dedupeConflicts(fatalConflicts);
  const warn = dedupeConflicts(warnings);

  return {
    ok: fatal.length === 0,
    fatalConflicts: fatal,
    warnings: warn,
  };
}
