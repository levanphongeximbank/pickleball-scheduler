-- Phase 36 — Production backfill: Nam Long court cluster
-- Chạy SAU: PHASE_36_COURT_CLUSTER_CLOUD_SYNC.sql
-- Production: expuvcohlcjzvrrauvud
--
-- Bước 1: xác định venue ID thật
-- SELECT id, name FROM public.venues WHERE name ILIKE '%Nam Long%' OR id ILIKE '%nam%';

-- Bước 2: upsert cụm chính (điều chỉnh venue_id / id nếu khác trên môi trường của bạn)
INSERT INTO public.court_clusters (
  id,
  venue_id,
  name,
  slug,
  status,
  court_count,
  address,
  google_maps_url,
  owner_user_id,
  updated_at
)
VALUES (
  'venue-prod-main-main',
  'venue-prod-main',
  'Pickleball NAM LONG sports',
  'main',
  'active',
  0,
  '79 Đường D2, Phước Long, Hồ Chí Minh, Việt Nam',
  'https://www.google.com/maps/dir/?api=1&destination=79+%C4%90%C6%B0%E1%BB%9Dng+D2,+Ph%C6%B0%E1%BB%9Bc+Long,+H%E1%BB%93+Ch%C3%AD+Minh,+Vi%E1%BB%87t+Nam',
  null,
  now()
)
ON CONFLICT (id) DO UPDATE SET
  venue_id = EXCLUDED.venue_id,
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  status = 'active',
  address = EXCLUDED.address,
  google_maps_url = EXCLUDED.google_maps_url,
  owner_user_id = null,
  updated_at = now();

-- Dọn assignment legacy (nếu có)
DELETE FROM public.user_cluster_assignments
WHERE cluster_id IN ('default-tenant-main', 'venue-prod-main-main');

-- Sau backfill: Admin UI → Đồng bộ lên cloud / Gán chủ sân với user UUID từ dropdown
-- chusantest@gmail.com → 6e90bbf2-556c-4052-a5f6-effeec7cd1cc (production)
