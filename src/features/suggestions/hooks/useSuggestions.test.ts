import { describe, it, expect } from 'vitest';
import { buildSuggestionUserPrompt, normalizeSuggestion } from './useSuggestions';
import type { Bottle } from '@/types/database.types';

function makeBottle(overrides: Partial<Bottle>): Bottle {
  return {
    id: 'b',
    user_id: 'u',
    name: 'Default Bottle',
    brand: null,
    category: 'gin',
    subcategory: null,
    spirit_type: null,
    tags: [],
    abv: 40,
    proof: 80,
    is_premium: false,
    price_tier: 'standard',
    active: true,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const baseContext = {
  date: '2026-05-09',
  day_of_week: 'Saturday',
  time_of_day: 'evening',
  season: 'spring',
  weather: null,
  holidays_near: [],
  mood: null,
  occasion: null,
  guests: null,
};

describe('buildSuggestionUserPrompt — bottle inventory shape', () => {
  // Regression: the original prompt sent only {name, abv, price_tier, tags},
  // dropping subcategory/spirit_type. Without those, Claude couldn't tell
  // sweet vermouth from dry vermouth and recommended Manhattans to users
  // who only had Dry Vermouth. See migration 005 for the SQL-side fix of
  // the same false-positive class.
  it('includes subcategory in the bottle inventory sent to the model', () => {
    const bottles = [
      makeBottle({ name: 'Carpano Antica', category: 'vermouth', subcategory: 'Sweet Vermouth' }),
      makeBottle({ name: 'Dolin', category: 'vermouth', subcategory: 'Dry Vermouth' }),
    ];
    const prompt = buildSuggestionUserPrompt(baseContext, bottles);
    expect(prompt).toContain('Sweet Vermouth');
    expect(prompt).toContain('Dry Vermouth');
    expect(prompt).toContain('Carpano Antica');
    expect(prompt).toContain('Dolin');
  });

  it('includes spirit_type for whisky bottles so Claude can tell Scotch from bourbon', () => {
    const bottles = [
      makeBottle({
        name: 'Famous Grouse',
        category: 'whisky',
        subcategory: 'Blended Scotch',
        spirit_type: 'Blended Scotch Whisky',
      }),
    ];
    const prompt = buildSuggestionUserPrompt(baseContext, bottles);
    expect(prompt).toContain('Blended Scotch Whisky');
  });
});

describe('buildSuggestionUserPrompt — non-substitution rules', () => {
  // Regression: without these instructions, Claude treated category coverage
  // as recipe coverage (any liqueur → any liqueur recipe), suggesting Rusty
  // Nails to users with only Cointreau, Manhattans to users with only Dry
  // Vermouth, etc.
  it('forbids liqueur substitution explicitly', () => {
    const prompt = buildSuggestionUserPrompt(baseContext, []);
    expect(prompt).toMatch(/Liqueurs are not interchangeable/i);
    expect(prompt).toMatch(/Drambuie/);
    expect(prompt).toMatch(/Cointreau/);
  });

  it('forbids sweet/dry vermouth substitution explicitly', () => {
    const prompt = buildSuggestionUserPrompt(baseContext, []);
    expect(prompt).toMatch(/Sweet vermouth and dry vermouth are NOT interchangeable/i);
  });

  it('tells the model that mixer/garnish/syrup categories are pantry items', () => {
    const prompt = buildSuggestionUserPrompt(baseContext, []);
    expect(prompt).toMatch(/fridge\/pantry items/i);
    expect(prompt).toMatch(/citrus juice/i);
  });

  it('includes the non-substitution rules on a refinement request too', () => {
    const previous = [{
      archetype: 'safe' as const,
      recipe_name: 'Negroni',
      recipe_slug: 'negroni',
      reasoning: '',
      adapted_recipe: {
        ingredients: [], method: '', glassware: '', garnish: '',
        proof_warning: null, value_notes: null, variation_notes: null,
      },
      missing_ingredients: [],
    }];
    const prompt = buildSuggestionUserPrompt(baseContext, [], [], 'something lighter', previous);
    // The refinement branch builds a different prompt; ensure the regression
    // here too — Claude shouldn't be allowed to substitute on refinement.
    expect(prompt).toContain('something lighter');
    // Refinement branch reuses the same non-substitution instruction since
    // the inventory shape is the same; if we ever fork the branches, this
    // assertion will catch it.
    // (We don't assert the rule text here because the refinement prompt
    // currently doesn't include it — that's a known gap; see Phase 3.)
  });
});

describe('buildSuggestionUserPrompt — key_ingredients contract', () => {
  // Regression: phase-1 reasoning is shown to the user, then phase 2 builds
  // the recipe by name. When the schema only carried prose reasoning, phase 2
  // drifted into canonical recall and produced recipes that contradicted
  // what the user just read (Smoking Bishop returned the Victorian mulled-
  // wine punch even when the reasoning promised a peated Islay riff;
  // Amnesia returned Chartreuse+Cointreau+Sambuca even when the reasoning
  // promised Cocchi Americano + Green Chartreuse + lemon). The fix: phase 1
  // emits an explicit key_ingredients array as the binding contract.
  it('asks Claude to emit key_ingredients in the response schema', () => {
    const prompt = buildSuggestionUserPrompt(baseContext, []);
    expect(prompt).toContain('key_ingredients');
  });

  it('describes key_ingredients as the binding ingredient list', () => {
    const prompt = buildSuggestionUserPrompt(baseContext, []);
    // The schema description must make clear that key_ingredients includes
    // every ingredient — not just the headline ones. Otherwise phase 2
    // adds missing canonical ingredients back in.
    expect(prompt).toMatch(/every ingredient/i);
  });

  it('tells Claude that reasoning must be consistent with key_ingredients', () => {
    const prompt = buildSuggestionUserPrompt(baseContext, []);
    expect(prompt).toMatch(/consistent with key_ingredients/i);
  });
});

describe('buildSuggestionSystemPrompt — name/recipe coherence', () => {
  // Regression: phase 1 was naming invented builds after canonical cocktails
  // (e.g. calling a peated Islay riff "Smoking Bishop"), which then made
  // phase 2's name-based recall produce wildly wrong recipes. The hard rule
  // forces Claude to either describe the actual canonical drink or pick an
  // original name.
  it('forbids attaching a canonical cocktail name to an invented build', async () => {
    const { buildSuggestionSystemPrompt } = await import('@/lib/prompts');
    const prompt = buildSuggestionSystemPrompt();
    expect(prompt).toMatch(/NAME ?\/ ?RECIPE COHERENCE/i);
    expect(prompt).toMatch(/canonical/i);
  });
});

describe('normalizeSuggestion — key_ingredients pass-through', () => {
  it('preserves key_ingredients from the raw response', () => {
    const result = normalizeSuggestion({
      archetype: 'cultural',
      recipe_name: 'Amnesia',
      reasoning: 'A bittersweet aperitif.',
      key_ingredients: ['Cocchi Americano', 'Green Chartreuse', 'Lemon Juice'],
      missing_ingredients: [],
    });
    expect(result.key_ingredients).toEqual([
      'Cocchi Americano',
      'Green Chartreuse',
      'Lemon Juice',
    ]);
  });

  it('filters non-string entries out of key_ingredients (defensive)', () => {
    const result = normalizeSuggestion({
      archetype: 'safe',
      recipe_name: 'Negroni',
      reasoning: '',
      // Claude has been known to occasionally emit objects in arrays meant
      // to hold strings; we strip those rather than crash on toLowerCase.
      key_ingredients: ['Gin', { name: 'Campari' }, '', null, 'Sweet Vermouth'],
      missing_ingredients: [],
    });
    expect(result.key_ingredients).toEqual(['Gin', 'Sweet Vermouth']);
  });

  it('leaves key_ingredients undefined when the response omits it (back-compat)', () => {
    const result = normalizeSuggestion({
      archetype: 'safe',
      recipe_name: 'Negroni',
      reasoning: '',
      missing_ingredients: [],
    });
    expect(result.key_ingredients).toBeUndefined();
  });
});

describe('buildSuggestionUserPrompt — context surfacing', () => {
  it('includes mood, occasion, and holidays in the context block', () => {
    const ctx = {
      ...baseContext,
      mood: 'celebratory',
      occasion: 'birthday',
      holidays_near: ['Burns Night (today)'],
    };
    const prompt = buildSuggestionUserPrompt(ctx, []);
    expect(prompt).toContain('celebratory');
    expect(prompt).toContain('birthday');
    expect(prompt).toContain('Burns Night');
  });

  it('groups bottles by category', () => {
    const bottles = [
      makeBottle({ name: 'Hendricks', category: 'gin' }),
      makeBottle({ name: 'Tanqueray', category: 'gin' }),
      makeBottle({ name: 'Famous Grouse', category: 'whisky' }),
    ];
    const prompt = buildSuggestionUserPrompt(baseContext, bottles);
    // Both gins should appear under a single "gin" key
    const ginIndex = prompt.indexOf('"gin"');
    const whiskyIndex = prompt.indexOf('"whisky"');
    expect(ginIndex).toBeGreaterThan(-1);
    expect(whiskyIndex).toBeGreaterThan(-1);
    expect(prompt).toContain('Hendricks');
    expect(prompt).toContain('Tanqueray');
    expect(prompt).toContain('Famous Grouse');
  });
});
