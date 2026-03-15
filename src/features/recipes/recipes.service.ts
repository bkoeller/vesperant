import { supabase } from '@/lib/supabase';
import type { Recipe, RecipeIngredient } from '@/types/database.types';

export interface RecipeWithIngredients extends Recipe {
  recipe_ingredients: RecipeIngredient[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const recipes = () => supabase.from('recipes') as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ingredients = () => supabase.from('recipe_ingredients') as any;

export const recipeService = {
  async getAll(): Promise<Recipe[]> {
    const { data, error } = await recipes()
      .select('*')
      .order('name');
    if (error) throw error;
    return data as Recipe[];
  },

  async getBySlug(slug: string): Promise<RecipeWithIngredients> {
    const { data, error } = await recipes()
      .select('*, recipe_ingredients(*)')
      .eq('slug', slug)
      .order('sort_order', { referencedTable: 'recipe_ingredients' })
      .single();
    if (error) throw error;
    return data as RecipeWithIngredients;
  },

  async search(query: string): Promise<Recipe[]> {
    const { data, error } = await recipes()
      .select('*')
      .or(`name.ilike.%${query}%,aliases.cs.{${query}}`)
      .order('name')
      .limit(50);
    if (error) throw error;
    return data as Recipe[];
  },

  async getByTags(tags: string[]): Promise<Recipe[]> {
    const { data, error } = await recipes()
      .select('*')
      .overlaps('tags', tags)
      .order('name');
    if (error) throw error;
    return data as Recipe[];
  },

  async getMakeableRecipes(userId: string): Promise<{ recipe_id: string; recipe_name: string; missing_count: number; missing_ingredients: string[] | null }[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_makeable_recipes', { p_user_id: userId });
    if (error) throw error;
    return data as { recipe_id: string; recipe_name: string; missing_count: number; missing_ingredients: string[] | null }[];
  },

  async seedRecipes(recipesData: { recipe: Record<string, unknown>; ingredients: Record<string, unknown>[] }[]): Promise<void> {
    for (const { recipe, ingredients: ings } of recipesData) {
      const { data: inserted, error: recipeError } = await recipes()
        .upsert(recipe, { onConflict: 'slug' })
        .select('id')
        .single();
      if (recipeError) throw recipeError;

      if (ings.length > 0) {
        // Delete existing ingredients for this recipe before re-inserting
        await ingredients().delete().eq('recipe_id', (inserted as { id: string }).id);

        const rows = ings.map((ing, i) => ({
          ...ing,
          recipe_id: (inserted as { id: string }).id,
          sort_order: i,
        }));
        const { error: ingError } = await ingredients().insert(rows);
        if (ingError) throw ingError;
      }
    }
  },
};
