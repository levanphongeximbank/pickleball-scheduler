# Phase 1J — Implementation Plan

**Owner decision:** `APPROVE_PHASE_1J_SCOPE`  
**Branch:** `feature/player-phase-1j`  
**Base `origin/main` SHA:** `5f702da575d9e9c176a8faf5742f27bdb7d74129`  
**Classification:** Candidate A — Production Directory Operational Hardening  
**Document verdict:** `READY_FOR_SCOPE_FREEZE_COMMIT`  
**Runtime / SQL under this docs package:** **None**

---

## 1. Objective

Prove and harden the already-shipped authenticated Public Player Directory **without** changing the Phase 1I product contract.

---

## 2. Sub-phase plan

| Sub-phase | Objective | Package / evidence | Stop gate |
|-----------|-----------|--------------------|-----------|
| **1J-0** | Scope freeze | `00`–`04` docs in `phase-1j/` | Commit/merge freeze |
| **1J-A** | Staging fixture pack | Runbook + QA-labeled eligible athletes | `AUTHORIZE_PHASE_1J_STAGING_FIXTURES` |
| **1J-B** | Staging privacy evidence | Sanitized smoke / checklist results | After 1J-A |
| **1J-C** | Production browser smoke | Matrix for PLAYER / non-PLAYER / anon / president / mobile | `AUTHORIZE_PHASE_1J_PRODUCTION_BROWSER_SMOKE` |
| **1J-D** | UX confirmation / scoped fix | Empty-state + defect fix **only if** proven | `AUTHORIZE_PHASE_1J_UX_HARDENING` if code needed |
| **1J-E** | Optional indexes | New SQL under `docs/v5/` (not reopen 1I-B redesign) | Separate SQL author + Staging + Prod tokens |
| **1J-F** | Closure | Final closure doc | `AUTHORIZE_PHASE_1J_F_CLOSURE` |

---

## 3. Suggested Owner tokens

| Token | Authorizes |
|-------|------------|
| `APPROVE_PHASE_1J_SCOPE` | This freeze (done) |
| `AUTHORIZE_PHASE_1J_STAGING_FIXTURES` | Staging-only fixture writes |
| `AUTHORIZE_PHASE_1J_PRODUCTION_BROWSER_SMOKE` | Production read-only browser matrix |
| `AUTHORIZE_PHASE_1J_UX_HARDENING` | Scoped UI fix if defects found |
| `AUTHORIZE_PHASE_1J_E_SQL_AUTHORING_ONLY` | Optional index SQL authoring |
| `AUTHORIZE_PHASE_1J_E_STAGING_APPLY` | Optional index Staging apply |
| `AUTHORIZE_PHASE_1J_E_PRODUCTION_APPLY` | Optional index Production apply |
| `AUTHORIZE_PHASE_1J_F_CLOSURE` | Closure docs |

---

## 4. Sequence (locked)

```text
1J-0  scope freeze (docs)
  → merge
  → 1J-A Staging fixtures (Owner write token)
  → 1J-B Staging privacy evidence
  → 1J-C Production read-only browser smoke
  → 1J-D scoped UX only if needed
  → 1J-E optional SQL (separate gates) OR defer in closure
  → 1J-F closure
```

**Alternate Owner path:** Skip 1J-A/B only if Owner **explicitly accepts** empty-set residual risk for privacy live sampling; 1J-C may still proceed.

---

## 5. Architecture stance

| Topic | Plan |
|-------|------|
| Facades | Reuse `searchPublicDirectoryPlayers` / `getPublicDirectoryPlayer` |
| SQL RPCs | Reuse Phase 1I-B objects; do not redesign |
| DTO / privacy | Unchanged from Phase 1I freeze |
| UI routes | Unchanged unless 1J-D proves a defect |
| Fixtures | Staging profiles only; reversible; never copy to Production by default |

---

## 6. Test strategy

| Layer | Plan |
|-------|------|
| Regression | Re-run Phase 1I-A–E + Phase 42L nav suites before closure |
| Staging | After fixtures: search `itemCount >= 1`; revoke public → disappears; detail null for hidden |
| Production SQL | Optional reconfirm ACL/RPC read-only (no writes) |
| Production UI | Manual matrix; each cell PASS / FAIL / NOT VERIFIED |
| CI | Deterministic tests only; no live Supabase requirement |

---

## 7. Deliverable checklist (later implementation waves)

### 1J-A / 1J-B
- [ ] Staging fixture runbook  
- [ ] Fixture inventory (player ids redacted in public docs if needed)  
- [ ] Sanitized search/detail privacy evidence  

### 1J-C
- [ ] Browser matrix sheet  
- [ ] Empty-state screenshot or equivalent note  
- [ ] Nav-once / president / mobile notes  

### 1J-D (conditional)
- [ ] Minimal PR with scoped fix + tests  

### 1J-E (optional)
- [ ] Forward / verify / rollback SQL  
- [ ] Staging apply evidence  
- [ ] Production apply evidence  

### 1J-F
- [ ] Closure doc with completion % and residual risks  

---

## 8. Explicit non-goals of this plan document

- No runtime implementation in 1J-0  
- No SQL authoring in 1J-0  
- No Staging/Production writes in 1J-0  
- No deploy  

---

## 9. Exact Owner action next

1. Authorize commit/merge of Phase 1J-0 docs.  
2. Issue `AUTHORIZE_PHASE_1J_STAGING_FIXTURES` when ready for 1J-A.
