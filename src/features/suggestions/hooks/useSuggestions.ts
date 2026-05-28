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
 *
 * Drops any suggestion whose recipe_name matches an entry in recentHistory
 * (case-insensitive, trimmed) or whose reasoning opens with a self-correction
 * phrase. Both signals indicate Claude got confused mid-generation and the
 * card's name/reasoning will disagree.
 */
export interface StreamResult {
  suggestions: SuggestionResult[];
  filteredCount: number;
}

async function streamSuggestions(
  systemPrompt: string,
  userPrompt: string,
  recentHistory: string[],
  onPartial: (suggestions: SuggestionResult[]) => void,
): Promise<StreamResult> {
  const historySet = new Set(recentHistory.map(n => n.trim().toLowerCase()));
  let lastCount = 0;
  let latest: SuggestionResult[] = [];
  let filteredCount = 0;

  await callClaudeStreaming(systemPrompt, userPrompt, (accumulated) => {
    const raw = extractCompleteSuggestionObjects(accumulated);
    if (raw.length > lastCount) {
      lastCount = raw.length;
      let dropped = 0;
      latest = raw
        .map(normalizeSuggestion)
        .filter(s => {
          const nameLc = s.recipe_name.trim().toLowerCase();
          if (historySet.has(nameLc) || isSelfCorrectedSuggestion(s)) {
            dropped++;
            return false;
          }
          return true;
        });
      filteredCount = dropped;
      onPartial(latest);
    }
  });

  return { suggestions: latest, filteredCount };
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

// Patterns that indicate Claude self-corrected mid-generation. When the
// reasoning field opens with one of these, the recipe_name almost always
// disagrees with what the reasoning actually describes — Claude wrote a name,
// realized it was wrong, and pivoted in the description. The card is unsafe
// to render. See prompts.ts "Response Discipline" for the upstream prevention.
const SELF_CORRECTION_PATTERNS = [
  /^\s*wait[\s,—–-]/i,
  /^\s*actually[\s,—–-]/i,
  /^\s*hmm[\s,—–-]/i,
  /^\s*on second thought/i,
  /^\s*let me reconsider/i,
  /^\s*replacing\b/i,
  /^\s*switching to\b/i,
  /^\s*apologies\b/i,
  /\bthis appears in recent history\b/i,
  /\bmust be skipped\b/i,
];

export function isSelfCorrectedSuggestion(s: { reasoning?: string | null }): boolean {
  const r = s.reasoning ?? '';
  return SELF_CORRECTION_PATTERNS.some(p => p.test(r));
}

// Exported for unit testing. Reads the raw streamed object and produces a
// SuggestionResult, tolerating older field names from earlier prompt
// revisions. key_ingredients is the phase-1→phase-2 binding contract and
// must survive normalization, so we filter to string entries explicitly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeSuggestion(s: any): SuggestionResult {
  // Phase 1 returns no adapted_recipe — SuggestionCard fills it in on expand.
  // We still tolerate Claude including a full recipe in case the prompt slips,
  // since the type accepts it either way.
  let adapted: SuggestionResult['adapted_recipe'] = null;
  const recipe = s.adapted_recipe ?? s.recipe;
  if (recipe && (recipe.ingredients || recipe.method || recipe.glassware)) {
    const rawIngredients = recipe.ingredients ?? [];
    adapted = {
      ingredients: rawIngredients.map(normalizeIngredient),
      method: recipe.method ?? '',
      glassware: recipe.glassware ?? recipe.glass ?? '',
      garnish: recipe.garnish ?? '',
      proof_warning: recipe.proof_warning ?? null,
      value_notes: recipe.value_notes ?? null,
      variation_notes: recipe.variation_notes ?? null,
    };
  }
  const keyIngredients = Array.isArray(s.key_ingredients)
    ? s.key_ingredients.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
    : undefined;
  return {
    archetype: s.archetype ?? 'safe',
    recipe_name: s.recipe_name ?? s.name ?? 'Unknown',
    recipe_slug: s.recipe_slug ?? s.slug ?? null,
    reasoning: s.reasoning ?? s.cultural_connection ?? s.description ?? s.spirit_notes ?? '',
    key_ingredients: keyIngredients,
    missing_ingredients: s.missing_ingredients ?? [],
    adapted_recipe: adapted,
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

  // Phase-1 schema only — the full adapted_recipe is fetched lazily by
  // SuggestionCard when the user expands it. Keeping the response short
  // dramatically reduces wall-clock time for the initial card render.
  // key_ingredients is the BINDING contract: phase 2 uses it to build the
  // recipe verbatim, bypassing any canonical recall that would otherwise
  // contradict the reasoning shown to the user.
  const schemaBlock = `
{
  "suggestions": [
    {
      "archetype": "safe" | "adventurous" | "cultural",
      "recipe_name": "string",
      "recipe_slug": "string or null",
      "reasoning": "string (2-3 sentences explaining why this cocktail for this moment — must be consistent with key_ingredients)",
      "key_ingredients": ["string (every ingredient the recipe will use, in order: base spirit first, then modifiers, then accents. Use the exact bottle name from inventory when possible, e.g. 'Kilchoman Machir Bay' not just 'Scotch'. Include all required items — typically 3-6 entries.)"],
      "missing_ingredients": ["string (zero or one items max)"]
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
  const [filteredCount, setFilteredCount] = useState<number>(0);

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
      const { suggestions: parsed, filteredCount: dropped } = await streamSuggestions(
        systemPrompt,
        userPrompt,
        recentHistory,
        (partial) => {
          if (firstCardAt === null && partial.length > 0) {
            firstCardAt = performance.now() - start;
            setResponseTimeMs(Math.round(firstCardAt));
          }
          setSuggestions(partial);
        },
      );
      // Final timing reflects total wall time once streaming closes.
      setResponseTimeMs(Math.round(performance.now() - start));
      setFilteredCount(dropped);

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
      const { suggestions: parsed, filteredCount: dropped } = await streamSuggestions(
        systemPrompt,
        userPrompt,
        recentHistory,
        (partial) => {
          if (firstCardAt === null && partial.length > 0) {
            firstCardAt = performance.now() - start;
            setResponseTimeMs(Math.round(firstCardAt));
          }
          setSuggestions(partial);
        },
      );
      setResponseTimeMs(Math.round(performance.now() - start));
      setFilteredCount(dropped);

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
    setFilteredCount(0);
  };

  return { suggestions, context, loading, error, suggest, refine, reset, weather, responseTimeMs, sessionId, filteredCount };
}
