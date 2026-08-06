# Operation B1 — Future Execution Order

Deterministic per identity (fail closed):

1. Load allowlist + verify SHA-256 + project ref + count=8
2. Evaluate authorization (Owner GO required when `DRY_RUN=false`)
3. For each identity in stable allowlist order:
   1. Capture original profile status + Auth ban boolean
   2. Re-verify Auth email via admin lookup (ID alone insufficient)
   3. Re-check `isCertifiedQaEmail`
   4. Re-check zero business references
   5. Apply profile `status='quarantined'` (idempotent if already)
   6. Verify profile status
   7. Apply Auth ban `876000h`
   8. If Auth ban fails → **compensate** by restoring original profile status; stop batch
4. Write masked batch result log outside Git
5. Run postcheck

Hard delete is unavailable.

Compensation note: Auth and profile writes are not one DB transaction; compensation restores profile on Auth failure.
