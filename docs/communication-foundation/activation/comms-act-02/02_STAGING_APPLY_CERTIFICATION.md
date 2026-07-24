# COMMS-ACT-02 — Staging Apply Certification

**Verdict:** `GO_STAGING_PERSISTENCE`
**Date:** 2026-07-24
**Target:** Staging `qyewbxjsiiyufanzcjcq` only
**Production:** BLOCKED (`expuvcohlcjzvrrauvud`)

## Scope completed

1. Gate A live preflight (backup + Owner GO + target + SQL bind) — PASS
2. Owner SQL Editor apply of `docs/supabase-communication-comms05.sql` (run count 1) — PASS
3. Gate B post-apply inventory (PostgREST anon deny-all) — PASS
4. Owner final catalog verification — PASS (`FINAL_VERIFICATION_SUCCESS`)

## Certified remote state (Staging)

| Gate | Status |
|------|--------|
| Communication tables | 14 present |
| RLS enabled | 14 / 14 |
| Client policies | deny-all (14); no permissive open |
| Realtime publication | **not enabled** (0 rows) |
| Club/Community client RLS | **not opened** |
| Production | **not touched** |

## Explicitly out of scope (still blocked)

- Enabling `supabase_realtime` for `communication_*`
- Opening permissive Club / Community client RLS / GRANTs
- Production apply
- Trusted service-role smoke seed / Direct-Club-Community end-to-end live smoke
- App runtime Production mode cutover

## Evidence index

| Artifact | Path |
|----------|------|
| Gate A | [`evidence/GATE_A_PREFLIGHT_2026-07-24.md`](./evidence/GATE_A_PREFLIGHT_2026-07-24.md) |
| Gate B | [`evidence/GATE_B_POST_APPLY_2026-07-24.md`](./evidence/GATE_B_POST_APPLY_2026-07-24.md) |
| Staging evidence | [`evidence/STAGING_ACTIVATION_EVIDENCE_2026-07-24.md`](./evidence/STAGING_ACTIVATION_EVIDENCE_2026-07-24.md) |

## Next Owner gates (not ACT-02)

1. Trusted-backend Staging smoke (service-role / injected adapter) — optional follow-on
2. Client RLS open for Club/Community — separate GO after membership SQL mapping
3. Realtime publication — separate GO after persistence + RLS smoke
4. Production — blocked until all Staging gates pass
