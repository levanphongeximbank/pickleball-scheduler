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

- Staging/Production database apply not performed in NEWS-04
- Production config unchanged
- SQL packages NEWS-02/03 unchanged

## Marker (when gates pass + commit + push + PR)

`NEWS_04_PASS_COMMITTED_PUSHED_PR_OPEN`
