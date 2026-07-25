# 08 — External Platform Authority Matrix

**Workstream:** PGO-04
**Fresh `origin/main`:** `ec3c534d93eb36e3514791ea6550228c3bc75ea3`
**Snapshot timestamp:** `2026-07-25T23:47:21+07:00`
**Rule:** Repository evidence ≠ console verification. Do **not** claim external settings are verified without evidence.

## Authority matrix

| Concern | Repository | GitHub | Vercel | Netlify | Supabase | Business Module Owner | Platform Operations | Owner |
|---------|------------|--------|--------|---------|----------|----------------------|---------------------|-------|
| Tracked env **templates** | Owns files (`.env*.example`, `.env.test`) | N/A | N/A | N/A | N/A | Propose names via PR | Review shared templates | Approve secret-shaped additions / Production impact |
| App code reading `import.meta.env` / `process.env` | Owns `src/**`, `api/**`, scripts | CI executes | Build injects `VITE_*` at deploy | Possible alternate host | Client uses project URL/anon | Owns module flags/config | Coordinates | GO for Production risk |
| Actions secrets/vars (**names** evidenced) | Workflows reference names | **Stores** secrets/vars | Consumed indirectly via CI/build | N/A unless used | N/A | May request names | Maintains CI secret hygiene | GO for new Production secret names |
| Production deploy trigger | Docs/workflow contract | Protects `main` (**UI not assumed**) | **Git Integration** deploys on `main` (repo contract) | Tracked `netlify.toml` only | N/A | Module readiness ≠ auto-deploy authority | Executes under Owner | **Required** for Production-affecting changes |
| Project env consoles | Not source of live values | Environments (if used) — **not assumed** | Production/Preview env vars — **not assumed verified** | Site env — **not assumed** | Project settings — **not assumed** | Provides required names | Applies with Owner GO | Approves Production |
| Database / RLS / SQL | Docs + SQL files under `docs/` / `supabase/` (PGO-04 does not edit) | N/A | N/A | N/A | **Applies** schema/RLS | Module SQL owners | Coordinates apply | **Required** Staging/Production apply |
| Secret rotation / revocation | Policy only (this workstream) | Rotate Actions secrets | Rotate project env | Rotate if used | Rotate keys | Module provider creds | Executes | **Required** |
| Monitoring / logs | PGO-03 policy | Actions logs | Platform logs — capability ≠ enabled claim | Vendor logs | DB/API logs | Module telemetry | Ops | Certification authority |
| Notification Production Phase 2C | Deferred register (PGO-01) | N/A | N/A | N/A | Future SQL reserved | Notification owner | Must not open | **`DEFERRED_BY_OWNER`** |

## Repository-owned evidence (fresh main)

| Artifact | Path | What it proves | What it does **not** prove |
|----------|------|----------------|----------------------------|
| Env templates | `.env.example`, `.env.production.example`, `.env.staging-qa.local.example`, `.env.test` | Declared **names** | Live values or console correctness |
| Deploy config | `vercel.json`, `netlify.toml` | Tracked routing/build config | Live project linkage / env consoles |
| CI workflow | `.github/workflows/deploy.yml` | Referenced `secrets.*` / `vars.*` **names**; verification gate | Branch protection UI; that console secrets match Production |
| GA / deploy docs | `docs/GA-PRODUCTION-ENV-CHECKLIST.md`, `DEPLOYMENT_GUIDE.md`, `docs/SUPABASE-PRODUCTION-CHECKLIST.md` | Expected operator checklist | Checklist was completed |
| ECO / comms boundary docs | `docs/ecosystem-integrations/eco-02/**`, `comms-act-05` server-only doc | Intended architecture | Live cutover complete |
| Secret scan scripts/reports | `scripts/**secret-scan*`, referee scan report docs | Ad-hoc scan tooling exists | Platform-wide continuous secret scanning certified |

## CI secret/var names evidenced (names only)

From workflows on `origin/main`:

- `secrets.VITE_SUPABASE_URL`
- `secrets.VITE_SUPABASE_ANON_KEY`
- `vars.VITE_RBAC_ENABLED`
- `vars.VITE_PAYMENT_MODE`

GA checklist also mentions operator expectations for Vercel/GitHub names such as `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` — treat as **documentation expectations**, not proof they exist in the live org.

## Non-claims (mandatory)

1. PGO-04 did **not** call GitHub / Vercel / Netlify / Supabase APIs.
2. PGO-04 did **not** open dashboards or print env values.
3. Presence of `vercel.json` / `netlify.toml` does **not** certify Production env hygiene.
4. Module Staging tracks pending on other worktrees are **not** Platform Core defects.
5. Notification Production Phase 2C remains **`DEFERRED_BY_OWNER`**.

## Certification impact

Without Owner-attested external platform evidence (access control, rotation, Staging↔Production comparison), external platform readiness remains:

```text
EXTERNAL_PLATFORM_EVIDENCE: NOT_VERIFIED
CONTRIBUTES_TO: NOT_READY
```
