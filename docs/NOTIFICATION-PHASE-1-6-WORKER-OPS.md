# Notification Phase 1.6 — Worker Ops + Observability + Isolation

**Target:** Staging only. Production untouched. No live Email/SMS/Zalo/Web Push.

## Scope

- Environment isolation (`local|test|staging|production`) on jobs/attempts/worker runs
- Worker scope: environment + optional tenant + run_namespace + job_source
- Worker-run audit + heartbeat + abandoned detection
- Queue health aggregates (no secrets / payloads)
- Controlled cancel, dead-letter replay, stale lease recovery
- QA cleanup for exact `phase14s:` / `phase15:` / `phase16:` namespaces
- Structured safe worker logs
- Staging ops CLI

## SQL

| File | Purpose |
|------|---------|
| `docs/supabase-notification-phase16.sql` | Apply |
| `docs/supabase-notification-phase16-rollback.sql` | Rollback |

```bash
npm run notification:apply:phase16
npm run notification:verify:phase16
npm run notification:verify:phase15
npm run notification:verify:phase14s
```

## Ops commands

```bash
npm run notification:ops:queue-health
npm run notification:ops:worker-once -- --namespace phase16:<uuid>
npm run notification:ops:dead-letters
npm run notification:ops:recover-leases -- --confirm
npm run notification:ops:replay-job -- --job <uuid> --reason "ops" --confirm
npm run notification:ops:cancel-job -- --job <uuid> --reason "qa" --confirm
npm run notification:ops:cleanup-namespace -- --namespace phase16:<uuid> --confirm
```

Destructive commands require `--confirm`. Production is hard-blocked.

## Explicitly out of scope

- Live Email / SMS / Zalo / Web Push
- Competition Engine internals
- Production SQL apply / deploy / merge to main
- Production worker execution (structurally present, blocked)
