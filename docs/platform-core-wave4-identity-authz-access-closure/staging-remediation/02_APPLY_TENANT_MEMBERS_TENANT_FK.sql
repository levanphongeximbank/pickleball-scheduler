-- Wave 4 Staging remediation — 02_APPLY_TENANT_MEMBERS_TENANT_FK.sql
-- AUTHOR ONLY. DO NOT EXECUTE without Owner SQL_EXECUTION_GO for this file.
-- SQL_EXECUTION_GO = NO
-- SCHEMA_EXECUTION_GO = NO
--
-- Target: tenant_members.tenant_id FK → public.platform_tenants(id)
-- NOT venues(id)
-- Do not rewrite tenant_id values. Do not infer Tenant from Venue.

DO $$
DECLARE
  rec record;
  orphan_tenant int;
  unknown_shape int;
  dropped_name text := NULL;
  current_target text := NULL;
BEGIN
  IF to_regclass('public.tenant_members') IS NULL THEN
    RAISE EXCEPTION 'WAVE4_FK_ABORT: public.tenant_members missing';
  END IF;
  IF to_regclass('public.platform_tenants') IS NULL THEN
    RAISE EXCEPTION 'WAVE4_FK_ABORT: public.platform_tenants missing';
  END IF;

  SELECT count(*) INTO unknown_shape
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'tenant_members'
    AND (
      (c.column_name = 'tenant_id' AND c.udt_name <> 'text')
      OR (c.column_name = 'user_id' AND c.udt_name <> 'uuid')
      OR (c.column_name = 'id' AND c.udt_name <> 'uuid')
    );
  IF unknown_shape > 0 THEN
    RAISE EXCEPTION 'WAVE4_FK_ABORT: unknown tenant_members column shape';
  END IF;

  SELECT count(*) INTO orphan_tenant
  FROM public.tenant_members tm
  WHERE NOT EXISTS (
    SELECT 1 FROM public.platform_tenants pt WHERE pt.id = tm.tenant_id
  );
  IF orphan_tenant > 0 THEN
    RAISE EXCEPTION 'WAVE4_FK_ABORT: % tenant_members.tenant_id value(s) absent from platform_tenants; no rewrite permitted', orphan_tenant;
  END IF;

  FOR rec IN
    SELECT
      c.conname,
      conf.relname AS target_table,
      pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_class conf ON conf.oid = c.confrelid
    WHERE n.nspname = 'public'
      AND t.relname = 'tenant_members'
      AND c.contype = 'f'
      AND pg_get_constraintdef(c.oid) ILIKE '%FOREIGN KEY (tenant_id)%'
  LOOP
    current_target := rec.target_table;
    IF rec.target_table = 'platform_tenants' THEN
      RAISE NOTICE 'WAVE4_FK: already canonical (%) → platform_tenants', rec.conname;
    ELSIF rec.target_table = 'venues' THEN
      -- Introspected definition matches the known legacy Venue-as-Tenant FK.
      EXECUTE format('ALTER TABLE public.tenant_members DROP CONSTRAINT %I', rec.conname);
      dropped_name := rec.conname;
      RAISE NOTICE 'WAVE4_FK: dropped introspected venues FK %', rec.conname;
    ELSE
      RAISE EXCEPTION 'WAVE4_FK_ABORT: unexpected tenant_id FK % → % (%). Refusing blind drop.',
        rec.conname, rec.target_table, rec.def;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_class conf ON conf.oid = c.confrelid
    WHERE n.nspname = 'public'
      AND t.relname = 'tenant_members'
      AND c.contype = 'f'
      AND conf.relname = 'platform_tenants'
      AND pg_get_constraintdef(c.oid) ILIKE '%FOREIGN KEY (tenant_id)%'
  ) THEN
    ALTER TABLE public.tenant_members
      ADD CONSTRAINT tenant_members_tenant_id_platform_tenants_fkey
      FOREIGN KEY (tenant_id)
      REFERENCES public.platform_tenants(id)
      ON DELETE RESTRICT;
    RAISE NOTICE 'WAVE4_FK: added tenant_members_tenant_id_platform_tenants_fkey';
  END IF;

  -- Preserve required indexes if a previous environment dropped them.
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS tenant_members_active_uniq ON public.tenant_members (tenant_id, user_id) WHERE status = ''active''';
  EXECUTE 'CREATE INDEX IF NOT EXISTS tenant_members_tenant_idx ON public.tenant_members (tenant_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS tenant_members_user_idx ON public.tenant_members (user_id)';

  RAISE NOTICE 'WAVE4_FK_COMPLETE dropped=% previous_target=%', dropped_name, current_target;
END $$;
