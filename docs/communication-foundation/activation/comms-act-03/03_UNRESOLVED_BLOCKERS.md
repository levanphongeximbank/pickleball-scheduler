# COMMS-ACT-03 — Unresolved Blockers

| ID | Status | Detail |
|----|--------|--------|
| COMMUNITY_MEMBERSHIP_SQL_HELPER | BLOCKED_FAIL_CLOSED | Platform has not published Community membership/moderation SQL helper. |
| DIRECT_CLIENT_RLS | TRUSTED_BACKEND_ONLY | Architecture default; participant client policy deferred. |
| SYSTEM_CLIENT_RLS | TRUSTED_BACKEND_ONLY | Hard default. |
| CLIENT_WRITES | TRUSTED_BACKEND_ONLY | Send/edit/delete/participant admin/pin mutate stay backend. |
| REALTIME_PUBLICATION | BLOCKED_FAIL_CLOSED | Not enabled in ACT-03. |
| STAGING_APPLY_OWNER_GO | REQUIRED | Authored SQL not applied; remote still COMMS-05 deny-all. |
| PRODUCTION | BLOCKED | Untouched. |
| CLUB_MEMBERSHIP_RUNTIME_ADAPTER | OPEN | Communication runtime still lacks production `ClubMembershipReader` adapter wired to Club SoT (app-layer). Does not block authored Client RLS SQL, but blocks end-to-end Production messaging cutover. |

## Not blockers for ACT-03 authoring

- Canonical Club membership helper exists and is proven.
- COMMS-05 Staging deny-all baseline exists (ACT-02).
