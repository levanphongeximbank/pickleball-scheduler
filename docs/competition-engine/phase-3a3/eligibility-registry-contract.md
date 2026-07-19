# Eligibility Registry Contract — Phase 3A.3

## Defaults (locked)

```text
Default eligibility: false
Empty allowlist: deny
Shadow: OFF
```

## API

```js
registerEligibilityAllowlist({ capability, operations: string[] })
resolveEligibilityAllowlistsFromRegistry({ capability })
// → { capabilityAllowlist, operationAllowlist, eligibleByRegistry }
```

## Wiring status

```text
NOT wired into resolveShadowEligibility in Phase 3A.3
```

Populating the allowlist registry does **not** change Production shadow eligibility.

## Reserved

Integrator may wire registry → eligibility options later under Owner GO (still subject to flags/kill-switch).

## Forbidden

Default-true eligibility; empty-allowlist allow; Production Shadow enablement in this phase.
