# CC-10 Stage 1B — Live Rollback Drill

**Verdict:** PASS

1. Recorded active SHADOW flags
2. Set `VITE_COMPETITION_CORE_ENABLED=false` on Preview
3. Redeployed → `dpl_CNXtAjNVjm8v5WoP6CikGTFiRazz` (`dihmd2hl8`)
4. Verified app loads (HTTP 200); no data reconciliation required
5. Restored `VITE_COMPETITION_CORE_ENABLED=true`
6. Redeployed shadow → `dpl_HToia5DeXRGEA6De1kMdi5MSiBBL` (`c5irmeat1`)

Production flags: **NOT CHANGED**

Evidence: `qa-evidence/phase-cc10-stage1-live/ROLLBACK_DRILL.json`
