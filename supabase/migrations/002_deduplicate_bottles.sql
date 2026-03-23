-- ============================================
-- REMOVE DUPLICATE BOTTLES
-- Keep the oldest instance of each (user_id, name) pair
-- ============================================
DELETE FROM bottles
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, lower(name)) id
  FROM bottles
  ORDER BY user_id, lower(name), created_at ASC
);

-- ============================================
-- PREVENT FUTURE DUPLICATES
-- One active bottle per name per user (case-insensitive)
-- ============================================
CREATE UNIQUE INDEX idx_bottles_unique_name_per_user
  ON bottles (user_id, lower(name))
  WHERE active = TRUE;
