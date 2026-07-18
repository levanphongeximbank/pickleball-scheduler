# 01 — Integration Test Matrix

| Format | Contract | Validator | DTO | Mapping | Port compatibility |
|--------|----------|-----------|-----|---------|-------------------|
| Team → Participant | ✅ | ✅ | ✅ | ✅ | ✅ in-memory |
| Team → Team | ✅ | ✅ | ✅ | ✅ | ✅ |
| Team → Roster | ✅ | ✅ | ✅ | ✅ | ✅ + saveRevision |
| Team → Lineup | ✅ | ✅ | ✅ | ✅ | ✅ + saveRevision |
| Team → Registration | ✅ | ✅ | ✅ | ✅ | ✅ |
| Individual → Participant | ✅ | ✅ | ✅ | ✅ | ✅ |
| Individual → Entry | ✅ | ✅ | ✅ | ✅ | ✅ |
| Individual → Classification | ✅ | ✅ | ✅ | ✅ | ✅ |
| Daily → Participant | ✅ | ✅ | — | ✅ | ✅ |
| Daily → Session | ✅ | — | — | ✅ (no Entry) | — |
| Daily → Temporary Pair | ✅ | — | — | ✅ | — |
| Internal → Registration/Entry | ✅ | ✅ | ✅ | ✅ | ✅ |
| Official → Registration/Entry/Seed | ✅ | ✅ | ✅ | ✅ | ✅ |

Evidence: `tests/competition-core-participants-2b4-integration.test.js`
