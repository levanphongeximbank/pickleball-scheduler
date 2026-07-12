# Referee V5 Dependency Inventory

## package.json additions

- `lint:referee-v5`
- `qa:referee-v5:staging-closure`
- `qa:referee-v5:d41-closure`
- `qa:referee-v5:e1-closure`
- `qa:referee-v5:http`
- `tests/referee-v5/referee-v5-e1-realtime.test.js` in `test:unit`

## Runtime npm dependencies

No new npm packages required beyond existing `@supabase/supabase-js`.

## Router

Base branch already contains `/dev/referee-v5` stub with SuperAdmin guard.

## Edge

`supabase/functions/referee-v5-match` + `_shared/refereeV5Server.mjs`
