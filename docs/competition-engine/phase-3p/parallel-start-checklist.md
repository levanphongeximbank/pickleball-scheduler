# Parallel Start Checklist — Phase 3P

Owner must check **all** boxes before opening Chat 2–N (or assigning Wave 2+ parallel work).

## Mandatory checklist

- [ ] Contracts locked (Participant identity freeze rules published)
- [ ] File ownership locked (`file-ownership-map.md` approved)
- [ ] Shared files protected (`shared-file-protection.md` approved)
- [ ] Branch bases locked (`branch-strategy.md` approved)
- [ ] Merge waves approved (`merge-wave-plan.md` approved)
- [ ] Integrator defined (`integrator-model.md` approved; Chat I opened or designated)
- [ ] Test strategy approved (Option D + Integrator merge)
- [ ] Public export strategy approved (Option B)
- [ ] Runtime registry ownership approved
- [ ] Rollback rules documented (see Phase 3 `12_ROLLBACK_AND_RECONCILIATION.md` + wave safety gates)
- [ ] Phase 3A.2 remains ancestor of `origin/main`
- [ ] Production safety baseline still true (flags OFF, shadow OFF, no cutover)
- [ ] Wave 0 / **Phase 3A.3 — Integration Bootstrap** complete (**REQUIRED** — no waive)
- [ ] Chat 1 (3B) scope written and Owner GO for Wave 1 (**only after Phase 3A.3**)

## Opening rules

| Action | Allowed when |
|--------|--------------|
| Open Chat I / Phase 3A.3 | Phase 3P approved; Integrator designated |
| Open Chat 1 (3B) | Phase 3A.3 complete; Wave 1 GO |
| Open Chat 2–3 parallel | Checklist complete **and** target wave parallel candidates approved |
| Open Chat for 3C before 3B merge | **NOT ALLOWED initially** (Owner-locked) |
| Open 3E before 3D merge | **NOT ALLOWED by default** (Owner-locked) |
| Open 6+ chats | **Not recommended**; requires Owner exception |

## Stop conditions

```text
Working tree unclean on shared branches
Architecture lock failing on main
Production flag accidentally enabled
Any chat edited protected files without Integrator
```
