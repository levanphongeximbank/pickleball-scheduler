import { parseEnvBoolean } from "./envReader.js";

export const RULES_V2_ENV_KEYS = Object.freeze({
  RULES_V2: "VITE_COMPETITION_CORE_RULES_V2_ENABLED",
  CONSTRAINTS_V2: "VITE_COMPETITION_CORE_CONSTRAINTS_V2_ENABLED",
});

/** @type {boolean|null} */
let legacyAliasWarningShown = false;

/**
 * Resolve Rules V2 flag with canonical RULES_V2 first, CONSTRAINTS_V2 fallback.
 *
 * @param {Record<string, unknown>|undefined|null} [envSource]
 * @returns {{ enabled: boolean, source: 'rules_v2'|'constraints_v2'|'default' }}
 */
export function resolveRulesV2Flag(envSource) {
  const env = envSource ?? import.meta.env ?? {};
  const rulesRaw = env[RULES_V2_ENV_KEYS.RULES_V2];
  const constraintsRaw = env[RULES_V2_ENV_KEYS.CONSTRAINTS_V2];

  const hasRulesKey = rulesRaw != null && String(rulesRaw).trim() !== "";
  const hasConstraintsKey =
    constraintsRaw != null && String(constraintsRaw).trim() !== "";

  if (hasRulesKey) {
    return {
      enabled: parseEnvBoolean(rulesRaw),
      source: "rules_v2",
    };
  }

  if (hasConstraintsKey) {
    if (
      typeof import.meta !== "undefined" &&
      import.meta.env?.DEV &&
      !legacyAliasWarningShown
    ) {
      legacyAliasWarningShown = true;
      console.warn(
        "[competition-core] VITE_COMPETITION_CORE_CONSTRAINTS_V2_ENABLED is deprecated; " +
          "use VITE_COMPETITION_CORE_RULES_V2_ENABLED."
      );
    }
    return {
      enabled: parseEnvBoolean(constraintsRaw),
      source: "constraints_v2",
    };
  }

  return { enabled: false, source: "default" };
}
