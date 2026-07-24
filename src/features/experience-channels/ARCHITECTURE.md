# Experience Channels Architecture (EC-00)

**Module home:** `src/features/experience-channels/`

**Status:** Architecture & ownership foundation only. Contracts + frozen registries + certification. **Not wired** into `src/router.jsx`, `src/main.jsx`, App shell, or provider trees.

**Baseline:** EC-00 Channel Architecture & Ownership Foundation.

---

## Purpose / Ownership

Experience Channels owns the **presentation-channel architecture map**:

- stable channel descriptors (`channelId`, visibility, surfaces, readiness);
- route / shell / provider ownership inventories;
- collision classifications (including Competition E2E defer markers);
- Web / PWA / future iOS / Android readiness metadata;
- architecture certification helpers.

> Registry describes presentation ownership only. It does not encode ranking, rating, scoring, standings, eligibility, finance, scheduling, or competition rules.

---

## Explicit non-ownership

| Concern | Owner |
|---------|--------|
| Global router / main entry / app shell edits | Platform / existing app (high collision — deferred) |
| Competition Engine integration | Competition E2E workstream |
| Competition Management domain contracts | `src/features/competition-management` |
| Notification delivery / queue / providers | Notification module |
| Native iOS / Android store binaries | Not started (0%) |
| SQL / RLS / Supabase | Out of scope |

---

## Layering

```
index.js         Public facade (safe re-export; no runtime wiring)
constants/       Enums and allowlists
contracts/       Descriptor factories (pure)
registry/        Frozen channel + ownership registries
validation/      Deterministic certification helpers
```

---

## EC-00 non-goals

- No new pages or route behavior changes
- No UI visual changes
- No Capacitor / React Native / Expo
- No package.json dependency additions for this foundation
- No SQL / RLS / notification backend changes
