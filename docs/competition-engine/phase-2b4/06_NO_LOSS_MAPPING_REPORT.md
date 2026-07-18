# 06 — No-Loss Mapping Report

Helper: `tests/fixtures/competition-core-2b4/noLossAssessment.js`

Classifications:

```text
PRESERVED
PRESERVED_IN_EXTENSION
OPTIONAL_MISSING
WARNING
FAILURE
BLOCKER
```

## Team Tournament (locked roster + hidden lineup)

Observed: PRESERVED (id, captain, membership, lock, revision, audit) and PRESERVED_IN_EXTENSION (TT extensions, hidden lineup policy). Summary `ok: true`.

## Individual (partner invite + waitlist)

Observed: PRESERVED entry/competition/division/category semantics; partner invite PRESERVED_IN_EXTENSION; waitlist PRESERVED without Entry.

Semantic evaluation is field-meaning based, not raw field-count equality.
