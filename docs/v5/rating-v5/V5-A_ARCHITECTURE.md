# V5-A — Architecture

## Component diagram

```mermaid
flowchart TB
  subgraph client ["Client (input only)"]
    UI["Assessment UI / Match UI"]
    Guard["ratingPayloadGuard"]
    UI --> Guard
  end

  subgraph api ["Supabase RPC (security definer)"]
    RPC_A["rating_v5_submit_answer"]
    RPC_B["rating_v5_complete_assessment"]
    RPC_C["rating_v5_submit_match_result"]
    RPC_D["rating_v5_get_profile"]
  end

  subgraph engines ["Server engines (versioned)"]
    ASSESS["assessmentScoringEngine\nassessment-v5.0"]
    MATCH["matchEngine\nmatch-v5.0 — V5-D"]
    REL["reliabilityEngine\nreliability-v5.0"]
    DISPLAY["displayRatingResolver"]
    GATES["criticalGates"]
  end

  subgraph db ["PostgreSQL (append-only events)"]
    PROFILES["player_rating_profiles"]
    ASSESSMENTS["player_skill_assessments"]
    EVENTS["player_rating_events"]
    EVIDENCE["rating_evidence"]
    SNAPSHOTS["rating_snapshots"]
    REVIEW["rating_review_cases"]
    CAL["rating_calibration_versions"]
  end

  Guard --> RPC_A & RPC_B & RPC_C
  RPC_A --> ASSESS
  RPC_B --> ASSESS --> GATES --> REL --> DISPLAY --> PROFILES
  RPC_C --> MATCH --> EVENTS
  MATCH --> REL --> DISPLAY --> PROFILES
  EVIDENCE --> REL
  EVENTS --> SNAPSHOTS
  REVIEW --> EVENTS
  CAL --> ASSESS & MATCH & REL
```

## Data flow — assessment

```mermaid
sequenceDiagram
  participant U as Player
  participant G as Payload Guard
  participant R as RPC
  participant E as Scoring Engine
  participant D as DB

  U->>G: submit answer (questionId, answerIndex)
  G->>G: reject rating_mean, verified_rating, etc.
  G->>R: rating_v5_submit_answer
  R->>D: append raw answer
  R-->>U: next adaptive question
  U->>R: rating_v5_complete_assessment
  R->>E: scoreAssessment(answers)
  E->>E: skill vector + gates
  R->>D: INSERT assessment (computed fields)
  R->>D: UPSERT profile (provisional only)
  Note over D: verified_rating_mean untouched
```

## Rating lifecycle

```mermaid
stateDiagram-v2
  [*] --> not_assessed
  not_assessed --> self_assessed: questionnaire complete
  self_assessed --> provisional: scoring + gates
  provisional --> projected: first valid match
  projected --> match_calibrated: open track updates
  match_calibrated --> verified: evidence level 4–5
  verified --> reliable: reliability >= 70
  reliable --> stable: reliability >= 85 + consistency
  provisional --> under_review: gate 4.5+ or anomaly
  under_review --> coach_verified: coach/court evidence
  coach_verified --> verified
  any --> suspended: anomaly hold
  any --> overridden: admin override + audit
```

## Evidence flow

| Level | Source | Updates open? | Updates verified? |
|------:|--------|:-------------:|:-----------------:|
| 0 | None | — | — |
| 1 | Self assessment | prior only | — |
| 2 | Unverified external | yes | — |
| 3 | Player confirmed | yes | — |
| 4 | Club/coach/court | yes | yes |
| 5 | Pick_VN tournament | — | yes |

## Match update flow (V5-D design)

```mermaid
flowchart LR
  M[Match result input] --> ELIG[Eligibility check]
  ELIG --> EXP[Expected point share]
  EXP --> TEAM[Team strength at T]
  TEAM --> DELTA[Per-player delta by uncertainty]
  DELTA --> EVT[Append rating_event]
  EVT --> TRACK{Evidence level}
  TRACK -->|1-3| OPEN[open_rating_mean]
  TRACK -->|4-5| VER[verified_rating_mean]
  OPEN & VER --> DISP[display_rating resolver]
  DISP --> REL[reliability_score]
```

## ADRs

| ADR | Decision |
|-----|----------|
| [ADR-001](adr/ADR-001-server-authoritative-rating.md) | Server computes all canonical rating values |
| [ADR-002](adr/ADR-002-open-verified-tracks.md) | Separate open and verified rating tracks |
| [ADR-003](adr/ADR-003-singles-doubles-profiles.md) | Independent singles/doubles profiles per tenant+player |
| [ADR-004](adr/ADR-004-continuous-rating-scale.md) | 1.5–6.0 internal mean; display rounds to 0.1 only |
| [ADR-005](adr/ADR-005-v2-coexistence.md) | V2 tables frozen; no auto-migration |

## Foundation tables (9/9)

Canonical registry: [`V5-FOUNDATION_9_TABLES.md`](./V5-FOUNDATION_9_TABLES.md)
