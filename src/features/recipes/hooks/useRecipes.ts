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
