# 10 — Phase 2B.4 Entry Criteria

Phase 2B.4 must **not** start until Owner explicit GO after Phase 2B.3 merge/verification.

Suggested entry criteria:

1. Phase 2B.3 adapters merged to `main`
2. Architecture lock PASS on `main` (0 new/changed violations)
3. Competition Core flags still OFF on Production
4. Participant canonical runtime still INACTIVE
5. Owner selects the next narrow slice, for example:
   - Read-only persistence port stubs with **non-Production** fakes only
   - Expanded shadow parity against a frozen fixture corpus
   - Rating RPC port extraction design (from Phase 2A list)
6. No format runtime cutover without a separate Owner decision

```text
Phase 2B.4 is NOT STARTED.
```
