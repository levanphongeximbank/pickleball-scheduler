# Operation A — Owner Decision Package (Gender Only)

**Package status:** prepared for review — **NOT APPLIED**  
**Production GO:** NO (this document does not grant GO)  
**Production project:** `expuvcohlcjzvrrauvud`  
**Merge authority:** PR #371 / `1577785ad2190b51306c98571322871ccf9c3536`

## LIVE BASELINE REFERENCE (read-only preflight)

| Metric | Value |
|--------|------:|
| total profiles | 61 |
| gender null | 25 |
| gender blank | 0 |
| gender male | 15 |
| gender female | 17 |
| gender other | 0 |
| exact `Nam` | **4** |
| exact `Nữ` | 0 |
| non-canonical | 4 (all exact `Nam`) |
| target IDs match historical baseline | YES |
| target rows changed since prior audit | NO |
| gender CHECK on profiles | ABSENT |
| PITR / recoverable backup | **NOT_PROVEN** |

### Approved target profile IDs (from read-only preflight)

| profile_id | status | updated_at (UTC) |
|------------|--------|------------------|
| `4cf24ed0-99f8-4997-b803-3c7ff8e32014` | active | `2026-07-10 04:27:34.251+00` |
| `6dd85e98-e493-4e04-9582-d904e27b3a44` | active | `2026-07-14 09:44:39.019+00` |
| `6e77321e-1182-4174-a08a-3ee2d1833c7c` | active | `2026-07-14 11:51:32.364+00` |
| `6ff822c6-c1b6-4ce0-9e20-61f7afc74a88` | active | `2026-07-14 11:51:04.156+00` |

Any live drift from this set/count/timestamps requires a new Owner-approved precheck snapshot before forward.

## Proposed Operation A result

`Nam` → `male` for the four captured rows only. No QA actions. No CHECK install.

## RISK CONTROLS in hardened package

- persistent row-level backup ledger (`_ppdr_op_a_batch` / `_ppdr_op_a_ledger`)
- exact four-row capture and update assertions (fail closed)
- ID capture via ledger; operator ID match gate in runbook
- `updated_at` drift guard (`IS NOT DISTINCT FROM` captured original)
- single transaction with fail-closed exceptions
- transaction-scoped advisory lock
- deterministic batch-specific rollback that refuses later changes
- data-only on `public.profiles` (no profiles CHECK / no profiles ALTER)
- schema CHECK classified as separate future Operation C
- QA cleanup excluded (Operation B separate)

## REMAINING CONDITION — Owner must choose explicitly

Because PITR is **NOT_PROVEN**, final Owner approval must explicitly choose one:

### A. BLOCK
Block Production Operation A until PITR / recoverable backup is independently proven.

### B. ACCEPT limited no-PITR risk
Accept limited no-PITR risk for **exactly four** guarded rows, relying on the persistent row-level backup ledger and deterministic rollback.

**This package does not choose A or B for the Owner.**  
**This package does not authorize Production execution.**

## Separated operations

| Operation | Scope | Combined GO allowed? |
|-----------|-------|----------------------|
| A | gender `Nam`→`male` data-only | — |
| B | QA identity quarantine | NO — separate |
| C | future gender CHECK | NO — separate |

## Decision checklist (Owner)

- [ ] I reviewed the live baseline and four target IDs
- [ ] I choose **A (BLOCK)** or **B (ACCEPT no-PITR risk)** in writing
- [ ] I issue a written GO for **Operation A only** (or withhold GO)
- [ ] I confirm Operation B and Operation C are **not** included
