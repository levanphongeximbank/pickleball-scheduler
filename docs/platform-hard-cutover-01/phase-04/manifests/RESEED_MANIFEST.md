# Reseed Manifest

See `sql/reseed/README.md` and `sql/reseed/99_VERIFY_RESEED.sql`.

Deterministic order: Owner tenant → Club → Venue/Courts → Player → Rating → Competition → Participants → Schedule → Match → Finalize (SSOT RPC only) → Rating update (port only) → Catalog.

Not executed in Phase 4.
