-- DO NOT APPLY THIS FILENAME.
-- Schema apply is 02_APPLY_SCHEMA.sql. Business backfill is 05_BACKFILL.sql.
-- btree_gist is a separate prerequisite package.

DO $$
BEGIN
  RAISE EXCEPTION 'DO_NOT_APPLY: use 02_APPLY_SCHEMA.sql then 05_BACKFILL.sql after Owner GO';
END
$$;
