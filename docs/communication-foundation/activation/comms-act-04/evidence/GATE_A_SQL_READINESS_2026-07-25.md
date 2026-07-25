# COMMS-ACT-04 — Gate A: Fresh-main & SQL readiness

**Recorded:** 2026-07-25 (local)  
**Verdict:** Gate A **PASS** · overall phase blocked on Gate B backup

## A. Worktree / branch / main

| Check | Result |
|-------|--------|
| Worktree | `C:\Users\Le Phong\PICK_VN-Workstreams\communication-foundation\comms-act-04-staging-club-select-rls` |
| Branch | `ops/communication-foundation-comms-act-04-staging-club-select-rls` |
| HEAD | `7f1a0fbda4ec797716eabf4914205a886aa2a3e2` |
| `origin/main` (fetched) | `7f1a0fbda4ec797716eabf4914205a886aa2a3e2` |
| Ancestor of `origin/main` | yes (`merge-base --is-ancestor` exit 0) |
| Working tree porcelain | clean at Gate A start |
| `package.json` / `package-lock.json` | unchanged |

## B. Forward SQL inventory

| Field | Value |
|-------|-------|
| Path | `docs/supabase-communication-comms-act-03-authorization-client-rls.sql` |
| WINDOWS_APPLY_RAW_BYTES | `13173` |
| WINDOWS_APPLY_RAW_SHA256 | `4e4a19947bde5db8bc78b135b353b4c694e37bc975f926525c1389d2349a42b7` |
| REPOSITORY_CANONICAL_LF_BYTES | `12870` |
| REPOSITORY_CANONICAL_LF_SHA256 | `90b3ff7af7070b6709349cefd570d61f258449f3dc9d3908658b0df0acc65f26` |
| EOL_EQUIVALENCE_VERIFIED | `PASS` |
| SQL_SEMANTIC_DRIFT | `NO` |
| Manifest status | `PASS` (0 findings) |
| ACT-03 regression tests | 13/13 pass |

Gate A measured the Windows working-tree raw representation on this host (`core.autocrlf=true`). That raw binding was used for Owner apply history; repository/CI asserts canonical LF of the same SQL text.

### Exact capability opened (after Owner apply)

- Club SELECT Client RLS on 6 tables via 6 policies
- Narrow `GRANT SELECT` to `authenticated` on those 6 tables
- `GRANT EXECUTE` on 3 SELECT gate helpers to `authenticated`

**Policies:**

1. `communication_conversations_club_select`
2. `communication_participants_club_select`
3. `communication_messages_club_select`
4. `communication_reactions_club_select`
5. `communication_pinned_messages_club_select`
6. `communication_read_cursors_club_own_select`

**Select grant tables:**

- `communication_conversations`
- `communication_conversation_participants`
- `communication_messages`
- `communication_message_reactions`
- `communication_pinned_messages`
- `communication_read_cursors`

**Helpers / dependency:**

- Prerequisite: `public.phase42_active_club_member_id(text)` (raise if missing)
- `communication_auth_uid_text`
- `communication_auth_is_active_club_member`
- `communication_auth_can_select_club_conversation`
- Immutable update triggers on conversations / messages / participants

### Exact capability remaining denied

- Direct / System / Community client SELECT open policies
- All client INSERT / UPDATE / DELETE table grants
- Club participant admin / moderation / reports client access
- RPC execute: `communication_allocate_message_position`, `communication_advance_read_cursor`
- Realtime publication mutation
- Production

### Forbidden-pattern scan (forward)

| Pattern | Result |
|---------|--------|
| Client INSERT/UPDATE/DELETE grants | none (comment-only mentions) |
| `GRANT ALL` | none |
| `USING (true)` / `WITH CHECK (true)` | none |
| Community / Direct / System client SELECT policies | none |
| `alter publication supabase_realtime` | none (comment-only deny) |
| Production ref `expuvcohlcjzvrrauvud` | none |

## C. Rollback SQL inventory

| Field | Value |
|-------|-------|
| Path | `docs/supabase-communication-comms-act-03-authorization-client-rls-rollback.sql` |
| Bytes | `8808` |
| SHA256 | `63056ec8ce8140bf06671a1bbf3e375d728047630aeb8bd06a9aefe32a016de5` |

### Rollback behavior

| Property | Confirmed |
|----------|-----------|
| Data-preserving | yes (no `DROP TABLE`, no `DELETE FROM`) |
| Returns remote to deny-all | yes (14 deny-all policies restored) |
| Drops ACT-03 Club SELECT policies | yes (6) |
| Drops ACT-03 helpers + immutable triggers | yes |
| Revokes client table privileges | yes |
| Realtime untouched | yes |
| Does not open Production | yes |

## D. Gate A conclusion

SQL/rollback match ACT-03 certification. Safe to proceed to **Gate B fresh Staging backup**.

Does **not** authorize apply. Does **not** mutate remote.
