# COMMS-ACT-03 — Canonical Membership Dependency Map

## Identity

| Concern | Canonical source |
|---------|------------------|
| User id | `auth.uid()` |
| Profile | `public.profiles` |
| Tenant/venue | `public.user_venue_id()` → `venues.id` (= `tenant_id`) |
| Not authority | localStorage, UI gates, client-supplied tenant/club alone |

## Club

| Concern | Canonical source |
|---------|------------------|
| Membership table | `public.club_members` |
| Active predicate | `status = 'active'` |
| Inactive | `left`, `removed` |
| SQL helper | `public.phase42_active_club_member_id(p_club_id text)` |
| Helper traits | `SECURITY DEFINER`, `search_path = public` |
| Communication wrapper | `public.communication_auth_is_active_club_member(text)` |
| Governance | `club_governance_assignments` — **not** required for baseline Club SELECT |
| Invented by Communication? | **No** |

Evidence: `docs/v5/PHASE_42C_RLS_RPC.sql`, Club V2 RPCs (`club_list_members`, `club_get_my_active_membership`), runtime Club UI.

## Community

| Concern | Status |
|---------|--------|
| Membership table | **Not published** |
| SQL helper | **null** (`ACTIVATION_BLOCKER`) |
| Communication owns | restrictions table + conversation participants only |
| Client RLS | **BLOCKED_FAIL_CLOSED** |

## Tenant boundary

```
venues.id === tenant_id
  └── clubs.tenant_id
        └── club_members.tenant_id
```

Cross-tenant / cross-club / cross-community → **DENY**.
