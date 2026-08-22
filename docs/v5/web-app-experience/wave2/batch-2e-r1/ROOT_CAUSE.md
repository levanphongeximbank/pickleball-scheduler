# Batch 2E-R1 — ROOT CAUSE

## PLAYERS_BLANK_ROOT_CAUSE

`/players` threw `ClubContextError: CLUB_REQUIRED` during render because club-scoped helpers ran in the parent `Players()` body **before** `PlatformContextReadinessGate` could short-circuit.

Gate JSX does not protect hooks/`useMemo` that execute earlier in the same component.

## CLUB_SCOPED_CALL_BEFORE_READINESS

YES

Primary live crash sites (pre-fix):

1. `useState(() => normalizePlayers(loadPlayersFromStorage()))` — storage load with no clubId on init
2. `useMemo(() => getTodayCheckedInPlayerIds(activeClubId), …)` — unconditional club-scoped helper

## EXACT_CALLSITE

`src/pages/Players.jsx` — parent-level `useState` initializer + `checkedInIds` `useMemo` calling club storage helpers while `activeClubId` was empty/pending.

## FIX

1. Shell/child split: `Players` only resolves platform mode + wraps `PlatformContextReadinessGate`; club-dependent hooks live in `PlayersReadyContent` (mounted only when gate is ready, or when platform mode does not require club).
2. `resolveExplicitClubId` + guards: never call club-scoped helpers / mutations without a non-empty canonical clubId.
3. No fake clubId, no first-club fallback, no catch-and-ignore of `CLUB_REQUIRED`.

## PLATFORM_MODE_CLUB_REQUIREMENT

Platform-wide athlete viewer mode does **not** require `activeClubId` for platform list reads. Club-scoped mutations still require canonical clubId.

## CLUB_MODE_CLUB_REQUIREMENT

YES — club mode requires resolved canonical club via existing readiness gate.

## CLUB_MEMBERS_500_ROOT_CAUSE

Preview Console shows `club_members?select=club_id…` HTTP 500. Client shape matches pre-existing entitlement/membership reads (e.g. `club_id, tenant_id, user_id, status`), not a 2E Players UI adoption change. Classification: **pre-existing Preview/Staging backend or RLS/data issue** (not malformed 2E client request). Fixing it requires DB/RLS/SQL → **out of scope for 2E-R1**; do not execute SQL.

## CLUB_MEMBERS_500_INTRODUCED_BY_2E

NO

## CLUB_MEMBERS_500_USER_VISIBLE_IMPACT

Non-blocking on Dashboard / Audit / Courts (pages still render). On Players, blank screen was caused by `CLUB_REQUIRED` throw, not by the 500 alone.
