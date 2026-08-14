-- Official/Open canonical court reservation 01 BACKFILL.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO STAGING.
-- Additive Official tournament blob rows only. No Club blob deletion.
-- Idempotent: same proven row can be replayed without duplicate reservations.

BEGIN;

INSERT INTO public.court_reservations (
  tenant_id, club_id, court_id, source, owner_id, tournament_id,
  starts_at, ends_at, status, idempotency_key, origin
)
SELECT
  t.tenant_id,
  t.club_id,
  coalesce(b.booking->>'courtId', b.booking->>'court_id'),
  'official_tournament',
  t.id::text,
  t.id,
  ((b.booking->>'date') || ' ' || left(coalesce(b.booking->>'startTime', b.booking->>'start_time', ''), 5))::timestamp
    AT TIME ZONE 'Asia/Ho_Chi_Minh',
  ((b.booking->>'date') || ' ' || left(coalesce(b.booking->>'endTime', b.booking->>'end_time', ''), 5))::timestamp
    AT TIME ZONE 'Asia/Ho_Chi_Minh',
  'active',
  'backfill-official:' || t.id::text || ':' || coalesce(b.booking->>'courtId', b.booking->>'court_id'),
  'package_backfill'
FROM public.club_data_v3 d
JOIN public.canonical_tournaments t
  ON t.club_id = d.club_id AND t.mode = 'official_tournament'
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(d.data->'bookings') = 'array' THEN d.data->'bookings' ELSE '[]'::jsonb END
) AS b(booking)
WHERE coalesce(b.booking->>'bookingType', b.booking->>'booking_type', '') = 'tournament'
  AND coalesce(b.booking->>'tournamentId', b.booking->>'tournament_id', '') = t.id::text
  AND nullif(trim(coalesce(b.booking->>'courtId', b.booking->>'court_id', '')), '') IS NOT NULL
  AND nullif(trim(coalesce(b.booking->>'date', '')), '') IS NOT NULL
  AND nullif(trim(coalesce(b.booking->>'startTime', b.booking->>'start_time', '')), '') IS NOT NULL
  AND nullif(trim(coalesce(b.booking->>'endTime', b.booking->>'end_time', '')), '') IS NOT NULL
  AND left(coalesce(b.booking->>'startTime', b.booking->>'start_time', ''), 5)
    < left(coalesce(b.booking->>'endTime', b.booking->>'end_time', ''), 5)
  AND lower(coalesce(b.booking->>'status', b.booking->>'bookingStatus', 'confirmed'))
    NOT IN ('cancelled', 'completed', 'no_show')
  AND NOT EXISTS (
    SELECT 1 FROM public.court_reservations r
    WHERE r.tenant_id = t.tenant_id
      AND r.club_id = t.club_id
      AND r.idempotency_key = 'backfill-official:' || t.id::text || ':'
        || coalesce(b.booking->>'courtId', b.booking->>'court_id')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.court_reservations r
    WHERE r.tournament_id = t.id AND r.status = 'active'
      AND r.court_id = coalesce(b.booking->>'courtId', b.booking->>'court_id')
  );

COMMIT;
