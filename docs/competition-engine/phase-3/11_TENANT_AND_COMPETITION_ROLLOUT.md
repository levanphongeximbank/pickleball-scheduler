# 11 — Tenant and Competition Rollout

**Status:** Design only — no pilot in Phase 3.0

---

## Tenant rollout tiers

```text
1. Local tests
2. Automated integration
3. Preview
4. Internal QA tenant
5. Synthetic competition
6. Selected non-critical tenant
7. Selected real competition
8. Format pilot
9. Tenant pilot
10. Broad rollout
11. Default-on
12. Legacy retirement
```

**Never** enable all tenants at once.

---

## Pilot selection criteria

| Criterion | Required |
|-----------|----------|
| Simple data shape | Yes |
| Low user count | Yes |
| Non-critical competition | Yes |
| Rollback feasible | Yes |
| Owner or operator direct control | Yes |
| No unsupported format edge cases | Yes |
| Operator available during window | Yes |

Avoid: championship finals, multi-club Official with complex pairing, TT cloud_only without shadow history.

---

## Competition-level metadata (design)

```text
runtimeMode
runtimeVersion
canonicalCapabilityVersions
legacyFallbackAllowed
shadowSamplingRate
cutoverAt
cutoverBy
rollbackAt
rollbackBy
rollbackReason
```

### Where to store (options — Owner picks in OG-3.0C/F)

| Option | Pros | Cons |
|--------|------|------|
| Competition document in club blob | Fast, local | Harder central kill/ops |
| Supabase `competition_runtime_overrides` | Instant kill, auditable | Needs RLS + admin UI later |
| Hybrid: blob cache + remote override | Best of both | Sync complexity |

**Recommendation:** Remote override store as authority for kill/mode; blob may cache last-known for offline read **without** allowing elevation of privileges.

---

## Format pilot order (suggestion)

```text
1. Internal tournament (controlled club)
2. Individual registration/entry (non-peak)
3. Official Open (simple)
4. Team Tournament roster/lineup (after TT cloud shadow policy)
5. Daily Play pairing (highest non-determinism — last among formats)
```

---

## Success criteria to promote tier

```text
Parity thresholds met for capability
No BLOCKER in gate window
p95 latency within budget
Zero data-loss incidents
Kill switch drill passed in that env
Owner GO for next tier
```
