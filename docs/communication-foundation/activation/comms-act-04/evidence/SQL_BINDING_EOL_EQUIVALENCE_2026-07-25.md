# COMMS-ACT-04 — SQL binding EOL equivalence (CI remediation)

**Recorded:** 2026-07-25  
**Scope:** documentation only — no SQL semantic change, no remote mutation  
**Verdict:** `EOL_EQUIVALENCE_VERIFIED=PASS` · `SQL_SEMANTIC_DRIFT=NO`

## File

`docs/supabase-communication-comms-act-03-authorization-client-rls.sql`

## Measured bindings

| Representation | Bytes | SHA256 |
|----------------|------:|--------|
| Windows working-tree raw (CRLF) | `13173` | `4e4a19947bde5db8bc78b135b353b4c694e37bc975f926525c1389d2349a42b7` |
| Repository canonical LF (Git blob / Linux CI) | `12870` | `90b3ff7af7070b6709349cefd570d61f258449f3dc9d3908658b0df0acc65f26` |
| CRLF re-expanded from LF | `13173` | same as Windows raw |

Delta: `13173 - 12870 = 303` (= CRLF line-ending pairs). Lone `\r`: **0**.

## Evidence fields

```
WINDOWS_APPLY_RAW_SHA256=4e4a19947bde5db8bc78b135b353b4c694e37bc975f926525c1389d2349a42b7
WINDOWS_APPLY_RAW_BYTES=13173
REPOSITORY_CANONICAL_LF_SHA256=90b3ff7af7070b6709349cefd570d61f258449f3dc9d3908658b0df0acc65f26
REPOSITORY_CANONICAL_LF_BYTES=12870
EOL_EQUIVALENCE_VERIFIED=PASS
SQL_SEMANTIC_DRIFT=NO
```

## Historical integrity

Gate A / Owner SQL Editor apply / clipboard bind used the **Windows working-tree raw** representation (`13173` / `4e4a1994…a42b7`).  
That is **not** rewritten as an LF hash. Repository/CI binding uses canonical LF after `CRLF → LF` normalization of the same SQL text.

## Rollback (same EOL class)

| Representation | Bytes | SHA256 |
|----------------|------:|--------|
| Windows raw | `8808` | `63056ec8ce8140bf06671a1bbf3e375d728047630aeb8bd06a9aefe32a016de5` |
| Canonical LF | `8660` | `3de26ec8301d5b53bca350a5dde8f69e82ae90cd230bb2f04962f2cd9737dcc9` |

## Git attributes

- `git check-attr -a` on forward SQL: none  
- `core.autocrlf=true` on this Windows worktree (explains CRLF checkout)

## Remediation

ACT-04 tests hash **canonical LF** UTF-8 bytes only (single expected hash; no OR of two hashes).
