# TT-11 — Incident Runbook

---

## Severity definitions

| Level | Definition | Response time |
|-------|------------|---------------|
| **P0** | Tournament cannot continue | Immediate — stop the clock |
| **P1** | One role completely blocked | < 15 min workaround |
| **P2** | UX defect or reporting error | Next break |

---

## Incident template

### INC-{{ID}} — {{Title}}

| Field | Value |
|-------|-------|
| **Severity** | P0 / P1 / P2 |
| **Detected at** | |
| **Reporter** | |
| **Affected roles** | BTC / Captain / Referee / All |

#### Triệu chứng

_Describe what users see._

#### Cách xác minh

1. 
2. 
3. 

#### Workaround

_Steps to keep tournament running._

#### Người quyết định

| Action | Owner |
|--------|-------|
| Continue / pause | |
| Rollback | |
| Manual mode | |

#### Dữ liệu cần lưu

- [ ] Command log export
- [ ] Audit trail screenshot
- [ ] Tournament version numbers
- [ ] Client HAR / console log
- [ ] Referee token ID (redacted)

#### Rollback reference

See `TT11_ROLLBACK_RUNBOOK.md` → scenario ___

#### Postmortem note

_Root cause, fix, prevention — fill after resolution._

---

## Catalogued incident types

| Type | Default severity | Rollback scenario |
|------|------------------|-------------------|
| Cloud RPC 500 | P0 | R02 |
| version_conflict loop | P1 | R07 |
| Captain deadline bypass attempt | P2 | — |
| Referee double-submit | P1 | — |
| Standings wrong rank | P1 | R03 |
| Preview white screen | P0 | R01 |
| Offline queue not syncing | P1 | R08 |
| Opponent lineup leak pre-publish | P0 | R04 + flag off |

---

## Escalation

1. On-call tech → Tech lead  
2. P0 > 30 min → Product owner  
3. Data loss risk → Stop all writes + Ops backup restore
