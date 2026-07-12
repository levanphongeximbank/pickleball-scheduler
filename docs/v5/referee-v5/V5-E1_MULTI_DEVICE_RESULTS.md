# Referee V5-E1 — Multi-Device Results

**Environment:** Staging (`qyewbxjsiiyufanzcjcq`)  
**Evidence:** `docs/v5/qa-evidence/phase-v5e1/MULTI_DEVICE_SYNC_REPORT.json`

---

## Scenarios

| Case | Expected | Result |
|------|----------|--------|
| R1 — A records rally | B updates without manual reload | See evidence |
| R1 — B receives update | No spurious match_events from B | See evidence |
| Switch ends on A | B court orientation updates | See evidence |
| Undo on A | B state converges | See evidence |
| Concurrent commands | Optimistic locking (V5-D) still applies | HTTP harness 18/18 |

---

## Notes

- Realtime does **not** replace optimistic locking.
- Stale dialog / conflict UI unchanged from V5-D.4.1.
- Secondary device shows **“Cập nhật từ thiết bị khác”** when reload triggered by remote notification.

---

## Verification command

```powershell
node scripts/verify-referee-v5-e1-realtime-browser-staging.mjs
```
