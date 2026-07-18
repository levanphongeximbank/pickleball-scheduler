# Eligibility — Phase 3A.2

Resolver: `resolveShadowEligibility`

## Default

```text
eligible: false
```

## Checks (all must pass)

1. Request shape validity
2. `runtimeDecision.shadowAllowed === true`
3. `runtimeDecision.canonicalAllowed === true`
4. Kill switch inactive (`resolveKillSwitch`)
5. Feature flag snapshot `shadow.enabled === true`
6. Capability in injected allowlist (empty allowlist = deny)
7. Operation in injected allowlist (empty allowlist = deny)
8. Injected sampling decision `sampleIncluded === true`

## Sampling

Sampling is **never** generated with `Math.random` inside the shadow domain.

Callers must inject `options.sampleIncluded`. Missing or `false` → `SAMPLE_EXCLUDED`.

## Reason codes

Stable constants in `SHADOW_REASON_CODE` (e.g. `SHADOW_DISABLED`, `KILL_SWITCH_ACTIVE`, `ELIGIBLE`).
