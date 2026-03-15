import { useState } from 'react';
import type { RecipeIngredient, Bottle } from '@/types/database.types';
import { callClaude, type AdaptedRecipe } from '@/lib/claude';
import { buildAdaptRecipeSystemPrompt, buildAdaptRecipeUserPrompt } from '@/lib/prompts';

export function useAdaptRecipe() {
  const [adapted, setAdapted] = useState<AdaptedRecipe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adapt = async (
    recipeName: string,
    ingredients: RecipeIngredient[],
    method: string,
    glassware: string,
    garnish: string,
    bottles: Bottle[],
  ) => {
    setLoading(true);
    setError(null);
    setAdapted(null);

    try {
      const systemPrompt = buildAdaptRecipeSystemPrompt();
      const userPrompt = buildAdaptRecipeUserPrompt(
        recipeName, ingredients, method, glassware, garnish, bottles,
      );

      const raw = await callClaude(systemPrompt, userPrompt);

      // Parse JSON from response — handle possible markdown fences
      let jsonStr = raw.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonStr) as AdaptedRecipe;
      setAdapted(parsed);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setAdapted(null);
    setError(null);
  };

  return { adapted, loading, error, adapt, reset };
}
