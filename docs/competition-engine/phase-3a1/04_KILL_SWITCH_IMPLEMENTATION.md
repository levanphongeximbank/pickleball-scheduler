# 04 — Kill Switch Implementation

`resolveKillSwitch({ context, flags, overrides })` evaluates pure data:

| Source | Reason code |
|--------|-------------|
| `flags.global.killSwitch` | `GLOBAL_KILL_SWITCH` |
| Competition flag / override | `COMPETITION_KILL_SWITCH` |
| Tenant flag / override | `TENANT_KILL_SWITCH` |
| Format override | `FORMAT_KILL_SWITCH` |
| Capability override | `CAPABILITY_KILL_SWITCH` |

Effect via decision resolver:

```text
selectedMode: LEGACY_ONLY
canonicalAllowed: false
shadowAllowed: false
```

No remote config. No Production deploy required to unit-test.
