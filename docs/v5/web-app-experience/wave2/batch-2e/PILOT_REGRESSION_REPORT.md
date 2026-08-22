# BATCH 2E — PILOT REGRESSION REPORT

**PR:** #464  
**PRE_HEAD:** `3b4523ef9c2129417d28c33b2b1e3412727e53a2`

## Functional parity

| Pilot | Route | Permission | Data source | Mutations | Filters | Actions | States |
|-------|-------|------------|-------------|-----------|---------|---------|--------|
| Dashboard | unchanged | unchanged | unchanged | n/a | time filter semantics unchanged | unchanged | empty/loading/error meanings preserved |
| Players | unchanged | unchanged | unchanged | delete confirm UI only | filter values unchanged | unchanged | empty/loading preserved; Tournament empty removed |
| Audit | unchanged | unchanged | unchanged | n/a | action filter unchanged | unchanged | empty via AuthResponsiveDataView |
| Courts | unchanged | unchanged | unchanged | delete dialog unchanged | n/a | unchanged | empty via AuthEmptyState |

```
PILOT_FUNCTIONAL_PARITY=PASS
FILTER_QUERY_SEMANTICS_CHANGED=NO
DATA_FIELD_LOSS_COUNT=0
STATE_SEMANTICS_COLLAPSED=NO
DOMAIN_STATUS_LOGIC_MOVED_TO_SHARED=NO
DATAGRID_ADOPTED=NO
CONFIRM_MUTATION_SEMANTICS_CHANGED=NO
NOTIFICATION_DOMAIN_CHANGED=NO
```

## Wave 6 gaps

```
W6_PAGE_001_STATUS=REMAINS_WAVE6
W6_PAGE_002_STATUS=CLOSED_BY_2E_PILOT
```

W6-PAGE-001 (`CourtCalendarWeekMatrix.minWidth900`) not in pilot set.  
W6-PAGE-002 (Audit dense nowrap detail) closed by AuthResponsiveDataView desktop/mobile without field loss.

## Freeze

```
WAVE1_SHELL_CHANGED=NO
TOURNAMENT_23_CHANGED=NO
PUBLIC_WEB_CHANGED=NO
BACKEND_CHANGED=NO
DATABASE_CHANGED=NO
AUTHORIZATION_CHANGED=NO
DOMAIN_AUTHORITY_CHANGED=NO
```
