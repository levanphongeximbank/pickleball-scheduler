/**
 * Authenticated shared button semantics (Wave 2 Batch 2C).
 * Canonical strategy: MUI Button + theme.js — no parallel Button library.
 *
 * @ownership AUTHENTICATED_SHARED
 */

import { INTERACTION } from "../../theme/designTokens.js";

/**
 * Semantic action roles → MUI Button props.
 * Do not invent a second taxonomy beyond these roles.
 */
export const BUTTON_SEMANTICS = Object.freeze({
  /** Main positive / navigation action — AUTH_PRIMARY blue */
  primary: Object.freeze({ variant: "contained", color: "primary" }),
  /** Supporting action */
  secondary: Object.freeze({ variant: "outlined", color: "primary" }),
  /** Low-emphasis / ghost */
  tertiary: Object.freeze({ variant: "text", color: "primary" }),
  /** Alias for tertiary */
  ghost: Object.freeze({ variant: "text", color: "secondary" }),
  /** Delete / remove / danger — semantic error; never primary blue */
  destructive: Object.freeze({ variant: "contained", color: "error" }),
  /** Completion / confirm-success only — not generic primary */
  success: Object.freeze({ variant: "contained", color: "success" }),
});

export const BUTTON_LOADING_STRATEGY =
  "MUI_BUTTON_NATIVE_LOADING_PROP";

/**
 * Optional sx for NEW authenticated shared surfaces that want the 44px target.
 * Do not apply globally (Wave 1 shell + dense tables stay exceptions).
 */
export function sharedTouchTargetSx(extraSx) {
  const base = {
    minHeight: INTERACTION.touchTargetMin,
  };
  if (!extraSx) return base;
  return Array.isArray(extraSx) ? [base, ...extraSx] : [base, extraSx];
}

/**
 * Spread onto MUI Button when showing a pending submit.
 * Relies on MUI Button `loading` (installed @mui/material) — no new dependency.
 *
 * @param {boolean} loading
 * @param {{ loadingPosition?: 'start'|'end'|'center' }} [options]
 */
export function buttonLoadingProps(loading, options = {}) {
  if (!loading) {
    return { loading: false };
  }
  return {
    loading: true,
    loadingPosition: options.loadingPosition || "start",
    disabled: true,
  };
}
