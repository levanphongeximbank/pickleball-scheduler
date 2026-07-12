import { useCallback, useMemo, useRef, useState } from "react";

import { MATCH_EVENT_TYPE, MATCH_STATUS } from "../constants/eventTypes.js";
import { dispatchMatchCommand } from "../engines/matchCommandDispatcher.js";
import { initializeMatchState } from "../engines/initializeMatchState.js";
import { rebuildMatchState } from "../engines/stateReplayEngine.js";
import { getFixtureById } from "../prototype/refereeV5PrototypeFixtures.js";

function buildCommand(state, eventType, actorId = "referee-prototype") {
  return {
    eventId: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    eventType,
    sequence: Number(state.lastEventSequence || 0) + 1,
    expectedVersion: Number(state.version || 0),
    actorId,
    payload: {},
  };
}

function applyPreEvents(initialState, preEventTypes = []) {
  let state = initialState;
  let history = [];
  const domainLog = {};

  for (const eventType of preEventTypes) {
    const command = buildCommand(state, eventType);
    const result = dispatchMatchCommand({
      state,
      command,
      history,
      initialState,
    });
    if (!result.ok) {
      break;
    }
    domainLog[command.sequence] = result.generatedEvents || [];
    state = result.nextState;
    history = result.eventHistory;
  }

  return { state, history, domainLog };
}

export function useRefereeMatchController(initialFixtureId = "doubles-side-out-0-0-2") {
  const fixtureRef = useRef(getFixtureById(initialFixtureId));

  function bootFromFixture(fixture) {
    const init = initializeMatchState(fixture.config);
    if (!init.ok) {
      return { ok: false, errors: init.errors };
    }

    let state = init.state;
    let history = [];
    let domainLog = {};

    if (fixture.preEvents?.length) {
      const applied = applyPreEvents(init.state, fixture.preEvents);
      state = applied.state;
      history = applied.history;
      domainLog = applied.domainLog;
    }

    return {
      ok: true,
      initialState: init.state,
      state,
      history,
      domainLog,
      meta: fixture.meta,
      fixtureId: fixture.id,
    };
  }

  const boot = bootFromFixture(fixtureRef.current);
  if (!boot.ok) {
    throw new Error(boot.errors.join(", "));
  }

  const [fixtureId, setFixtureId] = useState(boot.fixtureId);
  const [meta, setMeta] = useState(boot.meta);
  const [initialState, setInitialState] = useState(boot.initialState);
  const [state, setState] = useState(boot.state);
  const [eventHistory, setEventHistory] = useState(boot.history);
  const [domainEventsBySequence, setDomainEventsBySequence] = useState(boot.domainLog);
  const [lastError, setLastError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeoutActive, setTimeoutActive] = useState(false);

  const loadFixture = useCallback((nextFixtureId, options = {}) => {
    const fixture = getFixtureById(nextFixtureId);
    fixtureRef.current = fixture;
    const nextBoot = bootFromFixture(fixture);
    if (!nextBoot.ok) {
      setLastError(nextBoot.errors.join(", "));
      return { ok: false, errors: nextBoot.errors };
    }

    let nextState = nextBoot.state;
    let history = nextBoot.history;
    let domainLog = nextBoot.domainLog;

    if (options.applyPreEvents === false) {
      nextState = nextBoot.initialState;
      history = [];
      domainLog = {};
    }

    setFixtureId(nextFixtureId);
    setMeta(fixture.meta);
    setInitialState(nextBoot.initialState);
    setState(nextState);
    setEventHistory(history);
    setDomainEventsBySequence(domainLog);
    setLastError("");
    setTimeoutActive(false);
    return { ok: true };
  }, []);

  const resetFixture = useCallback(() => {
    return loadFixture(fixtureId, { applyPreEvents: true });
  }, [fixtureId, loadFixture]);

  const dispatch = useCallback(
    async (eventType) => {
      if (isProcessing) {
        return { ok: false, error: "BUSY" };
      }

      setIsProcessing(true);
      setLastError("");

      const command = buildCommand(state, eventType);
      const result = dispatchMatchCommand({
        state,
        command,
        history: eventHistory,
        initialState,
      });

      setIsProcessing(false);

      if (!result.ok) {
        setLastError(result.error || result.code);
        return result;
      }

      setState(result.nextState);
      setEventHistory(result.eventHistory);

      if (result.generatedEvents?.length) {
        setDomainEventsBySequence((prev) => ({
          ...prev,
          [command.sequence]: result.generatedEvents,
        }));
      }

      if (eventType === MATCH_EVENT_TYPE.START_TIMEOUT) {
        setTimeoutActive(true);
      }
      if (eventType === MATCH_EVENT_TYPE.END_TIMEOUT) {
        setTimeoutActive(false);
      }

      return result;
    },
    [eventHistory, initialState, isProcessing, state]
  );

  const rebuildFromHistory = useCallback(() => {
    const rebuilt = rebuildMatchState(initialState, eventHistory);
    if (rebuilt.ok) {
      setState(rebuilt.state);
    }
    return rebuilt;
  }, [eventHistory, initialState]);

  const canUndo = useMemo(
    () =>
      eventHistory.some((event) => event.eventType !== MATCH_EVENT_TYPE.EVENT_REVERTED) &&
      state.status !== MATCH_STATUS.LOCKED,
    [eventHistory, state.status]
  );

  const actionsDisabled =
    isProcessing ||
    state.status === MATCH_STATUS.LOCKED ||
    state.status === MATCH_STATUS.COMPLETED;

  return {
    state,
    initialState,
    eventHistory,
    domainEventsBySequence,
    meta,
    fixtureId,
    lastError,
    isProcessing,
    timeoutActive,
    canUndo,
    actionsDisabled,
    dispatch,
    loadFixture,
    resetFixture,
    rebuildFromHistory,
    setLastError,
  };
}
