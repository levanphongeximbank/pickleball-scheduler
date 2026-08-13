import { useEffect, useRef, useState } from "react";

import {
  lookupCanonicalCaptainAthleteId,
  resolveCanonicalCaptainAthleteIdFromUser,
} from "../engines/captainIdentityResolver.js";

/**
 * Resolve athletes.id for the signed-in user. Re-runs on auth uid change so
 * logout A → login B cannot reuse A's identity. Never reads profiles.player_id
 * or localStorage.
 *
 * @param {object|null|undefined} user
 * @param {{ lookup?: typeof lookupCanonicalCaptainAthleteId }} [options]
 */
export function useCanonicalCaptainAthleteId(user, options = {}) {
  const lookupRef = useRef(options.lookup);
  lookupRef.current = options.lookup;
  const synced = resolveCanonicalCaptainAthleteIdFromUser(user);
  const userId = String(user?.id || "").trim();
  const [state, setState] = useState(() => ({
    athleteId: synced,
    resolving: !synced && Boolean(userId),
    code: null,
  }));

  useEffect(() => {
    const snapshot = {
      id: String(user?.id || "").trim(),
      athleteId: user?.athleteId,
      athlete_id: user?.athlete_id,
      canonicalAthleteId: user?.canonicalAthleteId,
    };
    const nextSynced = resolveCanonicalCaptainAthleteIdFromUser(snapshot);
    const nextUserId = snapshot.id;
    if (nextSynced) {
      setState({ athleteId: nextSynced, resolving: false, code: null });
      return undefined;
    }
    if (!nextUserId) {
      setState({ athleteId: null, resolving: false, code: null });
      return undefined;
    }

    let cancelled = false;
    setState({ athleteId: null, resolving: true, code: null });
    const lookup = lookupRef.current || lookupCanonicalCaptainAthleteId;
    lookup({ userId: nextUserId, user: snapshot }).then((result) => {
      if (cancelled) {
        return;
      }
      setState({
        athleteId: result.ok ? result.athleteId : null,
        resolving: false,
        code: result.code || null,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.athleteId, user?.athlete_id, user?.canonicalAthleteId]);

  return {
    athleteId: state.athleteId,
    playerId: state.athleteId,
    resolving: state.resolving,
    code: state.code,
  };
}
