-- btree_gist prerequisite VERIFY. READ ONLY.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='btree_gist') THEN
    RAISE EXCEPTION 'VERIFY_FAIL: btree_gist is not installed';
  END IF;
  RAISE NOTICE 'VERIFY_OK: btree_gist installed';
END
$$;
