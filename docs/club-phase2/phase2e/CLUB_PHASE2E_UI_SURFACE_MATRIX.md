# Club Phase 2E — UI Surface Matrix

| Surface | Route | Read path | Display |
|---------|-------|-----------|---------|
| Club Home | `/my-club` | `useGovernanceReadModel` | Summary president/owner |
| My Club Governance | `/my-club` (manage) | club seed + display labels | Assignment panel |
| Org Chart | `/my-club?view=schedule` | `getGovernanceDisplayLabels` → read model | Mini cards |
| Member list | `/my-club?view=members` | `club_list_members` + canonical role labels | `GovernanceRoleChip` |
| Manage Overview | `/manage/clubs/:id` | `useGovernanceReadModel` in `ClubGovernancePanel` | Owner/Pres/VP |
| Manage Members | `/manage/clubs/:id` members | `governanceRoles` codes | Role column |
| Discover | `/discover-clubs` | list RPC labels | ClubCard president line |
| Platform clubs | `/platform/clubs` | registry stats `presidentName` | Column |

## Loading / error

- Home + Management: explicit loading and error+retry from hook state.
- Mutation success / `VERSION_CONFLICT`: `refreshAll` / `reload` — no infinite loop (explicit only).
