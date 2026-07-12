import { DOMAIN_EVENT_TYPE, MATCH_EVENT_TYPE } from "../constants/eventTypes.js";

const DOMAIN_LABELS = Object.freeze({
  [DOMAIN_EVENT_TYPE.POINT_AWARDED]: "Point awarded",
  [DOMAIN_EVENT_TYPE.PLAYERS_SWITCHED]: "Players switched",
  [DOMAIN_EVENT_TYPE.SECOND_SERVER_ACTIVATED]: "Second server activated",
  [DOMAIN_EVENT_TYPE.SIDE_OUT]: "Side-out",
  [DOMAIN_EVENT_TYPE.SERVE_CHANGED]: "Serve changed",
  [DOMAIN_EVENT_TYPE.ENDS_SWITCHED]: "Ends switched",
  [DOMAIN_EVENT_TYPE.GAME_COMPLETED]: "Game completed",
  [DOMAIN_EVENT_TYPE.MATCH_COMPLETED]: "Match completed",
  RALLY_WON: "Rally won",
  [MATCH_EVENT_TYPE.START_MATCH]: "Match started",
  [MATCH_EVENT_TYPE.SWITCH_ENDS]: "Ends switched",
  [MATCH_EVENT_TYPE.EVENT_REVERTED]: "Event reverted",
  [MATCH_EVENT_TYPE.PAUSE_MATCH]: "Match paused",
  [MATCH_EVENT_TYPE.RESUME_MATCH]: "Match resumed",
  [MATCH_EVENT_TYPE.START_TIMEOUT]: "Timeout started",
  [MATCH_EVENT_TYPE.END_TIMEOUT]: "Timeout ended",
});

export function labelDomainEvent(eventType) {
  return DOMAIN_LABELS[eventType] || eventType;
}

export function buildTimelineEntries(eventHistory = [], domainEventsBySequence = {}) {
  const entries = [];

  for (const event of eventHistory) {
    entries.push({
      id: event.eventId || `${event.sequence}-${event.eventType}`,
      sequence: event.sequence,
      eventType: event.eventType,
      label: labelDomainEvent(event.eventType),
      reverted: event.eventType === MATCH_EVENT_TYPE.EVENT_REVERTED,
      payload: event.payload || {},
    });

    const domainEvents = domainEventsBySequence[event.sequence] || [];
    for (const domainEvent of domainEvents) {
      if (domainEvent === "RALLY_WON") {
        continue;
      }
      entries.push({
        id: `${event.sequence}-domain-${domainEvent}`,
        sequence: event.sequence,
        eventType: domainEvent,
        label: labelDomainEvent(domainEvent),
        reverted: false,
        isDomain: true,
      });
    }
  }

  return entries.slice(-10);
}
