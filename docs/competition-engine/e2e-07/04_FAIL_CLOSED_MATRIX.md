# E2E-07 — Fail-Closed Matrix

Categories exercised via `runFailClosedCertification.js` using frozen E2E-03/04/05/06 error codes.

| Category | Sample action | Expected code prefix |
|----------|---------------|---------------------|
| tenant/identity | missing tenant, cashier denied, client grants | E2E03_* |
| eligibility/check-in | player check-in when window closed | E2E04_PLAYER_* |
| schedule/court | uncertified schedule, court snapshot missing | E2E03_* |
| scoring/validation | referee score when match not active | E2E04_REFEREE_* |
| standings/qualification | knockout without qualification | E2E03_* |
| publication/privacy | public overview on empty/unpublished store | E2E05_* |
| governance/archive | archive before final publish; missing governance record | E2E03_* / E2E06_* |

No new engine behavior is introduced — only existing facade rejections are asserted.
