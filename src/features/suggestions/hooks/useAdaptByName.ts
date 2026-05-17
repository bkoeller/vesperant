import { useState } from 'react';
import { callClaude, type AdaptedRecipe } from '@/lib/claude';
import { buildAdaptByNameSystemPrompt, buildAdaptByNameUserPrompt } from '@/lib/prompts';
import type { Bottle } from '@/types/database.types';

/**
 * Phase 2 of the Tonight suggestion flow: lazily fetch the adapted recipe
 * for a specific suggested cocktail. Phase 1 returns only name + reasoning
 * + missing-ingredient list; this hook fills in the full ingredient list,
 * method, glassware, and garnish when the user expands a card.
 */
export function useAdaptByName() {
  const [adapted, setAdapted] = useState<AdaptedRecipe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (recipeName: string, bottles: Bottle[]) => {
    setLoading(true);
    setError(null);
    try {
      const raw = await callClaude(
        buildAdaptByNameSystemPrompt(),
        buildAdaptByNameUserPrompt(recipeName, bottles),
      );
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

  return { adapted, loading, error, load };
}
