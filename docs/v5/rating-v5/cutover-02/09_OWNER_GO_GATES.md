# CUTOVER-02 — Owner GO Gates

```text
STAGING_EXECUTION_GO=NO  # until every row below is evidenced PASS
```

| Gate | Required evidence |
|------|-------------------|
| Local implementation PASS | Code + docs on branch |
| Focused tests PASS | `tests/rating-v5-cutover-02-dual-read-writer-freeze.test.js` |
| Full unit PASS | `npm run test:unit` |
| Lint PASS | `npm run lint:no-new` |
| Build PASS | `npm run build` |
| Foundation lock PASS | `npm run ci:foundation-lock` |
| Secret scan PASS | Changed files scan |
| Exact Staging project proven | Checklist §05 |
| Production deny guard proven | Tests + `isProductionDenyActive` |
| Rollback tested locally | Freeze OFF restores |
| No unknown writer | Inventory complete for rehearsal scope |
| Direct RPC bypass resolved | DB guard applied **or** ENFORCE deferred |
| Owner approves scale-mapping handling for rehearsal | RAW_ONLY / UNAPPROVED accepted |
| Owner approves cohort | Cohort list |
| Owner approves freeze duration | Timebox |
| Owner explicit `GO-STAGING` | Written approval |

Missing any gate ⇒ **do not** run Staging mutation.
