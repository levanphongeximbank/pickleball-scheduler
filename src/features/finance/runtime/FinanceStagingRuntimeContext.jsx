/**
 * Finance Staging runtime React context (Phase 1J).
 * Diagnostics / internal access only — no UI workflow.
 */

import { createContext, useContext } from "react";

/** @type {import("react").Context<null|Readonly<object>>} */
export const FinanceStagingRuntimeContext = createContext(null);

/**
 * @returns {Readonly<object>|null}
 */
export function useFinanceStagingComposition() {
  return useContext(FinanceStagingRuntimeContext);
}

/**
 * Safe readiness getter for internal diagnostics.
 * @returns {Readonly<object>|null}
 */
export function useFinanceStagingReadiness() {
  const composition = useContext(FinanceStagingRuntimeContext);
  if (!composition || typeof composition.getReadiness !== "function") {
    return null;
  }
  return composition.getReadiness();
}
