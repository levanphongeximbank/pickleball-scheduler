# Reporting Protocol — Phase 3P

Every capability / Integrator chat must use the templates below. Fields marked required must never be omitted.

---

## Template A — Capability implementation report

```text
CHAT <N> — PHASE 3<letter> IMPLEMENTATION REPORT

1. Chat ID
2. Phase
3. Branch
4. Base SHA
5. File ownership scope
6. Changed files
7. Shared files touched          # must be NONE or Integrator co-authored
8. Out-of-scope files
9. Dependencies                  # HARD/SOFT upstream consumed
10. Tests                        # files + pass/fail
11. Architecture lock            # pass/fail + debt delta
12. Production impact            # must be NONE for early waves
13. Database impact              # must be NONE
14. Feature flags                # OFF
15. Shadow state                 # OFF / eligibility default false
16. Runtime cutover state        # NOT PERFORMED
17. Blockers
18. Verdict                      # READY FOR INTEGRATOR | BLOCKED | FAILED
```

---

## Template B — Integrator report

```text
CHAT I — INTEGRATION REPORT

1. Chat ID                       # CHAT I
2. Phase                         # Integrator Wave <N>
3. Branch                        # feature/competition-engine-integrator-wave-<N>
4. Base SHA
5. File ownership scope          # protected files list
6. Changed files
7. Shared files touched          # expected YES — list them
8. Out-of-scope files
9. Dependencies                  # capability branches merged
10. Tests                        # official manifest + integration
11. Architecture lock
12. Production impact
13. Database impact
14. Feature flags
15. Shadow state
16. Runtime cutover state
17. Blockers
18. Capability PRs integrated
19. Export surface added
20. Registry entries added
21. Manifest entries added
22. Wave gate results
23. Verdict                      # WAVE COMPLETE | WAVE BLOCKED | WAVE FAILED
```

---

## Template C — Audit report (Phase 3P)

Use the Owner-facing 57-field report defined in the chat instruction (§27).  
Stored outcome: this folder + final message in Chat P.

---

## Field definitions (common)

| Field | Meaning |
|-------|---------|
| Shared files touched | Any protected file from `shared-file-protection.md` |
| Production impact | Change to default Production request path behavior |
| Database impact | Schema, RLS, RPC, migrations |
| Feature flags | Env defaults / snapshot defaults |
| Shadow state | Eligibility default + allowlists |
| Runtime cutover state | LEGACY primary vs CANONICAL |
| Verdict | Exactly one allowed enum value |

## Failure reporting

If a chat edits out-of-scope files:

```text
STOP
Do not continue implementation
Report Owner with file list
Verdict: BLOCKED or FAILED
```
