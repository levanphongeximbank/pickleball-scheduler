# COMMS-ACT-05 — Authorization Matrix

## DIRECT (trusted backend only)

| Case | Result |
|------|--------|
| Authenticated participant send / open / mark-read | ALLOW (after JWT + participant checks) |
| Sender spoof (`senderParticipantId` ≠ auth.uid()) | DENY |
| Unrelated user (not participant) | DENY |
| Cross-tenant forgery via body tenantId | Ignored for authority; pair membership rules apply |
| Inactive identity | DENY |

## SYSTEM (trusted producer only)

| Case | Result |
|------|--------|
| `COMMS_SYSTEM_PRODUCER_KEY` + allowlisted `source` | ALLOW |
| Browser JWT without producer key | DENY (`SYSTEM_BROWSER_INVOCATION_DENIED`) |
| Sender spoof to end-user id | DENY |
| Unknown source | DENY |
| Idempotent retry same key | Replay prior result |

## CLUB

| Case | Path | Result |
|------|------|--------|
| SELECT messages/channels/cursors | Client RLS (ACT-04) | Active member ALLOW |
| Send GENERAL message | Trusted backend | Active member ALLOW |
| Pin / unpin / participant admin / announcement send | Trusted backend | Manager/owner (`club_owner`/`president`/`vice_president` or manager membership_type) ALLOW; regular member DENY |
| Inactive / removed member write | Trusted backend | DENY |
| Cross-club channel | Trusted backend | DENY (channel club mismatch / membership) |
| Report club message | Trusted backend | Active member ALLOW |

## COMMUNITY

All client and trusted-backend Community commands: **BLOCKED_FAIL_CLOSED**.

## REALTIME

Publication rows remain **0**. Subscribe returns manual-refresh only.
