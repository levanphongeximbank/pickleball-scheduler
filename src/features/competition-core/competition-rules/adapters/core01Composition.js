/**
 * CORE-01 composition bridge.
 * Reuses authority / operation vocabulary — does not fork a second rule engine.
 */

import {
  RULE_SOURCE,
  RULE_SOURCE_PRIORITY,
  isRuleSource,
  deriveRuleSource,
} from "../../constraints/authority/ruleSource.js";
import {
  RULE_OPERATION,
  resolveCanonicalOperation,
} from "../../constraints/operations/ruleOperations.js";

/**
 * @param {{
 *   source?: string,
 *   operation?: string,
 *   tenantId?: string|null,
 *   competitionId?: string|null,
 * }} input
 */
export function composeCore01AuthorityContext(input = {}) {
  const source = isRuleSource(input.source)
    ? input.source
    : deriveRuleSource(input.source);
  const operation =
    resolveCanonicalOperation(input.operation) || RULE_OPERATION.ALL;

  return Object.freeze({
    ok: true,
    reused: true,
    parallelRuleEngine: false,
    source,
    sourcePriority: RULE_SOURCE_PRIORITY[source] ?? 0,
    operation,
    tenantId: input.tenantId == null ? null : String(input.tenantId),
    competitionId:
      input.competitionId == null ? null : String(input.competitionId),
    note:
      "Competition Rules Profile is policy/config; CORE-01 remains constraint resolution authority",
    exportsUsed: Object.freeze([
      "RULE_SOURCE",
      "RULE_SOURCE_PRIORITY",
      "RULE_OPERATION",
      "resolveCanonicalOperation",
    ]),
  });
}

export { RULE_SOURCE, RULE_OPERATION };
