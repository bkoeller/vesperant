import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recipeService, type RecipeInput, type RecipeIngredientInput } from '../recipes.service';
import { useAuth } from '@/features/auth/hooks/useAuth';

const RECIPES_KEY = ['recipes'] as const;
const MAKEABLE_KEY = ['recipes', 'makeable'] as const;

export function useRecipes() {
  return useQuery({
    queryKey: RECIPES_KEY,
    queryFn: recipeService.getAll,
  });
}

/**
 * Returns a function that resolves a free-form recipe name (e.g. from a
 * suggestion or a cocktail log entry) to a library slug, or null if the
 * recipe isn't in the library. Matches by name OR alias, case-insensitive
 * and trim-tolerant. Backed by the same cached `useRecipes` query, so this
 * costs one fetch shared across the app.
 */
export function useRecipeSlugLookup(): (name: string | null | undefined) => string | null {
  const { data: recipes } = useRecipes();
  const index = useMemo(() => {
    const map = new Map<string, string>();
    if (!recipes) return map;
    for (const r of recipes) {
      map.set(r.name.trim().toLowerCase(), r.slug);
      for (const alias of r.aliases ?? []) {
        const key = alias.trim().toLowerCase();
        if (key && !map.has(key)) map.set(key, r.slug);
      }
    }
    return map;
  }, [recipes]);
  return (name) => {
    if (!name) return null;
    return index.get(name.trim().toLowerCase()) ?? null;
  };
}

export function useRecipeBySlug(slug: string) {
  return useQuery({
    queryKey: [...RECIPES_KEY, slug],
    queryFn: () => recipeService.getBySlug(slug),
    enabled: !!slug,
  });
}

export function useMakeableRecipes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: MAKEABLE_KEY,
    queryFn: () => recipeService.getMakeableRecipes(user!.id),
    enabled: !!user,
  });
}

export function useSeedRecipes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recipeService.seedRecipes,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECIPES_KEY });
      queryClient.invalidateQueries({ queryKey: MAKEABLE_KEY });
    },
  });
}

function invalidateRecipes(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: RECIPES_KEY });
  queryClient.invalidateQueries({ queryKey: MAKEABLE_KEY });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ input, ingredients }: { input: RecipeInput; ingredients: RecipeIngredientInput[] }) => {
      if (!user) throw new Error('Not signed in');
      return recipeService.createRecipe(user.id, input, ingredients);
    },
    onSuccess: () => invalidateRecipes(queryClient),
  });
}

export function useUpdateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input, ingredients }: { id: string; input: RecipeInput; ingredients: RecipeIngredientInput[] }) =>
      recipeService.updateRecipe(id, input, ingredients),
    onSuccess: () => invalidateRecipes(queryClient),
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recipeService.deleteRecipe(id),
    onSuccess: () => invalidateRecipes(queryClient),
  });
}
