# 00 — Wave 1 Audit / Plan

**Workstream:** PICK_VN — PUBLIC WEB EXPERIENCE  
**Phase:** PUBLIC WAVE 1 — AUDIT / PLAN ONLY  
**Date:** 2026-08-22  
**Branch:** `feat/public-web-experience-01`  
**HEAD / origin/main:** `0fefcb7ddb7f3d637d6fabe51c5b1b670c96978c`

```text
IMPLEMENTATION_STARTED=NO
APPLICATION_CODE_CHANGED=NO
PR_463_TOUCH=DENY
TOURNAMENT_23_SCREEN_UI_REDESIGN=DENY
SQL_GO=NO (locked this planning phase)
PREEXISTING_AUDIT_DOCS=docs/audits/public-web-experience/*.md (preserved)
```

Owner architecture locks from Master Audit review are accepted and not reopened except where evidence creates an **implementation safety conflict** (see SQL gate below).

---

## Wave 1 objective (locked)

Establish a truthful, safe Public Web integrity foundation:

| Item | Objective |
|------|-----------|
| A | Public/private route integrity |
| B | Guest-safe canonical Tournament Public read path |
| C | Public Header/Footer/Navigation integrity |
| D | Tournament discovery/card CTA destination integrity |
| E | Remove UNSAFE_LOOKS_REAL court amenities |
| F | Preserve Tournament Experience #23 without redesign |

---

## Final planning verdict

```text
FINAL_VERDICT=WAVE_1_PLAN_COMPLETE_IMPLEMENTATION_CONDITIONAL
WAVE_1_SCOPE_READY=YES
WAVE_1_IMPLEMENTATION_READY=CONDITIONAL
```

### Why CONDITIONAL

Wave 1 has **two slices** with different readiness:

| Slice | Contents | SQL | Ready under current Owner locks? |
|-------|----------|-----|----------------------------------|
| **1A — Integrity (no SQL)** | Nav/footer rewires; TournamentCard → `#23` URL; optional anon soft-redirect; stop `#23` infinite load (honest empty/not-found); omit invented LIVE amenities | `SQL_REQUIRED=NO` | **YES** — can receive `OWNER GO IMPLEMENT` |
| **1B — Guest published tournament payload** | Anon SECURITY DEFINER get/projection + thin read adapter feeding `derivePublicExperienceModel` without `activeClub` | `SQL_REQUIRED=YES` | **NO** while `SQL_GO=NO` — must not weaken `canonical_tournament_get` |

Opening organizer RPC `canonical_tournament_get` to `anon` is **DENIED** (would weaken security).

---

## Root causes (summary)

### Public route integrity

Guests are sent to authenticated My Tournaments hub (`/tournaments`) and organizer detail (`/tournaments/:id`) from public chrome and cards, while canonical guest discovery is `/public/tournaments` and detail is `/tournament/:id/public`.

### `activeClub` dependency

`IndividualPublicExperiencePage` gates on `clubScopeReady` and calls `useCanonicalTournament(activeClub, id)`. Guests never reach `clubScopeReady === "ready"` (`ClubContext` only hydrates when authenticated) → **infinite loading**. Even if the gate were removed, `canonical_tournament_get` is authenticated + tenant/club scoped + revoked from anon.

### Fake amenities

`mapLiveCourts()` hardcodes `amenities: ["Đèn LED", "Sân chuẩn"]`. Public `CourtCard` does not currently render amenities, but the LIVE DTO still lies.

### Tournament card IDs

```text
TOURNAMENT_CARD_ID_SEMANTICS=OPAQUE_PORTAL_CARD_ID
PUBLIC_DETAIL_ID_COMPATIBLE=PARTIAL
```

Catalog projection `id` is text PK (may be synthetic). Organizer `#23` expects organizer tournament UUID. Mapping is **not proven**. Wave 1 must fail closed when incompatible; full ID contract is part of 1B/SQL workstream.

---

## Recommended Owner GO path

1. **Approve Wave 1A implement now** (integrity + honesty + CTA URLs).  
2. **Authorize a separate Public Tournament Public-Read SQL workstream** (or lift `SQL_GO` for a scoped package) before claiming “anonymous loads published tournament.”  
3. Do **not** redesign `#23` UI; do **not** touch PR #463 / canonical-shell.

---

## Plan document index

1. `01-PUBLIC-ROUTING-INTEGRITY.md`  
2. `02-GUEST-SAFE-TOURNAMENT-READ-TRACE.md`  
3. `03-PUBLIC-NAVIGATION-AND-CTA-MATRIX.md`  
4. `04-LIVE-COURT-DATA-TRUTH-PLAN.md`  
5. `05-WAVE-01-IMPLEMENTATION-CHANGESET.md`  
6. `06-WAVE-01-TEST-AND-OWNER-PREVIEW-PLAN.md`

```text
PUBLIC_WAVE_1_AUDIT_PLAN_COMPLETE=YES
WAITING_FOR_OWNER_GO_IMPLEMENT=YES
```
