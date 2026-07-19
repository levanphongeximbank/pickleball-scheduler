# Club Phase 2F — Canonical Binding Matrix

| Surface | Canonical model | profiles.club_id | Legacy blob roles | Direct gov table UI read | Second mapper | localStorage SoT | Profile display-only | Cross-tenant block | Evidence |
|---------|-----------------|------------------|-------------------|--------------------------|---------------|------------------|----------------------|--------------------|----------|
| S1 Home | Yes `useGovernanceReadModel` | Ignored | Ignored under V2 | No | No | No | Yes | Yes (read service) | CODE |
| S3 My Club Gov | Yes hook (fixed 2F) | Ignored | Ignored | No | No | No | Yes | Yes | CODE |
| S4 Org Chart | Yes hook (fixed 2F) | Ignored | Ignored | No | No | No | Yes | Yes | CODE |
| S5 Members | Yes role resolver | N/A | Codes mapped canonically | No | Deprecated wrapper only | No | Yes | N/A list RPC | CODE |
| S6 Manage Overview | Yes hook | Ignored | Ignored | No | No | No | Yes | Yes | CODE |
| S7 Manage Members | Yes resolver + chips (fixed 2F) | N/A | No raw enums | No | No | No | Safe name fallback | N/A | CODE |
| S8 Discover V2 | List RPC labels | N/A | N/A | No | No | No | Labels from RPC | Server RPC | CODE |
| S8 Discover OFF | hints + display labels | — | LEGACY path | No | Helper | Local registry | Hints | Client | CODE |
| S9–S10 Lists | Registry RPC labels | N/A | N/A | No | Map only | No | Labels | Server | CODE |

**Result:** All Production detail/management surfaces are **CANONICAL** after Phase 2F fixes. List cards remain **PARTIALLY_CANONICAL** (acceptable parallel list RPC).
