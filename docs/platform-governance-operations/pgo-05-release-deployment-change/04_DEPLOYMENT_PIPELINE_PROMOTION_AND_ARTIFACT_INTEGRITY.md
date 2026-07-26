# 04 — Deployment Pipeline, Promotion And Artifact Integrity

## Integrity principles

1. A release candidate is anchored to an **immutable commit**.
2. A deployable output has an immutable **artifact identity** such as a platform deployment ID and, where available, digest/checksum.
3. **Build provenance** links source commit, build run, inputs, toolchain context, and resulting artifact.
4. Promotion advances the same approved artifact; rebuilding for the next environment creates a new artifact requiring a new integrity comparison.
5. Every deployment has a distinct **deployment identity**, environment, actor/automation, timestamp, artifact reference, and outcome.

## Evidence chain

```text
change record → reviewed PR → immutable commit → CI/build run
→ artifact identity → release candidate → promotion approval
→ deployment identity → activation decision → post-deploy result
```

A broken link prevents Production certification.

## Environment separation and promotion

| Control | Requirement |
|---|---|
| Environment identity | Development, Test, Preview, Staging, and Production must be named explicitly under PGO-04. |
| Access separation | Technical access does not grant promotion or Production approval authority. |
| Artifact continuity | Record whether the same artifact is promoted; record and reassess any rebuild. |
| Configuration separation | Environment configuration is governed and evidenced separately under PGO-04. |
| Approval | Production promotion/activation requires explicit Owner GO and relevant Platform/Security/Database authority. |
| Evidence | Source and target identities, artifact match, deployment result, and post-deploy verification are retained. |

## Preview is not Production

**A Preview deployment is not a Production deployment.** Preview success may support candidate evidence, but it cannot substitute for a Production deployment identity, Production configuration evidence, Production approval, or Production post-deployment verification.

Similarly:

- Green CI is not Production deployment evidence.
- A merged PR is not a Production release.
- A hosting capability or repository config is not proof that the live project is configured.

## External-platform boundary

The repository may prove workflow/configuration intent. Only appropriately authorized, retained external-platform evidence can establish actual deployment identity, project/environment linkage, and console state. PGO-05 did not access GitHub, Vercel, Netlify, or Supabase consoles/APIs.

```text
EXTERNAL_PLATFORM_EVIDENCE: NOT_VERIFIED
```

## Manual drift prohibition

Unrecorded manual changes to artifact contents, environment configuration, routing, secrets, schema, deployment settings, or activation state are prohibited. An emergency manual action must be:

1. authorized under break-glass governance;
2. linked to an incident/change record;
3. captured as before/after evidence without credentials;
4. reconciled to the source of truth;
5. independently reviewed in the retrospective.

## Current evidence status

No artifact-integrity attestation, environment-promotion evidence, verified Production deployment identity, or Owner Production approval was produced in this documentation-only implementation. Readiness remains **`NOT_READY`**.
