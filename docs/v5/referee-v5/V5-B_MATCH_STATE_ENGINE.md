# Referee V5-B — Match State Engine

## State shape

Minimal authoritative state (no screen/CSS derivatives):

```javascript
{
  matchId, matchType, status, version,
  scoringFormat, bestOf, pointsToWin, winBy, maximumScore,
  currentGameNumber,
  teams: {
    teamA: { teamId, courtEnd, score, players: [{ playerId, logicalServiceSide }] },
    teamB: { ... }
  },
  servingTeamId, servingPlayerId,
  receivingTeamId, receivingPlayerId,
  serverNumber,          // null for singles
  games, lastEventSequence
}
```

## Initialization

`initializeMatchState(config)` validates:

- Two distinct teams, no duplicate players
- Singles: 1 player/team; Doubles: 2 players/team with left+right sides
- Teams on opposite court ends
- First server belongs to first serving team
- Receiver resolved by engine (not UI)

## Event application

`applyMatchEvent(state, event, config)` accepts:

```javascript
{ eventId, eventType, sequence, expectedVersion, actorId, payload }
```

Supported client events:

| Event | Behavior |
|-------|----------|
| `START_MATCH` | `NOT_STARTED` → `IN_PROGRESS` |
| `TEAM_A_WON_RALLY` / `TEAM_B_WON_RALLY` | Delegates to side-out / rally / singles engine |
| `SWITCH_ENDS` | Swaps `courtEnd` only |
| `START_TIMEOUT` / `END_TIMEOUT` | Version bump (placeholder) |
| `DECLARE_FORFEIT` | Marks completed |

Rejects: version conflict, sequence gap, locked match, invalid preconditions.

Returns:

```javascript
{ ok, nextState, generatedEvents, domainWarnings }
```

## Replay

`rebuildMatchState(initialState, events)` replays event list deterministically.  
`statesEqual(a, b)` compares authoritative fields for test parity.

## Undo

`undoLastEvent()` rebuilds from history minus last applicable event and appends `EVENT_REVERTED`. Does not delete prior events.
