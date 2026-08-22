# 02 — Guest-Safe Tournament Read Trace

**Phase:** Wave 1 Audit / Plan  
**Canonical route:** `/tournament/:tournamentId/public`  
**UI freeze:** `TOURNAMENT_23_SCREEN_UI_REDESIGN=NO`

---

## Dependency trace (current)

```text
PUBLIC ROUTE /tournament/:tournamentId/public
→ router.jsx (outside MainLayout; no RouteAccessGate)
→ PublicTournamentExperienceLayout
   → TenantProvider → VenueProvider → ClusterProvider → ClubProvider → SeasonProvider
→ IndividualPublicExperiencePage
→ useClub() → activeClub, revision, clubScopeReady
→ GATE: if !clubScopeReady → infinite loading (guests stay "idle")
→ useCanonicalTournament(activeClub, tournamentId, revision)
→ getTournamentQuery(clubId, tournamentId, { tenantId })
→ cloudTournamentRepository.get
→ RPC canonical_tournament_get(p_tenant_id, p_club_id, p_tournament_id)
→ DATA AUTHORITY: canonical_tournaments (authenticated; anon EXECUTE revoked)
→ derivePublicExperienceModel(tournament)  // presentation only
→ frozen #23 tabs UI
```

Evidence files:

- `src/router.jsx`
- `src/features/tournament/experience-a1/layouts/PublicTournamentExperienceLayout.jsx`
- `src/features/tournament/experience-a1/pages/IndividualPublicExperiencePage.jsx`
- `src/context/ClubContext.jsx` (hydrate only if `isAuthenticated && user?.id`)
- `src/features/tournament/hooks/useCanonicalTournament.js`
- `src/features/tournament/services/tournamentQueries.js`
- `src/features/tournament/repositories/cloudTournamentRepository.js`
- SQL evidence: `docs/v5/qa-evidence/tournament-canonical-runtime-cutover-01/sql/10_CANONICAL_TOURNAMENTS.sql` (REVOKE FROM anon)

---

## Answers B1–B8

### B1 — Why depend on `activeClub`?

UI composition passes `activeClub` into `useCanonicalTournament`, which requires `clubId` + explicit `tenantId` for the canonical get composite key. Page also waits for `clubScopeReady`, which only authenticated membership hydration sets to `"ready"`.

### B2 — Domain vs adapter?

**Both.** Adapter requires club object; domain RPC is tenant+club+id + `tournament.view`, authenticated-only. Not UI-only.

### B3 — Can tournament ID alone resolve with existing infra?

**No.** No id-only get in tournament repo. Public catalog has **`public_catalog_list_tournaments` only** — no `public_catalog_get_tournament` / `public_get_tournament`. Competition-engine public facade exists but is unwired and still needs tenant/competition scope.

### B4 — Existing reusable public/read-only adapter?

| Piece | Reuse? |
|-------|--------|
| `derivePublicExperienceModel` | YES — presentation sanitizer (keep) |
| `individualPublicTournamentPath` | YES — URL helper |
| Public catalog list facade | List only — not #23 payload |
| CE `createPublicCompetitionExperienceFacade` | Parallel model; **not** production-wired to this route |
| `getTournamentQuery` | Organizer — **not** guest-safe |

**No production guest-safe detail reader exists today.**

### B5 — Narrowest classification for anonymous published payload

```text
SQL_REQUIRED
```

Follow-on client work after SQL:

```text
NEW_READ_ADAPTER_REQUIRED  (thin; maps public projection → model for derivePublicExperienceModel)
```

Not `REUSE_EXISTING_READ` for guest data. Not `DOMAIN_CHANGE_REQUIRED` if projection get is additive (PC-02 pattern). Not “open organizer get to anon.”

Wave 1A link/hang/amenities work alone is **not** this classification (`SQL_REQUIRED=NO` for 1A).

### B6 — Can fix avoid forbidden changes?

| Concern | Avoidable? |
|---------|------------|
| Tournament authority / writers | YES |
| #23 visual redesign | YES |
| PR #463 / canonical-shell | YES |
| SQL for real guest payload | **NO** |
| Weakening organizer RLS / opening `canonical_tournament_get` to anon | **MUST AVOID** |

### B7 — Exact files/functions likely to change

**Wave 1A (no SQL):**

- `TournamentCard.jsx` — CTA path via `individualPublicTournamentPath`
- `PublicHeader.jsx` / `PublicFooter.jsx` — Giải đấu / footer targets
- `IndividualPublicExperiencePage.jsx` — **read-integration only**: do not wait forever on `clubScopeReady` for guests; show honest not-found/unavailable until 1B exists (**no visual redesign** of tabs/layout)
- Possibly `PublicTournamentExperienceLayout.jsx` — only if ClubProvider can be dropped after read swap (prefer defer until 1B)

**Wave 1B (SQL workstream — do not write SQL in this plan):**

- New SECURITY DEFINER RPC / projection get (PC-02 style), anon EXECUTE, published-only
- New client `getPublicTournament…` / `usePublicTournament` under public-catalog or public-portal
- Minimal wiring in `IndividualPublicExperiencePage` to call public reader instead of `useCanonicalTournament(activeClub,…)`
- ID contract: catalog id ↔ organizer id (or store organizer id in projection)

**Must not change:** `canonical_tournament_get`, tournament writers, organizer Experience screens 1–22, `src/features/canonical-shell/**`

### B8 — Required tests

```text
ANONYMOUS_USER → /public/tournaments → allowed
ANONYMOUS_USER → /tournament/:id/public → route allowed; never infinite load
ANONYMOUS_USER → published tournament (after 1B) → loads public-safe payload
ANONYMOUS_USER → unpublished / missing → honest empty/not-found (fail closed)
ANONYMOUS_USER → /tournaments or /tournaments/:id → denied/redirect login OR soft-redirect to public discovery
AUTHENTICATED organizer → /tournaments/:id and Experience routes → unchanged
ANON client → cannot execute canonical_tournament_get
```

```text
FAIL_CLOSED_IF_PUBLIC_READ_UNSAFE=YES
```

Until 1B ships, Wave 1A must **not** fake tournament detail content.

---

## SQL / backend authority gate

```text
SQL_REQUIRED=YES   # for guest published tournament payload (Slice 1B)
SQL_GO=NO          # Owner lock this phase — DO NOT WRITE SQL
STAGING_MUTATION_REQUIRED=YES  # only after future SQL GO
PRODUCTION_MUTATION_REQUIRED=NO  # never in Wave 1 planning
```

### Why SQL is required (blocker)

1. `canonical_tournament_get` is correctly revoked from `anon`.  
2. No existing anon detail RPC for experience-grade public payload.  
3. List projection (`public_catalog_tournaments` + list RPC) is insufficient for `#23` tabs (schedule/live/standings/bracket need richer published projection).  
4. Weakening organizer get would violate security.

### Existing policy evidence to follow (later workstream)

PC-02 pattern: deny-by-default table RLS + SECURITY DEFINER list RPC with `GRANT EXECUTE TO anon` — see `docs/public-catalog/pc-02/10_PUBLIC_CATALOG_02_PUBLIC_READ_RPC.sql`. Extend with a **get** (or published experience projection), not open organizer tables.

### Separate backend workstream required?

```text
YES — Public Tournament Public-Read SQL package (Owner SQL GO separate)
```

Client adapter depends on that package. Wave 1A can proceed without it.

---

## #23 freeze — what may touch Experience files

| File | Change type | UI redesign? | Unavoidable? |
|------|-------------|--------------|--------------|
| `IndividualPublicExperiencePage.jsx` | Swap data source / guest gate | NO (same tabs/layout) | YES for hang fix + later 1B wire |
| `PublicTournamentExperienceLayout.jsx` | Provider slim-down | NO | MAYBE after 1B |
| `derivePublicExperienceModel.js` | Prefer reuse unchanged | NO | Only if projection shape differs |
| Organizer Experience pages 1–22 | — | — | **MUST_NOT_CHANGE** |

Prefer: **PUBLIC ROUTE / READ INTEGRATION FIX** over visual changes.

---

## Guest-safe strategy statement

```text
ACTIVE_CLUB_DEPENDENCY_ROOT_CAUSE=
Page + useCanonicalTournament require club-scoped authenticated canonical get;
guests never become clubScopeReady.

GUEST_SAFE_READ_STRATEGY=
1A: fail-closed honest empty + correct public URLs (no fake data).
1B: new published projection GET (SQL) + thin NEW_READ_ADAPTER → feed existing
derivePublicExperienceModel; keep frozen #23 UI; never open organizer get to anon.

REUSE_EXISTING_READ=NO (for guest payload)
REUSE_PRESENTATION=YES (derivePublicExperienceModel, individualPublicTournamentPath)
NEW_AUTHORITY_REQUIRED=NO
NEW_WRITER_REQUIRED=NO
```
