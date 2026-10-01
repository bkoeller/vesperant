-- ============================================
-- WORD-BASED MATCHING FOR IDENTITY-SENSITIVE INGREDIENTS
-- ============================================
-- 005 matched liqueur / amaro / vermouth ingredients by substring: a bottle
-- satisfied "Cherry Heering" only if its name or subcategory contained that
-- exact text. Accents and word order defeated it, so owned bottles read as
-- missing:
--
--   Bénédictine       vs  "DOM Benedictine"          (accent)
--   Cherry Heering    vs  "Heering Cherry Liqueur"   (word order)
--   Green Chartreuse  vs  "Chartreuse Green"         (word order)
--   Blue Curaçao      vs  "Mr. Stacks Blue Curacao"  (accent)
--   Banana Liqueur    vs  "Crème de Banane", spirit_type "Banana Liqueur"
--
-- New rule: every word of the ingredient name (accents folded, punctuation
-- dropped, filler words like "de"/"the" ignored) must appear among the words
-- of the bottle's name + subcategory + spirit_type. Identity is still
-- enforced: "Sweet Vermouth" needs a bottle that says "sweet", so a dry
-- vermouth never satisfies it, and Drambuie never satisfies Cointreau.
--
-- Checked against a real 150-bottle / 271-recipe dataset before shipping:
-- 7 ingredients newly matched (all correct), none lost.
-- ============================================

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- Lowercased, accent-folded, de-duplicated words of a string, minus filler
-- words. "Crème de Violette" -> {creme, violette}.
CREATE OR REPLACE FUNCTION public.match_words(p_text TEXT)
RETURNS TEXT[]
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(array_agg(DISTINCT w), '{}')
  FROM regexp_split_to_table(lower(extensions.unaccent(COALESCE(p_text, ''))), '[^a-z0-9]+') AS w
  WHERE w <> ''
    AND w NOT IN ('a', 'and', 'de', 'del', 'di', 'du', 'la', 'le', 'of', 'the');
$$;

CREATE OR REPLACE FUNCTION get_makeable_recipes(p_user_id UUID)
RETURNS TABLE(recipe_id UUID, recipe_name TEXT, missing_count INT, missing_ingredients TEXT[])
LANGUAGE sql STABLE
AS $$
  WITH user_bottles AS (
    SELECT
      public.match_words(concat_ws(' ', name, subcategory, spirit_type)) AS words,
      category
    FROM bottles
    WHERE user_id = p_user_id AND active = TRUE
  ),
  user_categories AS (
    SELECT DISTINCT category FROM user_bottles
  ),
  ingredient_words AS (
    SELECT ri.*, public.match_words(ri.ingredient_name) AS words
    FROM recipe_ingredients ri
  ),
  ingredient_satisfied AS (
    SELECT
      iw.recipe_id,
      iw.ingredient_name,
      iw.optional,
      CASE
        -- Always-available "fridge/pantry" categories.
        WHEN iw.ingredient_category IN ('mixer', 'garnish', 'syrup', 'other')
          THEN TRUE
        -- Identity-sensitive categories: every ingredient word must appear
        -- in some bottle's name/subcategory/spirit_type words.
        WHEN iw.ingredient_category IN ('liqueur', 'amaro', 'vermouth') THEN
          cardinality(iw.words) > 0 AND EXISTS (
            SELECT 1 FROM user_bottles ub WHERE iw.words <@ ub.words
          )
        -- All other categories: category match is acceptable.
        ELSE
          iw.ingredient_category IN (SELECT category FROM user_categories)
      END AS satisfied
    FROM ingredient_words iw
  )
  SELECT
    r.id AS recipe_id,
    r.name AS recipe_name,
    COUNT(*) FILTER (WHERE NOT s.satisfied AND NOT s.optional)::INT AS missing_count,
    ARRAY_AGG(s.ingredient_name) FILTER (WHERE NOT s.satisfied AND NOT s.optional) AS missing_ingredients
  FROM recipes r
  JOIN ingredient_satisfied s ON s.recipe_id = r.id
  GROUP BY r.id, r.name
  ORDER BY missing_count ASC, recipe_name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.match_words(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_makeable_recipes(UUID) TO authenticated, service_role;
