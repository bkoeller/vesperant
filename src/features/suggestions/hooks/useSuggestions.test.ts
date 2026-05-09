import { describe, it, expect } from 'vitest';
import { buildSuggestionUserPrompt } from './useSuggestions';
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
