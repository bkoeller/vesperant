import { useState, useEffect } from 'react';
import type { Bottle } from '@/types/database.types';
import { callClaudeStreaming, type SuggestionResult } from '@/lib/claude';
import { buildSuggestionSystemPrompt } from '@/lib/prompts';
import { getLocationWeather, type WeatherContext } from '@/lib/weather';
import { getEventsNearDate, getSeason, getTimeOfDay } from '@/lib/holidays';
import { useBottles } from '@/features/inventory/hooks/useBottles';
import { suggestionService } from '../suggestion.service';
import { extractCompleteSuggestionObjects } from './partial-suggestions';

/**
 * Stream a Claude suggestion response, parsing each complete suggestion
 * object as it lands and pushing it through `onPartial` so the UI can render
 * cards progressively. Returns the final array (also passed via onPartial).
 */
async function streamSuggestions(
  systemPrompt: string,
  userPrompt: string,
  onPartial: (suggestions: SuggestionResult[]) => void,
): Promise<SuggestionResult[]> {
  let lastCount = 0;
  let latest: SuggestionResult[] = [];

  await callClaudeStreaming(systemPrompt, userPrompt, (accumulated) => {
    const raw = extractCompleteSuggestionObjects(accumulated);
    if (raw.length > lastCount) {
      lastCount = raw.length;
      latest = raw.map(normalizeSuggestion);
      onPartial(latest);
    }
  });

  // If the final pass found more (rare — usually streaming caught everything),
  // emit one more update.
  return latest;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeIngredient(ing: any): { ingredient_name: string; bottle_from_inventory: string | null; quantity: string; unit: string; notes: string | null } {
  return {
    ingredient_name: ing.ingredient_name ?? ing.item ?? ing.name ?? '',
    bottle_from_inventory: ing.bottle_from_inventory ?? (ing.inventory ? (ing.item ?? null) : null),
    quantity: String(ing.quantity ?? ing.amount ?? ''),
    unit: ing.unit ?? '',
    notes: ing.notes ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeSuggestion(s: any): SuggestionResult {
  const recipe = s.adapted_recipe ?? s.recipe ?? {};
  const rawIngredients = recipe.ingredients ?? [];
  return {
    archetype: s.archetype ?? 'safe',
    recipe_name: s.recipe_name ?? s.name ?? 'Unknown',
    recipe_slug: s.recipe_slug ?? s.slug ?? null,
    reasoning: s.reasoning ?? s.cultural_connection ?? s.description ?? s.spirit_notes ?? '',
    missing_ingredients: s.missing_ingredients ?? [],
    adapted_recipe: {
      ingredients: rawIngredients.map(normalizeIngredient),
      method: recipe.method ?? '',
      glassware: recipe.glassware ?? recipe.glass ?? '',
      garnish: recipe.garnish ?? '',
      proof_warning: null, value_notes: null, variation_notes: null,
    },
  };
}

export interface ContextSignals {
  date: string;
  day_of_week: string;
  time_of_day: string;
  season: string;
  weather: WeatherContext | null;
  holidays_near: string[];
  mood: string | null;
  occasion: string | null;
  guests: string | null;
}

function gatherContextSignals(
  weather: WeatherContext | null,
  mood: string | null,
  occasion: string | null,
  guests: string | null,
): ContextSignals {
  const now = new Date();
  const events = getEventsNearDate(now);
  return {
    date: now.toISOString().split('T')[0],
    day_of_week: now.toLocaleDateString('en-US', { weekday: 'long' }),
    time_of_day: getTimeOfDay(now),
    season: getSeason(now),
    weather,
    holidays_near: events.map(e => `${e.name}${e.cocktail_relevance ? ` (${e.cocktail_relevance})` : ''}`),
    mood,
    occasion,
    guests,
  };
}

// Exported for unit testing. The shape of the inventory and the makeability
// rules in this prompt are load-bearing for the bug fixed in migration 005:
// Claude must see specific identities (subcategory, spirit_type) and be told
// not to substitute identity-sensitive bottles, or it will recommend things
// the user can't actually make.
export function buildSuggestionUserPrompt(
  context: ContextSignals,
  bottles: Bottle[],
  recentHistory?: string[],
  refinement?: string,
  previousSuggestions?: SuggestionResult[],
): string {
  const inventoryByCategory: Record<string, {
    name: string;
    subcategory: string | null;
    spirit_type: string | null;
    abv: number | null;
    price_tier: string | null;
    tags: string[];
  }[]> = {};
  for (const b of bottles) {
    if (!inventoryByCategory[b.category]) inventoryByCategory[b.category] = [];
    inventoryByCategory[b.category].push({
      name: b.name,
      subcategory: b.subcategory,
      spirit_type: b.spirit_type,
      abv: b.abv,
      price_tier: b.price_tier,
      tags: b.tags,
    });
  }

  let prompt = `## User's Bar Inventory
${JSON.stringify(inventoryByCategory, null, 2)}

## Today's Context
${JSON.stringify(context, null, 2)}
`;

  if (recentHistory && recentHistory.length > 0) {
    prompt += `
## Recent History (DO NOT suggest these — the user has seen or made them recently)
${recentHistory.map(name => `- ${name}`).join('\n')}
`;
  }

  const schemaBlock = `
{
  "suggestions": [
    {
      "archetype": "safe" | "adventurous" | "cultural",
      "recipe_name": "string",
      "recipe_slug": "string or null",
      "reasoning": "string (2-3 sentences explaining why this cocktail for this moment)",
      "adapted_recipe": {
        "ingredients": [{"ingredient_name": "string", "bottle_from_inventory": "string|null", "quantity": "string", "unit": "string", "notes": "string|null"}],
        "method": "string",
        "glassware": "string",
        "garnish": "string",
        "proof_warning": "string|null",
        "value_notes": "string|null",
        "variation_notes": "string|null"
      },
      "missing_ingredients": ["string"]
    }
  ]
}`;

  if (previousSuggestions && refinement) {
    prompt += `
## Previous Suggestions
${JSON.stringify(previousSuggestions.map(s => ({ name: s.recipe_name, archetype: s.archetype })), null, 2)}

## User's Refinement
"${refinement}"

## Task
Suggest 3 NEW cocktails respecting the refinement. Keep the same 3 archetypes (safe, adventurous, cultural).
You MUST respond with ONLY valid JSON matching this EXACT schema:
${schemaBlock}
`;
  } else {
    prompt += `
## Task
Suggest exactly 3 cocktails. You MUST respond with ONLY valid JSON matching this EXACT schema:
${schemaBlock}

Rules:
- "safe": a reliable crowd-pleaser suited to the context, something the user will enjoy
- "adventurous": something the user has likely never tried, push boundaries
- "cultural": tied to today's date, a nearby holiday, historical event, or cultural moment. Cite the connection.
- All suggestions must be makeable with the user's inventory (0-1 missing ingredients max)
- Respect bottle value: use budget/standard bottles in mixed drinks, save premium for spirit-forward
- Adapt each recipe to specific bottles from the inventory

CRITICAL — DO NOT SUBSTITUTE these identity-sensitive ingredients across categories:
- Liqueurs are not interchangeable. Drambuie, Cointreau, Bénédictine, Chartreuse, Maraschino, Campari, Aperol, Cynar, etc. each have a unique character. Only suggest a recipe whose specific liqueur you can identify in the inventory by name or subcategory.
- Sweet vermouth and dry vermouth are NOT interchangeable. Check each bottle's subcategory.
- "Mixer" / "garnish" / "syrup" / "other" categories represent fridge/pantry items (citrus juice, simple syrup, mint, soda, egg white) — assume the user has these unless the recipe calls for something exotic. Inventory only lists bottles, not produce.
- For other spirits (whisky, gin, vodka, rum, tequila, mezcal, brandy/cognac), within-category substitution is acceptable but note it (e.g., "Scotch instead of bourbon — different drink, more like a Rob Roy").
`;
  }

  return prompt;
}

export function useSuggestions(userId?: string) {
  const { data: bottles } = useBottles();
  const [suggestions, setSuggestions] = useState<SuggestionResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<ContextSignals | null>(null);
  const [weather, setWeather] = useState<WeatherContext | null>(null);
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Fetch weather on mount
  useEffect(() => {
    getLocationWeather().then(w => setWeather(w));
  }, []);

  const suggest = async (
    mood: string | null = null,
    occasion: string | null = null,
    guests: string | null = null,
  ) => {
    if (!bottles || bottles.length === 0) {
      setError('Add some bottles to your inventory first.');
      return;
    }

    setLoading(true);
    setError(null);
    setResponseTimeMs(null);

    try {
      const ctx = gatherContextSignals(weather, mood, occasion, guests);
      setContext(ctx);

      // Fetch recent history to avoid repeats
      let recentHistory: string[] = [];
      if (userId) {
        try {
          recentHistory = await suggestionService.getRecentRecipeNames(userId);
        } catch {
          // Non-critical — proceed without history if fetch fails
        }
      }

      const systemPrompt = buildSuggestionSystemPrompt();
      const userPrompt = buildSuggestionUserPrompt(ctx, bottles, recentHistory);

      const start = performance.now();
      let firstCardAt: number | null = null;
      const parsed = await streamSuggestions(systemPrompt, userPrompt, (partial) => {
        if (firstCardAt === null && partial.length > 0) {
          firstCardAt = performance.now() - start;
          setResponseTimeMs(Math.round(firstCardAt));
        }
        setSuggestions(partial);
      });
      // Final timing reflects total wall time once streaming closes.
      setResponseTimeMs(Math.round(performance.now() - start));

      // Persist session + suggestions to DB
      if (userId) {
        try {
          const sid = await suggestionService.saveSession(userId, ctx, parsed);
          setSessionId(sid);
        } catch {
          // Non-critical — suggestions still display even if save fails
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const refine = async (refinement: string) => {
    if (!bottles || !context || !suggestions) return;

    setLoading(true);
    setError(null);
    setResponseTimeMs(null);

    try {
      // Include recent history in refinements too
      let recentHistory: string[] = [];
      if (userId) {
        try {
          recentHistory = await suggestionService.getRecentRecipeNames(userId);
        } catch {
          // Non-critical
        }
      }

      const systemPrompt = buildSuggestionSystemPrompt();
      const userPrompt = buildSuggestionUserPrompt(context, bottles, recentHistory, refinement, suggestions);

      const start = performance.now();
      let firstCardAt: number | null = null;
      const parsed = await streamSuggestions(systemPrompt, userPrompt, (partial) => {
        if (firstCardAt === null && partial.length > 0) {
          firstCardAt = performance.now() - start;
          setResponseTimeMs(Math.round(firstCardAt));
        }
        setSuggestions(partial);
      });
      setResponseTimeMs(Math.round(performance.now() - start));

      // Save refinement results
      if (userId) {
        try {
          const sid = await suggestionService.saveSession(userId, context, parsed);
          setSessionId(sid);
        } catch {
          // Non-critical
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSuggestions(null);
    setError(null);
    setContext(null);
    setResponseTimeMs(null);
    setSessionId(null);
  };

  return { suggestions, context, loading, error, suggest, refine, reset, weather, responseTimeMs, sessionId };
}
