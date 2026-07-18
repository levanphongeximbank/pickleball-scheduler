# Runtime Flow — ParticipantResolver

## Factory

```js
import { createParticipantResolver } from
  "src/features/competition-core/participants/runtime/index.js";

const resolver = createParticipantResolver({
  // defaults: LegacyParticipantAdapter + in-process identity lookup
  // enablePersistence: false (default)
});
```

## Responsibilities

| Concern | Behavior |
|---------|----------|
| resolve | Map + validate + identity register |
| resolveShadow | Same resolve + optional parity compare |
| Adapter selection | First `supports(source)` wins |
| Persistence | Off by default; stub port only when enabled |
| Errors | Result envelope with typed codes (no bare Error for business fail) |

## Defaults

- Adapter: `LegacyParticipantAdapter` only
- Persistence writes: **disabled**
- Shadow: not auto-run
- No registry side effects at import time
