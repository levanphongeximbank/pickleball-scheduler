# 08 — External Platform Access Authority Matrix

**Workstream:** PGO-06
**Fresh baseline:** `0c55f0814aeae1c470c65204b72e6dba0aad9f80`
**Rule:** Repository evidence is not external-console verification. Technical capability is not proof that access is granted or correctly configured.

## Surfaces in scope

| Surface | Access concern |
|---|---|
| **Repository** | Clone, branch, review, merge authority references |
| **GitHub** | Org/repo membership, protection settings, secret/var custody |
| **GitHub Actions** | Workflow run authority, environment protections, secret consumption |
| **Vercel** | Project access, env var custody, Production deploy authority |
| **Netlify** | Site access and deploy configuration authority (if used) |
| **Supabase** | Project access, Auth admin, SQL/RLS apply, service-role custody |
| **Database** | Privileged DB roles, migration apply, data operations |
| **Deployment environment** | Production/Staging/Preview configuration and secret access |

## Authority matrix

Legend: **P** propose, **R** review, **E** execute when authorized, **A** approve, **V** verify evidence, **—** no default authority.

| Surface / role | Contributor | Module Owner | Platform Operations | Security | Database Owner | External Platform | Owner |
|---|---:|---:|---:|---:|---:|---:|---:|
| Repository access / contribution | P | R/A for owned LOW/MEDIUM scope | R for shared platform paths | R for security-sensitive paths | R for DB-coupled paths | — | A for HIGH/CRITICAL/Production-affecting access |
| GitHub membership / protection exceptions | — | P need | R/E under Owner | R | — | Hosts membership UI (**not verified here**) | **A** for Production-impacting access changes |
| GitHub Actions secret/var access | — | P name/need | R/E custody hygiene | R | R if DB-related | Stores secrets/vars (**not verified here**) | **A** for new Production secret names |
| Vercel project / env access | — | P readiness need | R/E under Owner | R | R if data coupling | Hosts project access (**not verified here**) | **A** for Production |
| Netlify site / env access | — | P if track used | R/E under Owner | R | R if data coupling | Hosts site access (**not verified here**) | **A** for Production-impacting use |
| Supabase project / Auth admin access | — | P module need | Coordinate/V | R | E/V technical DB scope | Hosts project access (**not verified here**) | **A** for Production |
| Database privileged access | — | P | Coordinate | R | **E/V/A** technical scope | Engine/hosting boundary | **A** for Production apply/privilege change |
| Deployment environment secret access | — | P names | R/E custody | R | R if DB secrets | Injects/stores env (**not verified here**) | **A** for Production |
| Privileged access certification | — | Attest module scope | Attest ops access evidence | Attest security evidence | Attest DB access evidence | Provides console truth only when attested | **A** final |

No contributor, Module Owner, Platform Operations member, Security reviewer, or Database Owner may self-approve their own privileged Production access grant. Required specialist approval and Owner GO are cumulative, not interchangeable.

## Repository-owned evidence (intent only)

| Artifact class | Examples (paths/names only) | Proves | Does not prove |
|---|---|---|---|
| Deploy/CI contract | `.github/workflows/deploy.yml` (referenced by PGO-01/04/05) | Workflow intent and secret **names** | Live access roster or branch-protection UI |
| Hosting config | `vercel.json`, `netlify.toml` | Tracked deploy config | Live project membership |
| Env templates | `.env*.example` | Declared variable **names** | Live values or who can read them |
| Operator checklists | `docs/GA-PRODUCTION-ENV-CHECKLIST.md`, `DEPLOYMENT_GUIDE.md`, `docs/SUPABASE-PRODUCTION-CHECKLIST.md` | Expected operator steps | Checklist completion or console access attestation |
| Prior PGO matrices | PGO-04 `08_EXTERNAL_PLATFORM_AUTHORITY_MATRIX.md`, PGO-05 deployment matrix | Governance precedent | Fresh console verification |

## Evidence non-claims

1. PGO-06 did not access GitHub, Vercel, Netlify, or Supabase consoles or APIs.
2. PGO-06 did not verify live membership, SSO, MFA, or access lists.
3. External Platform column describes hosting responsibility, not attested console state.
4. Repository workflow/config files prove intent only.

```text
EXTERNAL_PLATFORM_EVIDENCE: NOT_VERIFIED
CONTRIBUTES_TO: NOT_READY
```

Notification Production Phase 2C remains **`DEFERRED_BY_OWNER`**.
