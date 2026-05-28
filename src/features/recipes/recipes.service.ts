import { supabase } from '@/lib/supabase';
import type { Recipe, RecipeIngredient } from '@/types/database.types';

export interface RecipeWithIngredients extends Recipe {
  recipe_ingredients: RecipeIngredient[];
}

export type RecipeIngredientInput = Omit<RecipeIngredient, 'id' | 'recipe_id' | 'sort_order'>;

export interface RecipeInput {
  name: string;
  aliases: string[];
  description: string | null;
  history: string | null;
  method: Recipe['method'];
  glassware: string | null;
  garnish: string | null;
  tags: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const recipes = () => supabase.from('recipes') as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ingredients = () => supabase.from('recipe_ingredients') as any;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function nextAvailableSlug(userId: string, base: string): Promise<string> {
  if (!base) base = 'recipe';
  const { data, error } = await recipes()
    .select('slug')
    .eq('user_id', userId)
    .or(`slug.eq.${base},slug.like.${base}-%`);
  if (error) throw error;
  const taken = new Set<string>((data ?? []).map((r: { slug: string }) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export const recipeService = {
  async getAll(): Promise<Recipe[]> {
    const { data, error } = await recipes()
      .select('*')
      .order('name');
    if (error) throw error;
    return data as Recipe[];
  },

  async getAllWithIngredients(): Promise<RecipeWithIngredients[]> {
    const { data, error } = await recipes()
      .select('*, recipe_ingredients(*)')
      .order('name')
      .order('sort_order', { referencedTable: 'recipe_ingredients' });
    if (error) throw error;
    return data as RecipeWithIngredients[];
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

  async createRecipe(
    userId: string,
    input: RecipeInput,
    ings: RecipeIngredientInput[],
  ): Promise<Recipe> {
    const slug = await nextAvailableSlug(userId, slugify(input.name));
    const { data: inserted, error } = await recipes()
      .insert({
        user_id: userId,
        name: input.name,
        slug,
        aliases: input.aliases,
        description: input.description,
        history: input.history,
        method: input.method,
        glassware: input.glassware,
        garnish: input.garnish,
        tags: input.tags,
        source: 'user',
      })
      .select('*')
      .single();
    if (error) throw error;
    const recipe = inserted as Recipe;

    if (ings.length > 0) {
      const rows = ings.map((ing, i) => ({ ...ing, recipe_id: recipe.id, sort_order: i }));
      const { error: ingError } = await ingredients().insert(rows);
      if (ingError) throw ingError;
    }
    return recipe;
  },

  async updateRecipe(
    id: string,
    input: RecipeInput,
    ings: RecipeIngredientInput[],
  ): Promise<Recipe> {
    const { data: updated, error } = await recipes()
      .update({
        name: input.name,
        aliases: input.aliases,
        description: input.description,
        history: input.history,
        method: input.method,
        glassware: input.glassware,
        garnish: input.garnish,
        tags: input.tags,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    // Replace ingredients: delete-then-insert keeps things simple and matches seed flow.
    const { error: delError } = await ingredients().delete().eq('recipe_id', id);
    if (delError) throw delError;

    if (ings.length > 0) {
      const rows = ings.map((ing, i) => ({ ...ing, recipe_id: id, sort_order: i }));
      const { error: ingError } = await ingredients().insert(rows);
      if (ingError) throw ingError;
    }
    return updated as Recipe;
  },

  async deleteRecipe(id: string): Promise<void> {
    const { error } = await recipes().delete().eq('id', id);
    if (error) throw error;
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
