/**
 * Phase 1F-B2 — Explicit viewer / read modes for Player Management directory search.
 *
 * There is no default mode. Callers must pass mode explicitly.
 * Unknown / omitted / unsupported modes fail closed.
 */
export const PLAYER_PROFILE_VIEWER_MODE = Object.freeze({
  PUBLIC: "public",
  DIRECTORY: "directory",
  INTERNAL: "internal",
});

export const PLAYER_PROFILE_VIEWER_MODES = Object.freeze(
  Object.values(PLAYER_PROFILE_VIEWER_MODE)
);

export const VIEWER_MODE_ERROR = Object.freeze({
  MODE_REQUIRED: "VIEWER_MODE_REQUIRED",
  MODE_UNSUPPORTED: "VIEWER_MODE_UNSUPPORTED",
});

/**
 * @param {unknown} value
 * @returns {{ ok: true, mode: string } | { ok: false, code: string, message: string }}
 */
export function resolvePlayerProfileViewerMode(value) {
  if (value == null || value === "") {
    return {
      ok: false,
      code: VIEWER_MODE_ERROR.MODE_REQUIRED,
      message: "viewer mode is required (public | directory | internal)",
    };
  }

  const mode = String(value).trim().toLowerCase();
  if (!PLAYER_PROFILE_VIEWER_MODES.includes(mode)) {
    return {
      ok: false,
      code: VIEWER_MODE_ERROR.MODE_UNSUPPORTED,
      message: `unsupported viewer mode: ${String(value)}`,
    };
  }

  return { ok: true, mode };
}

export function isPublicOrDirectoryMode(mode) {
  return (
    mode === PLAYER_PROFILE_VIEWER_MODE.PUBLIC ||
    mode === PLAYER_PROFILE_VIEWER_MODE.DIRECTORY
  );
}
