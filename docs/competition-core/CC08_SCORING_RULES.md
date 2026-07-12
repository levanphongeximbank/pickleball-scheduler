# CC-08 — Scoring Rules

ScoringRule fields: `scoringRuleId`, `scoringRuleVersion`, `winPoints`, `lossPoints`, `drawPoints`, `forfeitPoints`, `walkoverPoints`, `byePoints`, `completedMatchRequired`, `verifiedResultRequired`.

Default legacy group policy remains win=2, loss=1, forfeit=0 but is **not** hardcoded globally — each request carries explicit configuration.

Legacy group mapper reads `pointsConfig` from payload. Team mapper uses win=2/loss=1 defaults aligned with `teamStandingsEngine`.

Active tournaments continue using configured rules from payload mapping; canonical engine never overrides production config silently.
