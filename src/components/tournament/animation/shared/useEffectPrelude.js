import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getPreludeMessageAtProgress,
  getPreludeProgressPercent,
  resolveEffectPreludePreset,
} from "./effectPreludeConfig.js";
import { playTickSound } from "./tournamentSounds.js";

export function useEffectPrelude({
  presetKey,
  context = {},
  active = false,
  onComplete,
}) {
  const contextScalars = useMemo(
    () => ({
      playerCount: context.playerCount ?? 0,
      courtCount: context.courtCount ?? 0,
      matchCount: context.matchCount ?? 0,
      groupCount: context.groupCount ?? 0,
    }),
    [context.playerCount, context.courtCount, context.matchCount, context.groupCount]
  );

  const preset = useMemo(
    () => (presetKey ? resolveEffectPreludePreset(presetKey, contextScalars) : null),
    [presetKey, contextScalars]
  );

  const durationSec = preset?.durationSec ?? 0;
  const [secondsLeft, setSecondsLeft] = useState(durationSec);
  const [running, setRunning] = useState(false);
  const completedRef = useRef(false);

  const progressPercent = getPreludeProgressPercent(durationSec, secondsLeft);
  const { text: statusText, badge: activeBadge } = getPreludeMessageAtProgress(
    preset?.messages,
    progressPercent
  );

  const badges = useMemo(() => {
    if (!preset?.messages?.length) {
      return [];
    }

    return preset.messages.map((message, index) => ({
      key: `badge-${index}`,
      label: message.badge || message.text,
      tone: message.badge === activeBadge || message.text === statusText ? "active" : "default",
    }));
  }, [preset?.messages, activeBadge, statusText]);

  const finish = useCallback(() => {
    if (completedRef.current) {
      return;
    }

    completedRef.current = true;
    setRunning(false);
    onComplete?.();
  }, [onComplete]);

  const skip = useCallback(() => {
    if (!preset?.skippable) {
      return;
    }

    setSecondsLeft(0);
    finish();
  }, [preset?.skippable, finish]);

  useEffect(() => {
    if (!active || !preset) {
      completedRef.current = false;
      setRunning(false);
      return;
    }

    completedRef.current = false;
    setSecondsLeft(durationSec);
    setRunning(true);
  }, [active, preset, durationSec, presetKey]);

  useEffect(() => {
    if (!running || !active || !preset) {
      return undefined;
    }

    if (secondsLeft <= 0) {
      finish();
      return undefined;
    }

    if (preset.playTick) {
      playTickSound();
    }

    const timer = setTimeout(() => {
      setSecondsLeft((value) => value - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [running, active, preset, secondsLeft, finish]);

  return {
    preset,
    secondsLeft,
    durationSec,
    progressPercent,
    statusText,
    activeBadge,
    badges,
    running,
    skip,
    skippable: preset?.skippable !== false,
  };
}
