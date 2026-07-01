-- Rollback Sprint 9 mobile tables (staging only)
DROP TABLE IF EXISTS public.checkins CASCADE;
DROP TABLE IF EXISTS public.qr_tokens CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.push_subscriptions CASCADE;
