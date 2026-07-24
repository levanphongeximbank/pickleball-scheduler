# COMMS-ACT-01 — RLS Readiness Matrix

**Policy for Staging SQL apply (COMMS-05 package):** deny-all client RLS + trusted backend writers.  
**Do not** open permissive client policies in ACT-02 schema apply.

Verdict vocabulary:

| Verdict | Meaning |
|---------|---------|
| READY | Client policy path certified for activation |
| READY_BACKEND_TRUSTED_ONLY | Deny-all client; service-role/trusted backend OK after app authorization |
| BLOCKED_FAIL_CLOSED | Must remain deny-all / unavailable |

## Capability matrix

| Capability | Client verdict | Backend (post-apply) | Notes |
|------------|----------------|----------------------|-------|
| **Direct** | READY_BACKEND_TRUSTED_ONLY | READY_BACKEND_TRUSTED_ONLY | Participant-based client policy designed but deferred until Staging RLS review |
| **Club** | BLOCKED_FAIL_CLOSED | READY_BACKEND_TRUSTED_ONLY | Requires Owner-approved `phase42_active_club_member_id(club_id)` — `OWNER_APPROVAL_REQUIRED` |
| **Community** | BLOCKED_FAIL_CLOSED | READY_BACKEND_TRUSTED_ONLY | Membership SQL helper missing — `ACTIVATION_BLOCKER` |
| **report** | READY_BACKEND_TRUSTED_ONLY | READY_BACKEND_TRUSTED_ONLY | `communication_message_reports` deny-all |
| **moderation** | READY_BACKEND_TRUSTED_ONLY | READY_BACKEND_TRUSTED_ONLY | `communication_moderation_actions` deny-all |
| **attachments** | BLOCKED_FAIL_CLOSED | BLOCKED_FAIL_CLOSED | Storage bucket RLS deferred; refs only |
| **realtime subscription** | BLOCKED_FAIL_CLOSED | n/a | Publication not enabled; foundation authorize-before-subscribe only |

## Hard rules

1. No `USING (true)` / `WITH CHECK (true)`.
2. No client tenantId as authority.
3. No Club client RLS without Owner-approved membership helper reuse.
4. No Community client RLS without Platform membership/access SQL helper.
5. No permissive fallback “to make Staging work”.
6. Negative tests prepared before any future client RLS activation ([01_NEGATIVE_RLS_PACKAGE.md](./01_NEGATIVE_RLS_PACKAGE.md)).

## Code gates (unchanged)

From `src/features/communication/persistence/schema.js`:

- `CLIENT_RLS_POLICY = DEFERRED_FAIL_CLOSED`
- `CLUB_MEMBERSHIP_SQL_HELPER = OWNER_APPROVAL_REQUIRED`
- `COMMUNITY_MEMBERSHIP_SQL_HELPER = ACTIVATION_BLOCKER`

## Staging apply implication

ACT-02 may apply deny-all schema and exercise **trusted backend** smoke only.  
Opening client RLS is a **later gate**, not part of initial Staging SQL apply.
