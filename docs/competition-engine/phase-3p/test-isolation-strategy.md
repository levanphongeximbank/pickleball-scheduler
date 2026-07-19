# Test Isolation Strategy — Phase 3P

## Problem

Official CI unit suite is listed in:

```text
scripts/ci/unit-test-files.json
```

If every capability chat appends to this file, merge conflicts are guaranteed.

## Options evaluated

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A** | Each chat edits manifest | Simple | **High conflict** — rejected |
| **B** | Integrator edits manifest last | Clear ownership | Capability CI may miss new tests until integration |
| **C** | Automatic discovery | Zero conflict | Requires CI refactor (out of scope for 3P); risk of picking non-official tests |
| **D** | Per-phase sub-manifest | Parallel-friendly | Needs small CI change later |

## Official decision (Phase 3B–3L)

```text
PRIMARY: Option D — Per-phase sub-manifest
FALLBACK during Wave 0: Option B — Integrator merges into unit-test-files.json
```

### Official mechanism

1. Capability chat adds tests under naming convention:

```text
tests/competition-core-<capability>-3<letter>*.test.js
```

Examples:

- `tests/competition-core-participant-runtime-3b.test.js`
- `tests/competition-core-registration-runtime-3c.test.js`

2. Capability chat **also** creates/updates a phase sub-manifest (new file, owned by that phase):

```text
scripts/ci/unit-test-files.phase-3b.json
scripts/ci/unit-test-files.phase-3c.json
...
```

Each file is a JSON array of relative test paths for that phase only.

3. Capability chat **MUST NOT** edit `scripts/ci/unit-test-files.json`.

4. Integrator Chat, in each merge wave:

- Appends phase sub-manifest entries into `scripts/ci/unit-test-files.json`
- Runs full `npm test`
- Owns conflict resolution on the official manifest

### Wave-0 note

Until CI is updated to auto-merge sub-manifests (future, **not** in Phase 3P), sub-manifests are **contractual** for PR review; Integrator performs the physical merge into the official manifest.

### Explicit non-goals for Phase 3P

```text
Do NOT change CI runners in Phase 3P
Do NOT refactor test discovery
Do NOT implement Option C now
```

## Capability chat test duties

| Duty | Required |
|------|----------|
| Add capability-local unit tests | YES |
| Add architecture lock tests if new boundaries | YES (capability-local file) |
| Prove Production unchanged (flags still OFF) | YES |
| Edit `unit-test-files.json` | **NO** |
| Edit unrelated format tests | **NO** |

## Integrator test duties

| Duty | Required |
|------|----------|
| Merge sub-manifest → official manifest | YES |
| Cross-capability integration tests | YES (per wave) |
| Re-run architecture lock + full unit suite | YES |
