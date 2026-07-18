# Registration API (quick reference) — Phase 3A.3

Integrator-only registration into central registries. Capability chats create modules; they do not edit registry files.

```js
registerCapabilityExecutor({
  capability: "PARTICIPANT",
  executor: "LEGACY",
  modulePath: "participants/runtime/…",
});

registerShadowComparator({
  capability: "PARTICIPANT",
  modulePath: "participants/runtime/shadow/comparators/participant.js",
});

registerShadowNormalizer({
  capability: "PARTICIPANT",
  modulePath: "participants/runtime/shadow/normalizers/participant.js",
});

registerEligibilityAllowlist({
  capability: "PARTICIPANT",
  operations: ["create", "resolve"], // Owner-approved before Integrator registers
});
```

Prefer `create*Registry()` in unit tests for isolation.  
Singleton resets: `reset*RegistryForTests()` when not frozen.

See contract docs in this folder for reason codes and failure shapes.
