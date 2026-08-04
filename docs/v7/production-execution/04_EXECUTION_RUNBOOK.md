# Execution Runbook

This runbook is intentionally declarative only. It defines the ordered execution discipline but does not authorize execution.

Rules:
- execute one checkpoint at a time
- do not run the package as a monolith
- do not invent steps outside tracked artifacts
- do not skip verification after any mutation
- after each step choose CONTINUE, ABORT, or ROLLBACK
- stop immediately on any hidden or ambiguous step

The exact mutable actions, if later Owner-authorized, must be taken only from the ordered ledger in `02_ORDERED_EXECUTION_LEDGER.json`.
