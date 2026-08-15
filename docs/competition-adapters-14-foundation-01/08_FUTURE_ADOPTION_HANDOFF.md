# 08 — Future adoption handoff

This PR freezes contracts. It does **not** cut over Daily Play, Internal, Official, or Team Tournament onto the new catalog.

## Do next (separate workstreams)

1. Identity — keep using the binding; remove direct tournament → `auditService` / permission internals (documented coupling in `publishScheduleEngine` / `publishDrawEngine`).
2. Tenant — introduce a real organization authority only if Owner creates that domain. Until then keep `organizationId` distinct and NOT_CONFIGURED.
3. Participant — production-enable canonical player repository flag only under its own GO.
4. Club/Team — optional future team-evidence provider **without** copying Team Tournament engines.
5. Rating — inject `resolveRatings` at the CE composition root when a single rating SSOT is chosen.
6. Ranking — bind VPR snapshot reads behind this contract; never treat `rankingPosition` on a rating row as ranking authority.
7. Finance — bind `paymentStatusPort` only when finance runtime is enabled; keep UNKNOWN/NOT_CONFIGURED fail-closed.
8. Notification — add event types (court changed, referee assigned, result confirmed) as EVENT capabilities without lifecycle authority.
9. File/Media — create a durable reference service, then bind.
10. Streaming — projection-only feed; scoring stays CORE-16/17.
11. Federation — remain NOT_CONFIGURED until a real provider exists.
12. CRM/Sponsor — reference-only; never eligibility.
13. Analytics — outbound facts from Competition; reports stay derived.
14. Audit — inject Identity and/or CORE-20 sinks explicitly; do not drop required security events.

## Must not happen in adoption PRs

- mode-specific duplicate contract IDs
- Court/Referee renames
- silent copy of external master data into Competition
- turning NOT_CONFIGURED into empty-success
- SQL in a “just to look complete” adapter
