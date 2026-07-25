# NEWS-04 Certification Notes

## Local gates (required)

1. NEWS-04 focused tests
2. NEWS-01/02/03 regression
3. Public Portal / Experience Channels tests
4. Platform adoption related News architecture tests
5. `npm run ci:foundation-lock`
6. `npm run lint:no-new`
7. `npm run test:unit`
8. `npm run build`
9. `git diff --check`
10. package/lockfile hash unchanged
11. context-aware secret scan on changed files
12. changed-file scope verification

## Declared exclusions

- Production database apply not performed (Owner GO required for any Production write)
- Production config unchanged
- NEWS-02/03/04 SQL LIVE-only public contract aligned in-repo; **Staging LIVE-only remediation applied + certified** (see `NEWS_04_STAGING_PUBLIC_RPC_CERTIFICATION.md`)

## Marker (when gates pass + commit + push + PR)

`NEWS_04_PASS_COMMITTED_PUSHED_PR_OPEN`
