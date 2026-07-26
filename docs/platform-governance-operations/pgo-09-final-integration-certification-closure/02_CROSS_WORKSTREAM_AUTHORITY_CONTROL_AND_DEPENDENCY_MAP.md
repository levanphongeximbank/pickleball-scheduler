# 02 — Cross-Workstream Authority, Control, And Dependency Map

**Baseline:** PGO-00..PGO-08 docs on `origin/main` @ `8ce23a6d…`  
**Rule:** Authority described here is the **documented** model. Live console assignment and operating proof remain outside structural certification unless separately Owner-attested.

## 1. Owner GO

| Decision class | Authority | Evidence path |
|----------------|-----------|---------------|
| Production GO (deploy, SQL/RLS apply, secret rotate, deferred reopen) | **Owner GO** only | PGO-01 `04_ENVIRONMENT_AND_AUTHORITY_MATRIX.md`, `05_CI_CD_AND_RELEASE_AUTHORITY.md` |
| Structural docs merge under PGO allowed path | Owner review for merge; workstream may implement under granted GO | Each PGO README hard constraints |
| Risk acceptance / temporary waiver / exception | Owner GO (+ domain owner as applicable) | PGO-08 findings/risk acceptance; PGO-09 doc 06 |
| Notification Production Phase 2C | Owner GO only; currently **`DEFERRED_BY_OWNER`** | PGO-01 `03_ROLLOUT_AND_DEFERRED_TRACK_REGISTER.md` |

Implied approval is prohibited. Silence, CI green, or documentation merge ≠ Owner GO.

## 2. Governance registry

| Control | Owner | Upstream | Downstream |
|---------|-------|----------|------------|
| Active worktree/branch registry | Owner GO + PGO docs owner | PGO-00 audit gaps | All parallel workstreams (hygiene) |
| Shared-file collision map | Owner GO + domain owners of shared paths | PGO-00 collision findings | Any change to `.github/**`, `scripts/ci/**`, package/lockfiles |
| Rollout / deferred track register | Owner GO + track owners | PGO-00 deferred selection | PGO-02..08 must not reopen deferred tracks |

Path: `docs/platform-governance-operations/` (PGO-01 root).

## 3. Incident authority

| Role | Authority | Source |
|------|-----------|--------|
| Incident classification / severity | Incident owner per PGO-02 taxonomy | `pgo-02-…/01_INCIDENT_CLASSIFICATION_AND_SEVERITY.md` |
| Escalation | Named escalation chain; Owner GO for certification-impacting decisions | `pgo-02-…/02_INCIDENT_OWNERSHIP_AND_ESCALATION.md` |
| Communication / postmortem | Incident owner + Owner GO for Production-impacting postmortems | `pgo-02-…/07_INCIDENT_COMMUNICATION_AND_POSTMORTEM.md` |
| Rollback / recovery decision | Deployment/incident authority + Owner GO for Production | `pgo-02-…/06_ROLLBACK_AND_RECOVERY_DECISION_MATRIX.md` |

Depends on: PGO-01 deferred register; PGO-03 alerting; PGO-05 rollback frames.

## 4. Observability evidence

| Concern | Documented owner | Dependency |
|---------|------------------|------------|
| Log taxonomy / correlation | Observability owner (PGO-03) | App/runtime emitters (out of PGO docs scope) |
| Security audit logging | Security + observability owners | PGO-06 privileged admin; PGO-07 privacy |
| Alert routing / escalation | Observability owner → incident owner | PGO-02 |
| Retention / redaction | Observability + Data Owner | PGO-07; targets provisional until Owner/Data Owner approve |

Evidence of sustained telemetry is **`NOT_VERIFIED`**.

## 5. Environment and secret custody

| Concern | Authority | Notes |
|---------|-----------|-------|
| Environment taxonomy Local→Production | Env owner + Owner GO for Staging/Production mutations | PGO-01 `04`; expanded in PGO-04 |
| Secret custody (names only in docs) | Secret authority + Owner GO | No values in PGO docs |
| Client/server exposure boundary | Platform + module owners | PGO-04 |
| Feature flag / kill switch | Named flag owners; Notification 2C blocked | PGO-04 `07_FEATURE_FLAG_AND_KILL_SWITCH_GOVERNANCE.md` |
| External platform config (Vercel, Supabase, GitHub) | Platform owners; console evidence external | PGO-04 `08_EXTERNAL_PLATFORM_AUTHORITY_MATRIX.md` — **`NOT_VERIFIED`** |

## 6. Release authority

| Concern | Authority | Source |
|---------|-----------|--------|
| GitHub Actions `verify` | Verification gate only — not Production deployer | PGO-01 `05_CI_CD_AND_RELEASE_AUTHORITY.md`; PGO-05 |
| Production deploy | Vercel Git Integration on push to `main` (repo-stated) | PGO-01 `05`; PGO-05 external deploy matrix |
| Change classification / approval | Change owner + independent review + Owner GO when required | PGO-05 |
| Emergency change / freeze | Owner GO | PGO-05 `06_CHANGE_WINDOWS_FREEZES_AND_EMERGENCY_CHANGE.md` |

Branch-protection UI settings: **do not assume** from repo alone.

## 7. Privileged access

| Concern | Authority | Source |
|---------|-----------|--------|
| Role / privilege / SoD | Identity/access owner + Owner GO | PGO-06 |
| Access request / provision / removal | Access approvers + custodians | PGO-06 |
| Periodic access review | Access owner; cadence provisional | PGO-06 — operating evidence missing |
| Break-glass / dual control | Privileged ops owner + Owner GO | PGO-06; must not reopen Notification 2C |
| Service accounts / machine identities | Credential custodian + Owner GO | PGO-06 |

## 8. Data protection

| Concern | Authority | Source |
|---------|-----------|--------|
| Data taxonomy / processing authority | Data Owner + Records Owner | PGO-07 |
| Retention / deletion / legal hold | Data Owner + Owner GO / legal path | PGO-07 — schedule provisional |
| DSR / export / portability | Data Owner | PGO-07 |
| Backup / restore / replicas / copies | Data + Database owners + Owner GO | PGO-02 + PGO-07 |
| External processors / subprocessors | Data Owner; inventory **`NOT_VERIFIED`** | PGO-07 |
| Legal/regulatory compliance claim | Owner + legal path only | PGO-07 / PGO-08 — **`NOT_CERTIFIED`** |

## 9. Control testing

| Concern | Authority | Source |
|---------|-----------|--------|
| Control universe ownership | Assurance owner + control owners | PGO-08 |
| Test procedures / sampling / frequency | Assurance owner; Owner approval required | PGO-08 — provisional until approved |
| Evidence provenance / custody | Evidence custodians | PGO-08 |
| Design vs operating effectiveness | Independent reviewer + Owner attestation | PGO-08 — operation **`NOT_VERIFIED`** |
| Findings / remediation / risk acceptance | Control owner + Owner GO | PGO-08 |

## 10. Upstream / downstream dependencies (simplified)

```text
PGO-00 audit
  → PGO-01 registry / deferred / authority baseline
    → PGO-02 incident/recovery
    → PGO-03 observability
    → PGO-04 env/secrets
    → PGO-05 release/change
    → PGO-06 access/privileged admin
    → PGO-07 data/privacy/records
    → PGO-08 assurance/compliance evidence frame
      → PGO-09 structural integration certification (this workstream)
```

Cross-links:

- PGO-02 recovery ↔ PGO-05 rollback ↔ PGO-07 backup/copy
- PGO-03 alerting → PGO-02 incident intake
- PGO-04 secrets/env → PGO-05 release gates → PGO-06 access to consoles
- PGO-06/07/08 consume PGO-01 deferred + authority rules
- All streams → Notification Phase 2C remains **`DEFERRED_BY_OWNER`**

## 11. Segregation of duties (documented expectation)

| Separation | Expected |
|------------|----------|
| Implementer vs Owner GO for Production | Required |
| Verification CI vs Production deploy authority | Required (Actions verify ≠ Vercel deploy) |
| Control owner vs independent reviewer (assurance) | Required for certification claims (PGO-08) |
| Secret custodian vs undocumented broad admin | Required (PGO-04/06) |
| Documentation author vs external assurance provider | Must not conflate |

Operating proof of SoD is **`NOT_VERIFIED`**.

## 12. Escalation

| Trigger | Escalate to |
|---------|-------------|
| Production-impacting incident | Incident owner → Owner GO |
| Missing approval for Staging/Production mutation | Stop; Owner GO |
| Proposal to reopen Notification Phase 2C | **Stop** — remains `DEFERRED_BY_OWNER` |
| Certification vocabulary change (readiness → certified) | Owner GO + domain evidence package |
| External platform outage / console lockout | Platform owner + Owner GO; do not invent access |
| Conflict between workstreams on shared path | Collision map gate + Owner GO |

## Honesty

Authority mapping is **structural**. It does not prove that named owners are currently assigned in live consoles, that reviews are executed on cadence, or that Production is ready.
