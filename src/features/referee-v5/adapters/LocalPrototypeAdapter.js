import { MATCH_EVENT_TYPE } from "../constants/eventTypes.js";
import { dispatchMatchCommand } from "../engines/matchCommandDispatcher.js";
import { initializeMatchState } from "../engines/initializeMatchState.js";
import { getFixtureById } from "../prototype/refereeV5PrototypeFixtures.js";

function buildLocalCommand(state, eventType, actorId = "referee-prototype") {
  return {
    eventId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    eventType,
    sequence: Number(state.lastEventSequence || 0) + 1,
    expectedVersion: Number(state.version || 0),
    actorId,
    payload: {},
  };
}

/**
 * Local prototype adapter — no database, uses V5-B engine in-memory.
 */
export class LocalPrototypeAdapter {
  constructor(fixtureId = "doubles-side-out-0-0-2") {
    this.fixtureId = fixtureId;
    this.reset(fixtureId);
  }

  reset(fixtureId = this.fixtureId) {
    const fixture = getFixtureById(fixtureId);
    const init = initializeMatchState(fixture.config);
    if (!init.ok) {
      throw new Error(init.errors.join(", "));
    }
    this.fixture = fixture;
    this.initialState = init.state;
    this.state = init.state;
    this.eventHistory = [];
    this.domainEventsBySequence = {};
    this.meta = fixture.meta;

    for (const eventType of fixture.preEvents || []) {
      this.dispatchCommand({ commandType: eventType });
    }
  }

  async loadMatch() {
    return {
      ok: true,
      state: this.state,
      stateVersion: this.state.version,
      lastEventSequence: this.state.lastEventSequence,
      recentEvents: this.eventHistory.slice(-10),
      meta: this.meta,
    };
  }

  async dispatchCommand({ commandType, actorId }) {
    const command = buildLocalCommand(this.state, commandType, actorId);
    const result = dispatchMatchCommand({
      state: this.state,
      command,
      history: this.eventHistory,
      initialState: this.initialState,
    });
    if (result.ok) {
      this.state = result.nextState;
      this.eventHistory = result.eventHistory;
      if (result.generatedEvents?.length) {
        this.domainEventsBySequence[command.sequence] = result.generatedEvents;
      }
    }
    return result;
  }

  async reloadState() {
    return this.loadMatch();
  }

  async finalizeResult() {
    return { ok: false, code: "NOT_SUPPORTED", error: "Prototype adapter không finalize." };
  }
}

export { MATCH_EVENT_TYPE };
