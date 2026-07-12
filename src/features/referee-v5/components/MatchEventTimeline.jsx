import { buildTimelineEntries } from "../selectors/timelineSelector.js";

export default function MatchEventTimeline({ eventHistory = [], domainEventsBySequence = {} }) {
  const entries = buildTimelineEntries(eventHistory, domainEventsBySequence);

  return (
    <section className="rv5-timeline" aria-label="Lịch sử sự kiện" data-testid="match-event-timeline">
      {entries.length === 0 ? (
        <p className="rv5-timeline-item">Chưa có sự kiện.</p>
      ) : (
        entries.map((entry) => (
          <div
            key={entry.id}
            className={`rv5-timeline-item ${entry.reverted ? "reverted" : ""}`}
            data-testid={`timeline-${entry.eventType}`}
          >
            #{entry.sequence} · {entry.label}
          </div>
        ))
      )}
    </section>
  );
}
