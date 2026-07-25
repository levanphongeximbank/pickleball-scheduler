# COMMS-ACT-04 — Manager/owner predicate equivalence

**Recorded:** 2026-07-25  
**Target:** Staging `qyewbxjsiiyufanzcjcq`  
**Scope:** Club SELECT certification identity strategy (no membership mutation)

## Question

Does Club manager/owner require a distinct Communication SELECT predicate from a regular active member?

## Answer

**No.** Club SELECT uses the same canonical helper for all Club members:

`public.phase42_active_club_member_id(p_club_id text)`

Source: `docs/v5/PHASE_42C_RLS_RPC.sql`

```sql
select cm.id
from public.club_members cm
where cm.club_id = p_club_id
  and cm.user_id = auth.uid()
  and cm.status = 'active'
limit 1;
```

ACT-03 wrappers (`communication_auth_is_active_club_member`, `communication_auth_can_select_club_conversation`) call this helper only. They do **not** inspect:

- `club_members.membership_type`
- `club_governance_assignments.role_code`
- `club_managers` (table absent / unused)

## Staging observation

| Fact | Value |
|------|-------|
| Sampled `membership_type` | `regular` only |
| Active governance roles present | `club_owner`, `president` (separate table) |
| Communication SELECT dependency | active `club_members` row only |

## Certification method (authorized)

Because predicates are identical:

1. Structural policy equivalence  
2. SQL dependency evidence (this note + ACT-03 package)  
3. Active-member runtime SELECT after Owner apply  

**Blocked alternative (not used):** mutate membership role/type to synthesize a manager/owner identity.

## Verdict

`MANAGER_OWNER_EQUIVALENT_TO_ACTIVE_MEMBER` — no fixture blocker.
