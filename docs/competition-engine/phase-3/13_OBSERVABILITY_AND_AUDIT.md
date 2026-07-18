# 13 — Observability and Audit

**Status:** Design only

---

## Metrics (minimum)

```text
shadow_requests_total
shadow_failures_total
shadow_dropped_total
parity_exact_total
parity_semantic_total
parity_warning_total
parity_blocker_total
parity_not_comparable_total
canonical_duration_ms          # histogram
legacy_duration_ms             # histogram
canonical_fallback_total
dual_write_failure_total
reconciliation_pending_total
cutover_rollback_total
kill_switch_activations_total
control_plane_denies_total
```

Labels: `capability`, `format`, `tenantId` (low cardinality hash or allowlist), `runtimeMode`.

---

## Log correlation fields

```text
requestId
tenantId
competitionId
capability
format
runtimeMode
legacyVersion
canonicalVersion
adapterVersion
comparatorVersion
```

Do **not** log raw personal data unless required for a sealed audit path with retention policy.

---

## Dashboard (proposal)

1. **Migration overview** — modes by capability/tenant; kill switch state  
2. **Shadow health** — success rate, drop rate, p95 durations  
3. **Parity** — EXACT/WARNING/BLOCKER rates by capability  
4. **Writes** — dual-write failures, reconciliation queue  
5. **Cutover** — pilots, rollbacks, Owner GO markers  

---

## Alert thresholds (initial)

| Alert | Condition |
|-------|-----------|
| Shadow overload | drop rate > 20% for 15m |
| Parity blockers | any BLOCKER in Production pilot |
| Dual-write fail | >0 in 5m |
| Latency regression | canonical p95 > 2× legacy p95 for 30m |
| Kill switch | any activation → page Owner + technician |
| Fallback storm | fallback_total > N per competition/hour |

---

## Audit log

Mutating control-plane and cutover actions:

```text
actorId, role, action, scope, before, after, reason, requestId, createdAt
```

Separate from domain events (see `16`). Retention: align with identity audit_logs policy.
