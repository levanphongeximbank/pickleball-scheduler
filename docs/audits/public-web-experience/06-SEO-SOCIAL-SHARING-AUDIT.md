# 06 — SEO & Social Sharing Audit

**Audit date:** 2026-08-22  
**Architecture:** Vite SPA (`index.html` → `#root`), no prerender/SSR found.

---

## Current global head

**File:** `index.html`

| Tag | Value |
|-----|-------|
| `lang` | `vi` |
| `<title>` | Pickleball Scheduler Pro |
| `meta description` | Quản lý sân, CLB, giải đấu pickleball — Pickleball Scheduler Pro |
| `theme-color` | `#0F172A` |
| PWA manifest | `public/manifest.webmanifest` |
| OG / Twitter | **Absent** |
| Canonical | **Absent** |
| robots.txt | **Absent** |
| sitemap.xml | **Absent** |
| JSON-LD | **Absent** |

Page titles: `usePublicDocumentTitle` → `{page} · PICK_VN` on selected public pages. Does **not** update description or OG tags.

News domain contract (`seoMetadata.js`) exists but is **not wired** to document head on `NewsPage`.

Registry already documents PARTIAL SEO (`publicPortalSurfaceRegistry.js`).

---

## Issue register

| Issue | CURRENT_STATE | RISK | RECOMMENDED_TARGET |
|-------|---------------|------|--------------------|
| Brand mismatch in crawler title | HTML = Scheduler Pro; chrome = PICK_VN | High brand confusion | Align static + dynamic to PICK_VN public brand |
| No per-route meta description | Global only | Medium | Route metadata layer |
| No Open Graph | Absent | High for social | OG title/description/image per entity |
| No Twitter cards | Absent | Medium | twitter:card summary_large_image |
| No canonical URLs | Absent | Medium duplicate risk | Absolute canonical per route |
| No robots.txt / sitemap | Absent | High for discoverability | Generate sitemap of public routes; robots allow public |
| No share images | No OG image assets | High | Default + entity images |
| SPA crawlability | Client-rendered only | **Structural** — bots without JS see only index.html | Prerender or SSR for public routes (later wave; not this audit) |
| News SEO contract unused | Data model only | Medium | Emit head tags from contract |
| Tournament #23 share | No meta; club-scoped load | High | Public metadata + stable public URL |
| Club/court/player/news share | Detail missing or stub | High | Entity pages first, then OG |

---

## Social readiness by entity

| Entity | Route | OG title | OG desc | OG image | Share action | Status |
|--------|-------|----------|---------|----------|--------------|--------|
| Tournament | `/tournament/:id/public` | No | No | No | Copy URL in ops screens only | FAIL |
| Club | detail missing | — | — | — | — | FAIL |
| Court cluster | detail missing | — | — | — | — | FAIL |
| Player | guest profile missing | — | — | — | — | FAIL |
| News article | detail missing | Contract only | Contract only | Ref only | — | FAIL |
| Homepage | `/` `/home` | Static product title | Static | No | — | FAIL |

Platforms (Facebook, Messenger, Zalo preview, X): all blocked by missing OG + SPA limitation.

---

## Structural SEO limitation

```text
STRUCTURAL_LIMITATION=YES
```

Page-level `document.title` alone **cannot** fix:

1. Non-JS crawlers / many social scrapers seeing only `index.html`.  
2. Lack of sitemap/robots.  
3. Lack of OG tags in initial HTML.

**Recommended later approach (proposal only):** prerender critical public routes OR lightweight SSR/meta edge — **do not implement in Phase 0**.

---

## Status

```text
SEO_STATUS=FAIL
SOCIAL_SHARING_STATUS=FAIL
```
