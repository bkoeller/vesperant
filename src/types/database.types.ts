// Auto-generated types will replace this file via `supabase gen types typescript`
// For now, define the types manually to match our schema

export type SpiritCategory =
  | 'whisky' | 'gin' | 'vodka' | 'rum' | 'tequila' | 'mezcal'
  | 'brandy' | 'cognac' | 'liqueur' | 'amaro' | 'vermouth'
  | 'bitters' | 'syrup' | 'mixer' | 'garnish' | 'wine' | 'beer' | 'other';

export type CocktailMethod = 'stir' | 'shake' | 'build' | 'blend' | 'muddle' | 'layer' | 'other';

export type SuggestionArchetype = 'safe' | 'adventurous' | 'cultural';

export type IngredientRole =
  | 'base' | 'modifier' | 'accent' | 'sweetener' | 'sour'
  | 'bitters' | 'garnish' | 'topper' | 'rinse' | 'other';

export type PriceTier = 'budget' | 'standard' | 'premium' | 'luxury';

export interface Profile {
  id: string;
  display_name: string | null;
  location_lat: number | null;
  location_lon: number | null;
  location_name: string | null;
  claude_api_key_encrypted: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Bottle {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  category: SpiritCategory;
  subcategory: string | null;
  spirit_type: string | null;
  tags: string[];
  abv: number | null;
  proof: number | null;
  is_premium: boolean;
  price_tier: PriceTier | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Recipe {
  id: string;
  name: string;
  aliases: string[];
  slug: string;
  description: string | null;
  history: string | null;
  method: CocktailMethod;
  glassware: string | null;
  garnish: string | null;
  tags: string[];
  iba_category: string | null;
  source: string | null;
  created_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_name: string;
  ingredient_category: SpiritCategory;
  quantity: number | null;
  unit: string | null;
  role: IngredientRole;
  optional: boolean;
  sort_order: number;
  notes: string | null;
}

export interface UserRecipePreference {
  id: string;
  user_id: string;
  recipe_id: string;
  custom_ingredients: Record<string, unknown> | null;
  preferred_bottles: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CocktailLog {
  id: string;
  user_id: string;
  recipe_id: string | null;
  recipe_name: string;
  rating: number | null;
  tasting_notes: string | null;
  social_context: string | null;
  bottles_used: string[];
  suggestion_session_id: string | null;
  logged_at: string;
  created_at: string;
}

export interface SuggestionSession {
  id: string;
  user_id: string;
  context_signals: Record<string, unknown>;
  created_at: string;
}

export interface Suggestion {
  id: string;
  session_id: string;
  recipe_id: string | null;
  recipe_name: string;
  archetype: SuggestionArchetype;
  reasoning: string;
  adapted_recipe: Record<string, unknown> | null;
  sort_order: number;
  selected: boolean;
  created_at: string;
}

// Simplified Database type — uses Record<string, unknown> for Insert/Update
// to avoid fighting with Supabase's generic constraints.
// The actual type safety comes from our service layer functions.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Database {
  public: {
    Tables: {
      [key: string]: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
    };
  };
}
