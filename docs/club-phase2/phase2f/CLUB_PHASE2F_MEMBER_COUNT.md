# Club Phase 2F — Member Count Certification

## Sources

| Surface | Source | Transform |
|---------|--------|-----------|
| Home summary | `resolveMyClubHomeMemberCount({ clubSummary, clubStats })` | V2: cloud summary `memberCount` / `activeMemberCount`; not local extension |
| Org Chart | `clubRecord.activeMemberCount` under V2 | Number or 0 |
| Discover cards | list RPC `activeMemberCount` | Direct |
| Manage/Platform lists | registry `memberCount` ← `active_member_count` | Map |
| Read model | `club.activeMemberCount` → `active_member_count` | Number |
| Officer uniqueness | `countUniqueActiveGovernancePersons` | **Separate** from member total |

## Rules verified (CODE_CERTIFIED)

| Rule | Result |
|------|--------|
| Canonical active-member count | PASS |
| Excludes left/removed (manage count helper) | PASS |
| Does not add/subtract Owner/President manually | PASS |
| Owner=President not double-counted as members | PASS (officers ≠ member total) |
| VPs not double-counted in member total | PASS |
| Empty → 0 | PASS |
| Filter does not rewrite server total incorrectly | PASS (filter is view-only) |

Home vs Members list: Home uses summary count; Members list shows rows — totals must match cloud active set (Staging smoke FU-2F-1).
