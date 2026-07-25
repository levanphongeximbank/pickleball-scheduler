# NEWS-03 evidence (runtime)

Harness writes JSON evidence here during live Staging operations.

- Local certification / unit tests MUST use a temp `--evidence-dir`.
- Do not commit runtime evidence containing environment-specific results.
- Secrets must never appear in evidence files.

Files matching `*.json` in this directory are gitignored.
