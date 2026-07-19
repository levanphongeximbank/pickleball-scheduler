-- Rollback for docs/supabase-notification-phase13.sql
-- Staging only. Do not run against Production without explicit approval.

DROP FUNCTION IF EXISTS public.notification_delivery_enqueue(uuid, text, text);
DROP FUNCTION IF EXISTS public.notification_inbox_create(
  text, text, text, text, text, text, text, text, uuid, uuid, text, text, text, text, text, jsonb
);

DROP TABLE IF EXISTS public.notification_delivery_jobs CASCADE;
DROP TABLE IF EXISTS public.notification_inbox CASCADE;
