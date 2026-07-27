# PUBLIC-CATALOG-02 — Tournament Source Audit

## Finding

No durable **public tournament list** authority exists that can be marked LIVE from:

- club blob / localStorage tournaments
- mock fixtures (`MOCK_TOURNAMENTS`)
- Competition Management CM-06 (dormant; not wired to production runtime)
- Competition Engine in-memory session state

## Classification

**`PROJECTION_REQUIRED`**

Resolved by PC-02:

- Table: `public.public_catalog_tournaments`
- RPC: `public.public_catalog_list_tournaments(p_limit, p_offset, p_sort)`
- Publication: deny-by-default (`publication_state = 'published'` only)
- Empty projection ⇒ LIVE + EMPTY (valid)

## Hard rules enforced

- Tournament LIVE source must be durable canonical projection / certified publication — not mock/fixture/localStorage.
- No participant private data, seeding, staff/referee, financial, or unpublished brackets in DTO.
- Experience Channels / Public Portal is read consumer only.

## Portal cutover

- Env: `VITE_PUBLIC_TOURNAMENTS_RANKINGS_SOURCE=local|remote` (default **local**)
- Remote path: no mock fallback on empty or error
- Clubs/Courts selector `VITE_PUBLIC_CLUBS_COURTS_SOURCE` unchanged
