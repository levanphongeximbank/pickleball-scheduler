# Security Invoker Views — Final Fixture QA Evidence

Date: 2026-08-04 (Asia/Saigon)

Environment: **Staging only** (`qyewbxjsiiyufanzcjcq`)

Baseline: PR #359 merge commit `d800d2f9`

## Verdict

**AUTHENTICATED TENANT A/B: PASS**

**OVERALL SECURITY CERTIFICATION: BLOCKED — ANON READ EXPOSURE CONFIRMED**

## Controlled fixtures

Two non-sensitive `club_data_v3` rows and two matching `club_governance` rows were created with fixed IDs:

- `phase6-security-invoker-qa-a` → `venue-staging-a`
- `phase6-security-invoker-qa-b` → `venue-staging-b`

Payloads contained only a QA marker and tenant letter. No user or business data was used.

## Results

| Actor | `tenants` | `club_data_v3_safe` | Foreign tenant visible | Result |
|---|---|---|---|---|
| Owner A | only `venue-staging-a` | exactly fixture A | No | PASS |
| Owner B | only `venue-staging-b` | exactly fixture B | No | PASS |
| anon | not part of authenticated matrix | fixtures A and B | **Yes** | **FAIL** |

Both Owner probes used real Supabase authenticated JWTs and the public anon key. The harness was read-only and reported `status: PASS` for the authenticated matrix.

## Root cause evidence

`public.club_data_v3_safe` is correctly `security_invoker=true`, so the underlying table policies now apply. The underlying table still contains:

```text
club_data_v3_anon_select | SELECT | {anon} | USING (true)
```

Therefore anon could select both temporary rows through the view. The view redaction removes `players` and `members` for an unauthorized viewer, but still exposes row existence, `club_id`, `venue_id`, timestamps, version, and all other unredacted JSON keys.

## Cleanup proof

Cleanup deleted exactly the two temporary `club_data_v3` rows followed by the two matching `club_governance` rows.

```json
{"club_data_remaining":0,"governance_remaining":0}
```

Mutation accounting: 4 temporary rows inserted, 4 temporary rows deleted, net fixture rows 0. Production access and mutations: 0.

## Required remediation before certification

Prepare a separate Staging-only migration to remove or constrain the three legacy anon policies on `public.club_data_v3` (`SELECT`, `INSERT`, `UPDATE`), with rollback and authenticated/anon verification. Do not apply it until Owner approval. Production GO remains unchanged.
