/**
 * Phase 1F-A — Load authenticated self player profile via canonical Player Management path.
 */
import { useCallback, useEffect, useState } from "react";
import {
  getAuthenticatedSelfPlayerProfile,
  SELF_PLAYER_PROFILE_READ_STATUS,
} from "../services/getAuthenticatedSelfPlayerProfile.js";
import { buildSelfFoundationFieldView } from "../selectors/selfProfileDisplay.js";

const INITIAL = {
  status: SELF_PLAYER_PROFILE_READ_STATUS.LOADING,
  ok: false,
  code: null,
  message: null,
  outcome: null,
  playerId: null,
  authUserId: null,
  profile: null,
  fields: null,
  warnings: [],
};

/**
 * @param {{ authUserId?: string|null, enabled?: boolean }} [options]
 */
export function useAuthenticatedSelfPlayerProfile(options = {}) {
  const authUserId = options.authUserId || null;
  const enabled = options.enabled !== false;
  const [state, setState] = useState(INITIAL);

  const reload = useCallback(async () => {
    if (!enabled) {
      setState(INITIAL);
      return;
    }
    setState((prev) => ({
      ...INITIAL,
      status: SELF_PLAYER_PROFILE_READ_STATUS.LOADING,
      authUserId: authUserId || prev.authUserId,
    }));

    const result = await getAuthenticatedSelfPlayerProfile({
      authUserId: authUserId || undefined,
    });

    setState({
      status: result.status,
      ok: result.ok,
      code: result.code,
      message: result.message,
      outcome: result.outcome,
      playerId: result.playerId,
      authUserId: result.authUserId,
      profile: result.profile,
      fields: result.profile ? buildSelfFoundationFieldView(result.profile) : null,
      warnings: result.warnings,
    });
  }, [authUserId, enabled]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!enabled) {
        if (!cancelled) setState(INITIAL);
        return;
      }
      if (!cancelled) {
        setState((prev) => ({
          ...INITIAL,
          status: SELF_PLAYER_PROFILE_READ_STATUS.LOADING,
          authUserId: authUserId || prev.authUserId,
        }));
      }
      const result = await getAuthenticatedSelfPlayerProfile({
        authUserId: authUserId || undefined,
      });
      if (cancelled) return;
      setState({
        status: result.status,
        ok: result.ok,
        code: result.code,
        message: result.message,
        outcome: result.outcome,
        playerId: result.playerId,
        authUserId: result.authUserId,
        profile: result.profile,
        fields: result.profile ? buildSelfFoundationFieldView(result.profile) : null,
        warnings: result.warnings,
      });
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [authUserId, enabled]);

  return { ...state, reload };
}
