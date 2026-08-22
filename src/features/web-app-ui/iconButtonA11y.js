/**
 * IconButton accessibility contract helpers (Wave 2 Batch 2C).
 * Base component remains MUI IconButton — no parallel IconButton library.
 *
 * @ownership AUTHENTICATED_SHARED
 */

import { INTERACTION } from "../../theme/designTokens.js";

/**
 * Props for standalone icon-only actions.
 * Tooltip may supplement but must NOT be the sole accessible name —
 * always set aria-label (and optional title).
 *
 * @param {{ label: string, title?: string, sx?: object|object[], compact?: boolean }} opts
 * @returns {Record<string, unknown>}
 */
export function iconOnlyButtonProps({ label, title, sx, compact = false, ...rest } = {}) {
  const name = typeof label === "string" ? label.trim() : "";
  if (!name) {
    throw new Error(
      "iconOnlyButtonProps: standalone icon-only IconButton requires a non-empty accessible name (label → aria-label)."
    );
  }

  const touchSx = compact
    ? {
        /* Dense table actions: keep visual compact but expand hit via padding where feasible */
        minWidth: 40,
        minHeight: 40,
      }
    : {
        minWidth: INTERACTION.touchTargetMin,
        minHeight: INTERACTION.touchTargetMin,
      };

  const mergedSx = sx == null ? touchSx : Array.isArray(sx) ? [touchSx, ...sx] : [touchSx, sx];

  return {
    ...rest,
    "aria-label": name,
    ...(title != null ? { title } : { title: name }),
    sx: mergedSx,
  };
}

/**
 * Runtime/dev assert — use in tests or guarded call sites.
 * @param {{ "aria-label"?: string, "aria-labelledby"?: string, children?: unknown }} props
 */
export function hasIconButtonAccessibleName(props = {}) {
  const ariaLabel = typeof props["aria-label"] === "string" ? props["aria-label"].trim() : "";
  const labelledBy =
    typeof props["aria-labelledby"] === "string" ? props["aria-labelledby"].trim() : "";
  return Boolean(ariaLabel || labelledBy);
}
