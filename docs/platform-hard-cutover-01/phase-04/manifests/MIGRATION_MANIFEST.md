# Canonical Migration Manifests

**Rule:** Do not invent SQL. Point to authored packages. Missing = `IMPLEMENTATION_REQUIRED`.

## Apply order (Staging rehearsal → Production Owner GO)

| Ord | Family | Exact files (repo) | Expected objects | Verify | Rollback limits | Deps |
|----:|--------|--------------------|------------------|--------|-----------------|------|
| M0 | G3-B12 | `docs/production-security/prod-sec-g3-b12-01/10_*.sql` | lockdown policies | `11_VERIFY.sql` | leave locked | — |
| M1 | Customer | `docs/customer-management/phase-3/10..50_*.sql` | `customers*` | package verify | `90_*.sql` | identity |
| M2 | Finance | `docs/supabase-finance-phase1f.sql` | `finance_*` | static | `docs/supabase-finance-phase1f-rollback.sql` | RBAC perms |
| M3 | CRM | `docs/crm/phase-1g/10..60_*.sql` + `phase-1h/10,20_*.sql` | `crm_*` | phase-1h verify | staging rollback SQL | Customer optional |
| M4 | Reporting | `docs/reporting-analytics/reporting-02/10..50_*.sql` | reporting tables | `99_*.sql` | `90/91_*.sql` | — |
| M5 | News | `docs/news-public-content/news-02/10..60_*.sql` + news-03 + news-04 public RPC | `news_*` + public RPC | `99_*.sql` | `90_*.sql` | — |
| M6 | Coaching | `docs/coaching-training/coaching-02/10..60_*.sql` + coaching-04 helpers/RLS/RPC | `coaching_*` | `99_*.sql` | `90_*.sql` | Player/Court |
| M7 | Competition Core cc02 | `docs/competition-core/supabase-cc02*.sql` | `player_ratings`/`rating_history` (Elo internal) | staging evidence | recreate | CORE flag |
| M8 | Competition Remote SSOT | `docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/10..50_*.sql` | `competition_ssot_*` + finalize RPC | `99_VERIFY.sql` | `90_ROLLBACK.sql` | identity `user_venue_id` |
| M9 | Team Tournament remainder | Staging families `phase_tt2*..tt6b_*` (promote; do not invent) | TT RPCs beyond P1 | staging verify | partial | TT P1 present |
| M10 | Referee V5 | Staging `phase_v5a_referee*`,`phase_v5d*` | referee V5 RPCs | staging | partial | M8 preferred |
| M11 | Private pairing digest | Staging `private_pairing_pr4_digest_patch` | digest patch | — | — | RC1 on Prod |

## Status notes

- M9/M10: packages live as **Staging migrations** — promote via Owner-approved migration export; not reinvented here.
- M8: **authored in this Phase 4 package** — NOT applied.
- Flags remain OFF until Phase 5 GO.
