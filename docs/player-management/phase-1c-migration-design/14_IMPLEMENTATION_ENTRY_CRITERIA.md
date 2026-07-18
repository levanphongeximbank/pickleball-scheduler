# 14 — Implementation Entry Criteria

A **SQL implementation task** (separate branch) may begin only when:

1. Owner accepts **Option A — extend profiles** (or explicitly overrides in writing)  
2. This design pack is reviewed (files 00–13)  
3. Non-auth deferral is accepted  
4. Dual-write cutover responsibilities assigned (Identity vs Player)  
5. No Staging/Production apply requested yet without Staging plan ownership  

## Next task shape (recommendation)

`feature/player-phase-1c-migration-sql` (name TBD) to author **executable additive SQL + rollback** from this design — still no Production apply until Staging PASS.

## Still out of scope until later

- Phase 1D lifecycle UI  
- Phase 1E public endpoint  
- Option B `player_profiles`  
- Competition / Club / Venue / Rating / Ranking runtime changes  
