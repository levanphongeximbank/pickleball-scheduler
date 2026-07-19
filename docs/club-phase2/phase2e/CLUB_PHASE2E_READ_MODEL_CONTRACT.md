# Club Phase 2E — Normalized Read-Model Contract

## Shape

```js
{
  club_id,
  tenant_id,
  club_version,
  owner: Person | null,
  president: Person | null,
  vice_presidents: Person[], // ordered, max 2
  source: {
    provider, // "v2-rpc" | "legacy-registry"
    authority: "club_governance_assignments",
    membership_authority: "club_members",
    profile_authority: "profiles_display_only",
    ignored: { profiles_club_id: true, legacy_blob_roles: true under V2 }
  },
  labels: { ownerLabel, presidentLabel, vicePresidentLabel, vicePresidentLabels, combinedOwnerPresident },
  unique_active_officer_count,
  active_member_count
}
```

### Person

```js
{
  user_id,
  membership_id,
  display_name,
  avatar_url,
  membership_status,
  profile_missing,
  stale_reference, // inactive/removed/left
  display_label    // VN-safe; never raw UUID fragment under V2
}
```

## Labels (Vietnamese)

| Key | Label |
|-----|-------|
| owner | Chủ sở hữu |
| president | Chủ tịch |
| vice_president | Phó chủ tịch |
| owner_and_president | Chủ sở hữu & Chủ tịch |
| unassigned | Chưa gán |
| missing profile | Chưa có thông tin |
| no VP | — |

## States

| State | UI |
|-------|-----|
| loading | Spinner / “Đang tải thông tin quản trị…” |
| ready | Show labels |
| no president | `Chưa gán` |
| no VP | `—` |
| missing profile | `Chưa có thông tin` |
| inactive referenced | `stale_reference` + missing label |
| error | Alert + retry |
| version conflict | Refetch; do not keep pre-mutation officers |

## Rules

- Membership = eligibility; assignments = authority; profile = display-only.
- Same person as Owner+President → one combined label; unique officer count = 1 for that person.
- `active_member_count` comes from canonical club payload — not inflated by officer slots.
