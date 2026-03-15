-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE spirit_category AS ENUM (
  'whisky', 'gin', 'vodka', 'rum', 'tequila', 'mezcal', 'brandy', 'cognac',
  'liqueur', 'amaro', 'vermouth', 'bitters', 'syrup', 'mixer', 'garnish',
  'wine', 'beer', 'other'
);

CREATE TYPE cocktail_method AS ENUM (
  'stir', 'shake', 'build', 'blend', 'muddle', 'layer', 'other'
);

CREATE TYPE suggestion_archetype AS ENUM (
  'safe', 'adventurous', 'cultural'
);

CREATE TYPE ingredient_role AS ENUM (
  'base', 'modifier', 'accent', 'sweetener', 'sour', 'bitters', 'garnish',
  'topper', 'rinse', 'other'
);

-- ============================================
-- PROFILES
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  location_lat DOUBLE PRECISION,
  location_lon DOUBLE PRECISION,
  location_name TEXT,
  claude_api_key_encrypted TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- BOTTLES (USER INVENTORY)
-- ============================================
CREATE TABLE bottles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  category spirit_category NOT NULL,
  subcategory TEXT,
  spirit_type TEXT,
  tags TEXT[] DEFAULT '{}',
  abv DECIMAL(5,2),
  proof DECIMAL(5,1),
  is_premium BOOLEAN DEFAULT FALSE,
  price_tier TEXT CHECK (price_tier IN ('budget', 'standard', 'premium', 'luxury')),
  active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- CANONICAL RECIPES
-- ============================================
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  history TEXT,
  method cocktail_method NOT NULL,
  glassware TEXT,
  garnish TEXT,
  tags TEXT[] DEFAULT '{}',
  iba_category TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  ingredient_category spirit_category NOT NULL,
  quantity DECIMAL(6,2),
  unit TEXT,
  role ingredient_role NOT NULL,
  optional BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  notes TEXT
);

-- ============================================
-- USER RECIPE PREFERENCES
-- ============================================
CREATE TABLE user_recipe_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  custom_ingredients JSONB,
  preferred_bottles JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, recipe_id)
);

-- ============================================
-- COCKTAIL LOG
-- ============================================
CREATE TABLE cocktail_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  recipe_name TEXT NOT NULL,
  rating SMALLINT CHECK (rating >= 1 AND rating <= 5),
  tasting_notes TEXT,
  social_context TEXT,
  bottles_used UUID[] DEFAULT '{}',
  suggestion_session_id UUID,
  logged_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SUGGESTION SESSIONS
-- ============================================
CREATE TABLE suggestion_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  context_signals JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES suggestion_sessions(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  recipe_name TEXT NOT NULL,
  archetype suggestion_archetype NOT NULL,
  reasoning TEXT NOT NULL,
  adapted_recipe JSONB,
  sort_order INT DEFAULT 0,
  selected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE suggestion_refinements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES suggestion_sessions(id) ON DELETE CASCADE,
  user_input TEXT NOT NULL,
  resulting_suggestions UUID[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_bottles_user_active ON bottles(user_id) WHERE active = TRUE;
CREATE INDEX idx_bottles_category ON bottles(user_id, category);
CREATE INDEX idx_bottles_tags ON bottles USING GIN(tags);

CREATE INDEX idx_recipes_slug ON recipes(slug);
CREATE INDEX idx_recipes_tags ON recipes USING GIN(tags);
CREATE INDEX idx_recipes_name_trgm ON recipes USING GIN(name gin_trgm_ops);

CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_category ON recipe_ingredients(ingredient_category);

CREATE INDEX idx_cocktail_logs_user_date ON cocktail_logs(user_id, logged_at DESC);
CREATE INDEX idx_cocktail_logs_recipe ON cocktail_logs(user_id, recipe_id);

CREATE INDEX idx_suggestions_session ON suggestions(session_id);
CREATE INDEX idx_suggestion_sessions_user ON suggestion_sessions(user_id, created_at DESC);

-- ============================================
-- ROW-LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bottles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recipe_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE cocktail_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_refinements ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_own ON profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY bottles_own ON bottles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY recipes_read ON recipes
  FOR SELECT USING (TRUE);

CREATE POLICY recipe_ingredients_read ON recipe_ingredients
  FOR SELECT USING (TRUE);

CREATE POLICY user_recipe_prefs_own ON user_recipe_preferences
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY cocktail_logs_own ON cocktail_logs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY suggestion_sessions_own ON suggestion_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY suggestions_own ON suggestions
  FOR ALL USING (
    session_id IN (SELECT id FROM suggestion_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY refinements_own ON suggestion_refinements
  FOR ALL USING (
    session_id IN (SELECT id FROM suggestion_sessions WHERE user_id = auth.uid())
  );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Get recipes the user CAN make with current inventory
CREATE OR REPLACE FUNCTION get_makeable_recipes(p_user_id UUID)
RETURNS TABLE(recipe_id UUID, recipe_name TEXT, missing_count INT, missing_ingredients TEXT[])
LANGUAGE sql STABLE
AS $$
  WITH user_categories AS (
    SELECT DISTINCT category FROM bottles WHERE user_id = p_user_id AND active = TRUE
  ),
  recipe_coverage AS (
    SELECT
      r.id AS recipe_id,
      r.name AS recipe_name,
      COUNT(*) FILTER (
        WHERE ri.ingredient_category NOT IN (SELECT category FROM user_categories)
        AND NOT ri.optional
      )::INT AS missing_count,
      ARRAY_AGG(ri.ingredient_name) FILTER (
        WHERE ri.ingredient_category NOT IN (SELECT category FROM user_categories)
        AND NOT ri.optional
      ) AS missing_ingredients
    FROM recipes r
    JOIN recipe_ingredients ri ON ri.recipe_id = r.id
    GROUP BY r.id, r.name
  )
  SELECT * FROM recipe_coverage
  ORDER BY missing_count ASC, recipe_name ASC;
$$;
