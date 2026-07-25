-- =============================================================================
-- NEWS-03 — Permission seed verification (READ-ONLY)
-- Purpose: Deterministic checks after NEWS-03 seed apply.
-- Status: AUTHORED — run via harness verify / apply tail. No writes.
-- =============================================================================

SET search_path = public, pg_temp;

-- A. Exact six permission rows (deterministic order)
SELECT
  p.id,
  p.module,
  p.action,
  p.description,
  (p.description IS NOT NULL AND length(trim(p.description)) > 0) AS description_present
FROM public.permissions p
WHERE p.id IN (
  'news.view',
  'news.edit',
  'news.review',
  'news.approve',
  'news.publish',
  'news.admin'
)
ORDER BY p.id;

-- B. Count / completeness / duplicate probe
SELECT
  COUNT(*)::integer AS news_permission_row_count,
  COUNT(DISTINCT p.id)::integer AS news_permission_distinct_ids,
  COUNT(*) FILTER (
    WHERE p.module IS NULL OR length(trim(p.module)) = 0
       OR p.action IS NULL OR length(trim(p.action)) = 0
       OR p.description IS NULL OR length(trim(p.description)) = 0
  )::integer AS metadata_null_or_blank_count
FROM public.permissions p
WHERE p.id IN (
  'news.view',
  'news.edit',
  'news.review',
  'news.approve',
  'news.publish',
  'news.admin'
);

-- C. Missing expected keys (expect 0 rows)
SELECT e.expected_id
FROM (
  VALUES
    ('news.view'),
    ('news.edit'),
    ('news.review'),
    ('news.approve'),
    ('news.publish'),
    ('news.admin')
) AS e(expected_id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.id = e.expected_id
)
ORDER BY e.expected_id;

-- D. Unexpected news.* catalog rows beyond exact package (informational; expect 0 for clean seed)
SELECT p.id
FROM public.permissions p
WHERE p.module = 'news'
  AND p.id NOT IN (
    'news.view',
    'news.edit',
    'news.review',
    'news.approve',
    'news.publish',
    'news.admin'
  )
ORDER BY p.id;

-- E. Wildcard / broad action probe on news module (expect 0)
SELECT p.id, p.action
FROM public.permissions p
WHERE p.module = 'news'
  AND (
    p.id IN ('news.*', 'news.all', '*', '*.*')
    OR p.action IN ('*', 'all', 'any')
    OR p.id LIKE '%*%'
  )
ORDER BY p.id;

-- F. Permanent role mapping probe for the six keys (expect 0 for NEWS-03 package;
--    temporary fixtures after live tests must be cleaned before this is green)
SELECT rp.role_id, rp.permission_id
FROM public.role_permissions rp
WHERE rp.permission_id IN (
  'news.view',
  'news.edit',
  'news.review',
  'news.approve',
  'news.publish',
  'news.admin'
)
ORDER BY rp.role_id, rp.permission_id;

-- G. Verdict row (deterministic single row)
SELECT
  CASE
    WHEN (
      SELECT COUNT(*)::integer FROM public.permissions p
      WHERE p.id IN (
        'news.view','news.edit','news.review','news.approve','news.publish','news.admin'
      )
    ) = 6
    AND (
      SELECT COUNT(DISTINCT p.id)::integer FROM public.permissions p
      WHERE p.id IN (
        'news.view','news.edit','news.review','news.approve','news.publish','news.admin'
      )
    ) = 6
    AND NOT EXISTS (
      SELECT 1 FROM (
        VALUES
          ('news.view'),('news.edit'),('news.review'),
          ('news.approve'),('news.publish'),('news.admin')
      ) AS e(expected_id)
      WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.id = e.expected_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.permissions p
      WHERE p.module = 'news'
        AND (
          p.id IN ('news.*', 'news.all', '*', '*.*')
          OR p.action IN ('*', 'all', 'any')
          OR p.id LIKE '%*%'
        )
    )
    AND (
      SELECT COUNT(*)::integer FROM public.permissions p
      WHERE p.id IN (
        'news.view','news.edit','news.review','news.approve','news.publish','news.admin'
      )
        AND (
          p.module IS NULL OR length(trim(p.module)) = 0
          OR p.action IS NULL OR length(trim(p.action)) = 0
          OR p.description IS NULL OR length(trim(p.description)) = 0
        )
    ) = 0
    THEN 'NEWS_03_PERMISSION_SEED_VERIFIED'
    ELSE 'NEWS_03_PERMISSION_SEED_VERIFICATION_FAILED'
  END AS news_03_permission_seed_verdict;
