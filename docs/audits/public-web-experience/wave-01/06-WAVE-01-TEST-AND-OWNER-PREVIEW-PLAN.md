# 06 — Wave 1 Test and Owner Preview Plan

**Phase:** Plan only  
**Owner visual acceptance required after implementation.**  
**Test PASS ≠ Owner GO.**

---

## Unit / component tests

| Area | Assert |
|------|--------|
| PublicHeader | Guest “Giải đấu” href === `/public/tournaments` |
| PublicHeader mobile drawer | Same target |
| PublicFooter | “Ban tổ chức giải” not `/tournaments` hub (per Owner choice) |
| TournamentCard | With id → `/tournament/{id}/public` (via `individualPublicTournamentPath`) |
| TournamentCard | Without id → `/public/tournaments` |
| `mapLiveCourts` | No `"Đèn LED"` / `"Sân chuẩn"` invented amenities |
| Guest #23 composition | Does not spin forever when unauthenticated |
| (1B later) Public reader | Maps published projection; strips forbidden keys |

---

## Route tests

```text
anonymous → /public/tournaments = allowed
anonymous → /tournament/:id/public = allowed (route); honest empty until 1B
anonymous → /tournaments = denied/login OR soft-redirect to /public/tournaments
anonymous → /tournaments/:id = denied/login (organizer protected)
authenticated → /tournaments = hub unchanged
authenticated → /tournaments/:id = organizer unchanged
anonymous → cannot call canonical_tournament_get successfully
```

---

## Regression

| Surface | Expectation |
|---------|-------------|
| `canonical-shell/**` | Untouched |
| PR #463 surfaces | Unaffected |
| Tournament #23 visuals | Unchanged (tabs/layout/tokens) |
| Tournament management routes | Unchanged for authed users |
| `/clubs` `/courts` `/rankings` `/news` | Still publicly reachable |
| Login/signup | Still works |

---

## Visual review (Owner)

Viewports for Wave 1 (not full Wave 9):

```text
1440
390
```

### Screenshot targets

```text
OWNER_SCREENSHOT_REVIEW_TARGETS=
1. Homepage with public header (desktop 1440 + mobile 390)
2. Public mobile navigation drawer open (390)
3. Tournament discovery /public/tournaments (1440 + 390)
4. Canonical /tournament/:id/public after CTA click
   - 1A: honest empty/not-found OR loading resolved (no infinite spinner)
   - 1B later: published content
5. Confirm Giải đấu does not land on login wall for guests
```

---

## Exit criteria for Slice 1A

- [ ] Guest nav Giải đấu → `/public/tournaments`  
- [ ] Card CTA → `/tournament/:id/public`  
- [ ] No invented LIVE amenities  
- [ ] Guest #23 does not infinite-load  
- [ ] Organizer `/tournaments` still works when logged in  
- [ ] Unit/route tests PASS  
- [ ] Owner screenshot GO  

## Exit criteria for Slice 1B (future SQL GO)

- [ ] Anon loads **published** tournament into frozen #23  
- [ ] Unpublished fail closed  
- [ ] Organizer RPC still anon-denied  
- [ ] ID contract proven  
- [ ] Owner screenshot GO  

---

## Required tests list (machine)

```text
REQUIRED_TESTS=
- public header Giải đấu target
- public mobile nav Giải đấu target
- TournamentCard public detail URL
- mapLiveCourts amenities truthfulness
- anonymous public tournament list allowed
- anonymous /tournament/:id/public no infinite load
- anonymous organizer routes protected
- authenticated organizer routes unchanged
- regression: public clubs/courts/rankings/news reachable
```
