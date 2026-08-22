-- btree_gist prerequisite PRECHECK. READ ONLY.
-- LOCAL PACKAGE ONLY. DO NOT APPLY WITHOUT OWNER GO.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name='btree_gist')
     AND NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='btree_gist') THEN
    RAISE EXCEPTION 'PRECHECK_FAIL: btree_gist is not available on this database';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='btree_gist') THEN
    RAISE NOTICE 'PRECHECK_OK: btree_gist already installed';
  ELSE
    RAISE NOTICE 'PRECHECK_OK: btree_gist available and not yet installed';
  END IF;
END
$$;
