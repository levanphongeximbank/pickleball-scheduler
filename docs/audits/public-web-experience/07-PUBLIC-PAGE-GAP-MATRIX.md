# 07 — Public Page Gap Matrix

**Audit date:** 2026-08-22  

Legend:

| Status | Meaning |
|--------|---------|
| EXISTS_AND_CANONICAL | Suitable primary surface |
| EXISTS_NEEDS_CONVERGENCE | Keep structure; fix visuals/data/links/semantics |
| PARTIAL | Incomplete capability |
| DUPLICATE | Competes with canonical |
| MOCK_ONLY | Primarily mock without live path |
| MISSING | Not present |
| BLOCKED_BY_DOMAIN_OR_RUNTIME | Present but runtime/domain prevents true public use |

---

## Gap matrix

| Surface | Status | Evidence | Data readiness | UX readiness | Responsive | Production readiness | Recommended Wave |
|---------|--------|----------|----------------|--------------|------------|----------------------|------------------|
| Homepage | EXISTS_NEEDS_CONVERGENCE | `HomePage.jsx` | Mixed SAFE + REAL | Strong visual draft | NOT_TESTED | No | Wave 2 |
| Tournament Discovery | EXISTS_NEEDS_CONVERGENCE | `/public/tournaments` | Remote-capable | Good list UX; **wrong detail CTA** | NOT_TESTED | No | Wave 1+3 |
| Canonical Public Tournament Page | EXISTS_AND_CANONICAL (+ runtime block) | `/tournament/:id/public` #23 | Club-scoped | Tabs overview…media | NOT_TESTED | Partial | Wave 3 (read adapter); **no UI redesign** |
| Competing tournament detail from cards | DUPLICATE | `/tournaments/:id` via `TournamentCard` | Auth | Wrong for guests | — | Blocker | Wave 1 |
| Club Discovery | EXISTS_NEEDS_CONVERGENCE | `/clubs` | Mock-heavy OK labeled | Cards loop to list | NOT_TESTED | No | Wave 4 |
| Club Detail | PARTIAL / EMPTY | `/clubs/:id` → not-found | None | Honest stub | NOT_TESTED | No | Wave 4 |
| Court Cluster Discovery | EXISTS_NEEDS_CONVERGENCE | `/courts` facility-like | Mock + live map | Semantics unclear vs cụm sân | NOT_TESTED | No | Wave 5 |
| Court Cluster Detail | MISSING (stub only) | not-found page | None | Stub | NOT_TESTED | No | Wave 5 |
| Physical courts inside cluster | MISSING | court-cluster feature unwired | Domain exists offline/auth | — | — | No | Wave 5 |
| Rankings | EXISTS_NEEDS_CONVERGENCE | `/rankings` | VPR/remote/mock | Table; no player link | NOT_TESTED | No | Wave 6 |
| Public Player Profile | MISSING (guest) | `/athletes` is auth | — | — | — | No | Wave 6 |
| News Listing | EXISTS_NEEDS_CONVERGENCE | `/news` | Live default | List cards only | NOT_TESTED | PARTIAL | Wave 7 |
| News Detail | MISSING | no route | SEO contract unused | — | — | No | Wave 7 |
| Search | MISSING | no `/search` | In-page filters only | — | — | No | Wave 7 or later |
| Login | EXISTS_NEEDS_CONVERGENCE | `/login` | Auth | App shell look | NOT_TESTED | Auth OK; brand no | Wave 8 |
| Registration | PARTIAL | signup mode on login | Flag-gated | Same | NOT_TESTED | Partial | Wave 8 |
| Public Header | EXISTS_NEEDS_CONVERGENCE | `PublicHeader` | — | Nav miswire | NOT_TESTED | No | Wave 1 |
| Public Footer | EXISTS_NEEDS_CONVERGENCE | `PublicFooter` | Placeholder links | Present | NOT_TESTED | No | Wave 1 |
| Public Mobile Navigation | EXISTS_NEEDS_CONVERGENCE | Drawer | — | Present | NOT_TESTED | No | Wave 1 / 9 |
| SEO | PARTIAL / FAIL | title hook only | — | — | — | No | Wave 7 |
| Social Sharing | MISSING / FAIL | no OG | — | — | — | No | Wave 7 |

---

## Homepage classification

```text
HOMEPAGE_DECISION=CONVERGE
```

Evidence: real layout, sections, honesty notices, and data adapters exist. Not fundamentally unsuitable (would need REBUILD only if Owner rejects navy/lime direction). Fix links, data truth edge cases, and conversion paths.

---

## CỤM SÂN vs physical court — canonical finding

```text
COURT_CLUSTER_SEMANTICS=PARTIAL_FACILITY_CARDS_NOT_WIRED_TO_CỤM_SÂN_DOMAIN
PHYSICAL_COURT_SEMANTICS=PRESENT_IN_CATALOG_DTO_AND_ADMIN_NOT_IN_PUBLIC_UX
COURT_DOMAIN_COLLISION_FOUND=YES
```

**WHAT EXISTS:** `/courts` cards with name, address, `courtCount`, price (mock), amenities.  
**WHAT IS WRONG:** Copy says “Sân pickleball”; live amenities invented; true `court-cluster` domain unused; detail missing; catalog DTO looks like physical courts.  
**WHY IT MATTERS:** Guests and organizers confuse facility vs court booking/assignment.  
**LATER WAVE:** Wave 5 — converge discovery to CỤM SÂN / cơ sở; detail lists physical courts as children.

---

## Tournament funnel finding

```text
PUBLIC_TOURNAMENT_CANONICAL_ROUTE=/tournament/:tournamentId/public
DUPLICATE_TOURNAMENT_DETAIL_FOUND=YES
DISCOVERY_ENTERS_CANONICAL_PUBLIC_PAGE=NO
```

---

## Public / private boundary summary

| Check | Result |
|-------|--------|
| Public pages incorrectly requiring login | Layout OK; **CTAs** send guests into auth routes |
| Private routes unintentionally public | No evidence MainLayout routes are open |
| Public depending on auth shell | #23 uses ClubProvider scope — runtime coupling |
| Admin controls on public | Not observed on PublicLayout pages |
| Private tenant data on public reads | Amenities invention; monitor catalog DTOs |

```text
PUBLIC_PRIVATE_BOUNDARY_STATUS=PARTIAL
```
