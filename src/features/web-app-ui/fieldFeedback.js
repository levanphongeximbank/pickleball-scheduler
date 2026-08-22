/**
 * Field feedback helpers — node-safe (no JSX / no form framework).
 * @ownership AUTHENTICATED_SHARED
 */

/**
 * Stable id for aria-describedby when a control id is known.
 * @param {string} controlId
 * @param {string} [suffix='error']
 */
export function fieldErrorId(controlId, suffix = "error") {
  if (!controlId) return undefined;
  return `${controlId}-${suffix}`;
}

/**
 * Props to spread onto a form control for error association.
 *
 * @param {{
 *   id?: string,
 *   error?: boolean,
 *   errorMessage?: string,
 *   errorId?: string,
 *   describedBy?: string,
 * }} opts
 */
export function fieldControlAriaProps({
  id,
  error = false,
  errorMessage,
  errorId: errorIdProp,
  describedBy,
} = {}) {
  const hasError = Boolean(error) && Boolean(errorMessage);
  const resolvedErrorId = hasError ? errorIdProp || fieldErrorId(id) : undefined;
  const parts = [describedBy, resolvedErrorId].filter(Boolean);

  return {
    ...(id ? { id } : {}),
    error: Boolean(error),
    ...(hasError ? { "aria-invalid": true } : {}),
    ...(parts.length ? { "aria-describedby": parts.join(" ") } : {}),
  };
}
