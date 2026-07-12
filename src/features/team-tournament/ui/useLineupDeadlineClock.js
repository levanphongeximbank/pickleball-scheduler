import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createServerClockSync,
  getSyncedNowMs,
  isDeadlineElapsed,
} from "../services/lineupDeadlineService.js";
import { formatCountdownTo } from "../../../components/tournament/team/teamTournamentLabels.js";

/**
 * Display-only countdown synced to server time. Triggers reload when deadline elapses.
 * Does not grant or deny permissions — use server canSaveDraft/canSubmit for that.
 */
export function useLineupDeadlineClock({
  serverTime,
  lineupDeadline,
  onDeadlineElapsed,
  tickMs = 1000,
}) {
  const elapsedRef = useRef(false);
  const [syncedNowMs, setSyncedNowMs] = useState(() => Date.now());

  const serverClock = useMemo(() => {
    if (!serverTime) {
      return null;
    }
    return createServerClockSync(serverTime);
  }, [serverTime]);

  useEffect(() => {
    elapsedRef.current = false;
  }, [serverTime, lineupDeadline]);

  const stableOnElapsed = useCallback(() => {
    onDeadlineElapsed?.();
  }, [onDeadlineElapsed]);

  useEffect(() => {
    if (!serverClock) {
      return undefined;
    }

    function tick() {
      const nowMs = getSyncedNowMs(serverClock);
      setSyncedNowMs(nowMs);

      if (
        lineupDeadline &&
        !elapsedRef.current &&
        isDeadlineElapsed({ lineupDeadline, syncedNowMs: nowMs })
      ) {
        elapsedRef.current = true;
        stableOnElapsed();
      }
    }

    tick();
    const timer = setInterval(tick, tickMs);
    return () => clearInterval(timer);
  }, [lineupDeadline, serverClock, stableOnElapsed, tickMs]);

  const countdown = lineupDeadline
    ? formatCountdownTo(lineupDeadline, syncedNowMs)
    : null;

  return {
    serverClock,
    syncedNowMs,
    countdown,
  };
}
