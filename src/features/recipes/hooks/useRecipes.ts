import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recipeService } from '../recipes.service';
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
