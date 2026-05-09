-- ============================================
-- STRICT MAKEABILITY CHECK
-- ============================================
-- The original get_makeable_recipes function (migration 001) decided whether
-- a user could make a recipe by checking that every required ingredient's
-- *category* was covered by at least one bottle the user owned.
--
-- That check is too coarse for three categories where identity matters:
--   - liqueur  (Drambuie ≠ Cointreau ≠ Bénédictine)
--   - amaro    (Campari ≠ Cynar ≠ Aperol)
--   - vermouth (Sweet ≠ Dry ≠ Bianco)
--
-- A user with any liqueur was told they could make a Rusty Nail (needs
-- Drambuie); a user with only Dry Vermouth was told they could make a
-- Manhattan (needs Sweet). False positives that misled both the Recipes
-- "Can Make" filter and the suggestion prompt's makeable-recipes context.
--
-- This migration replaces the function with a per-ingredient match policy:
--
-- ┌─────────────────────────────────────┬─────────────────────────────────┐
-- │ Category                            │ Match policy                    │
-- ├─────────────────────────────────────┼─────────────────────────────────┤
-- │ mixer, garnish, syrup, other        │ Always satisfied (assume        │
-- │                                     │ available from fridge / pantry: │
-- │                                     │ citrus juice, simple syrup,     │
-- │                                     │ herbs, soda water, egg white)   │
-- ├─────────────────────────────────────┼─────────────────────────────────┤
-- │ liqueur, amaro, vermouth            │ Name-level match — at least one │
-- │                                     │ user bottle's name OR           │
-- │                                     │ subcategory must contain the    │
-- │                                     │ ingredient name (case-insens.)  │
-- ├─────────────────────────────────────┼─────────────────────────────────┤
-- │ All other categories                │ Category match (current         │
-- │ (whisky, gin, vodka, rum,           │ behavior — within these         │
-- │  tequila, mezcal, brandy,           │ categories, substitution is     │
-- │  cognac, wine, beer, bitters)       │ generally acceptable)           │
-- └─────────────────────────────────────┴─────────────────────────────────┘
--
-- Worked examples (with this fix applied):
--
--   User has: Hendrick's Gin, Carpano Antica (subcat "Sweet Vermouth"),
--             Campari, Angostura
--     → Negroni (gin + Sweet Vermouth + Campari) → makeable ✓
--     → Manhattan (rye + Sweet Vermouth + Angostura) → not makeable
--       (no whisky)
--     → Martini (gin + Dry Vermouth) → not makeable
--       (Dry Vermouth ingredient not in any bottle name/subcategory)
--
--   User has: Famous Grouse, Cointreau (subcat "Triple Sec")
--     → Rusty Nail (Scotch + Drambuie) → not makeable
--       (Drambuie not in any bottle name/subcategory)
--     → Sidecar (cognac + Cointreau + lemon) → not makeable
--       (no cognac/brandy bottle)
-- ============================================

CREATE OR REPLACE FUNCTION get_makeable_recipes(p_user_id UUID)
RETURNS TABLE(recipe_id UUID, recipe_name TEXT, missing_count INT, missing_ingredients TEXT[])
LANGUAGE sql STABLE
AS $$
  WITH user_bottles AS (
    SELECT
      lower(name) AS name_lc,
      lower(coalesce(subcategory, '')) AS subcat_lc,
      category
    FROM bottles
    WHERE user_id = p_user_id AND active = TRUE
  ),
  user_categories AS (
    SELECT DISTINCT category FROM user_bottles
  ),
  ingredient_satisfied AS (
    SELECT
      ri.recipe_id,
      ri.ingredient_name,
      ri.optional,
      CASE
        -- Always-available "fridge/pantry" categories.
        WHEN ri.ingredient_category IN ('mixer', 'garnish', 'syrup', 'other')
          THEN TRUE
        -- Identity-sensitive categories: require name or subcategory match.
        WHEN ri.ingredient_category IN ('liqueur', 'amaro', 'vermouth') THEN
          EXISTS (
            SELECT 1 FROM user_bottles ub
            WHERE ub.name_lc LIKE '%' || lower(ri.ingredient_name) || '%'
               OR ub.subcat_lc LIKE '%' || lower(ri.ingredient_name) || '%'
          )
        -- All other categories: category match is acceptable.
        ELSE
          ri.ingredient_category IN (SELECT category FROM user_categories)
      END AS satisfied
    FROM recipe_ingredients ri
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
