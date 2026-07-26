# BM-FINAL-RATING-01 — Ownership Matrix

| Concern | Owner | Consumer | Forbidden |
|---------|-------|----------|-----------|
| Public Player Rating current state | Player Rating foundation | UI / Ranking read | Competing local writers |
| Rating history / snapshots | Foundation + V5 durable | Read facade | Local append-as-success |
| Verification / adjustment | Foundation write facade | V2 compatibility symbols | Club-blob verified write |
| Assessment draft | Local assessment store | Onboarding UI | Treating draft as SSOT |
| Competition Elo | Competition Engine | Competition only | Project as public rating |
| Ranking / VPR | Ranking domain | Reads rating if needed | Own Player Rating writes |
| Player identity FK | Player Management `playerId` | Rating identity adapter | athlete/member/participant as owner FK |
