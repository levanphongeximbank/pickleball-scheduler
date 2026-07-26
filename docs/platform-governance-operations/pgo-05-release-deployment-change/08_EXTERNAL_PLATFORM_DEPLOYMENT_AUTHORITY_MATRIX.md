# 08 — External Platform Deployment Authority Matrix

**Rule:** Repository evidence is not external-console verification. Technical capability is not approval authority.

## Platform boundary

| Surface | Repository-evidenced role | External evidence required for certification |
|---|---|---|
| **Repository** | Source, reviews, tracked configuration, candidate commit | Protected state/approval evidence where relevant; repository alone does not prove deployment |
| **GitHub Actions** | CI/workflow intent and run references | Actual run identity/result, environment protections, authorized approvals |
| **Vercel** | Tracked deployment intent/config may exist | Project/environment linkage, artifact/deployment identity, Production result, access/approval evidence |
| **Netlify** | Tracked deployment intent/config may exist | Site/environment linkage, deployment identity, Production role, access/approval evidence |
| **Supabase** | Tracked client/schema/migration intent may exist | Correct project/environment, migration/operation result, Database Owner and Owner approval |

## Authority matrix

Legend: **P** propose, **R** review, **E** execute when authorized, **A** approve, **V** verify evidence, **—** no default authority.

| Surface / role | Contributor | Module Owner | Platform Operations | Security | Database Owner | Owner |
|---|---:|---:|---:|---:|---:|---:|
| Repository change | P | R/A for owned LOW/MEDIUM scope | R for shared platform | R for security scope | R for DB scope | A for HIGH/CRITICAL/Production scope |
| GitHub Actions change/run evidence | P | R | R/E/V | R where security-sensitive | R where migration-sensitive | A for Production authority/gate exception |
| Vercel deployment/promotion | — | P/readiness | E/V | R for security controls | R if data coupling exists | A for Production |
| Netlify deployment/promotion | — | P/readiness | E/V | R for security controls | R if data coupling exists | A for Production |
| Supabase schema/data operation | — | P/readiness | Coordinate/V | R for RLS/security | E/V/A for technical DB scope | A for Production |
| Emergency platform action | — | P/incident input | E under break-glass | R/E for security incident scope | E for DB incident scope | A; retrospective owner |
| Final release certification | — | Attest module scope | Attest deployment evidence | Attest security evidence | Attest DB evidence | **A** |

No contributor, Module Owner, Platform Operations member, Security reviewer, or Database Owner may self-approve a material change they solely implemented. Required specialist approval and Owner GO are cumulative, not interchangeable.

## Evidence non-claims

1. PGO-05 did not access GitHub, Vercel, Netlify, or Supabase consoles/APIs.
2. It did not verify live project linkage, Production settings, secrets, access lists, deployment history, or migrations.
3. A repository workflow/config file proves intent only.
4. GitHub Actions success does not prove Production deployment.
5. A PR merge does not prove Production release.
6. Preview deployment does not prove Production deployment.
7. Platform capability does not prove configuration or authorization.

```text
EXTERNAL_PLATFORM_EVIDENCE: NOT_VERIFIED
CONTRIBUTES_TO: NOT_READY
```

Notification Production Phase 2C remains **`DEFERRED_BY_OWNER`**.
