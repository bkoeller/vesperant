-- ============================================
-- USER-CREATED RECIPES
-- Add ownership column; canonical recipes have user_id = NULL.
-- ============================================
ALTER TABLE recipes
  ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX idx_recipes_user ON recipes(user_id);

-- ============================================
-- SLUG UNIQUENESS
-- Canonical slugs stay globally unique; user slugs unique per user.
-- ============================================
ALTER TABLE recipes DROP CONSTRAINT recipes_slug_key;

CREATE UNIQUE INDEX idx_recipes_slug_canonical
  ON recipes(slug)
  WHERE user_id IS NULL;

CREATE UNIQUE INDEX idx_recipes_slug_per_user
  ON recipes(user_id, slug)
  WHERE user_id IS NOT NULL;

-- ============================================
-- RLS — recipes
-- Read canonical (user_id IS NULL) or own; write only own.
-- ============================================
DROP POLICY recipes_read ON recipes;

CREATE POLICY recipes_read ON recipes
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY recipes_insert_own ON recipes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY recipes_update_own ON recipes
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY recipes_delete_own ON recipes
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- RLS — recipe_ingredients
-- Inherit ownership from parent recipe.
-- ============================================
DROP POLICY recipe_ingredients_read ON recipe_ingredients;

CREATE POLICY recipe_ingredients_read ON recipe_ingredients
  FOR SELECT USING (
    recipe_id IN (
      SELECT id FROM recipes WHERE user_id IS NULL OR user_id = auth.uid()
    )
  );

CREATE POLICY recipe_ingredients_insert_own ON recipe_ingredients
  FOR INSERT WITH CHECK (
    recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid())
  );

CREATE POLICY recipe_ingredients_update_own ON recipe_ingredients
  FOR UPDATE USING (
    recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid())
  ) WITH CHECK (
    recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid())
  );

CREATE POLICY recipe_ingredients_delete_own ON recipe_ingredients
  FOR DELETE USING (
    recipe_id IN (SELECT id FROM recipes WHERE user_id = auth.uid())
  );
