import { describe, it, expect } from 'vitest';
import {
  buildAdaptByNameSystemPrompt,
  buildAdaptByNameUserPrompt,
} from './prompts';
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

// Regression coverage for the phase-2 "name lookup returns a different drink
// than the reasoning described" bug class:
//
//   Phase 1 reasoning: "Cocchi Americano + Green Chartreuse + lemon juice"
//   Phase 1 name:      "Amnesia"
//   Phase 2 (broken):  Chartreuse + Cointreau + Sambuca   ← canonical Amnesia
//   Phase 2 (fixed):   Cocchi Americano + Green Chartreuse + lemon juice
//
// The fix isn't prose persuasion — it's making phase 1 emit an explicit
// key_ingredients list and having phase 2 build the recipe verbatim from it.
// These tests pin the contract: phase 2 must show the binding ingredient
// block to Claude when one is passed, and the system prompt must make clear
// that those ingredients override canonical recall.

describe('buildAdaptByNameSystemPrompt — binding ingredient contract', () => {
  it('declares Required Ingredients as binding', () => {
    const prompt = buildAdaptByNameSystemPrompt();
    expect(prompt).toMatch(/REQUIRED INGREDIENTS ARE BINDING/i);
  });

  it('forbids substitution or canonical-recipe overrides', () => {
    const prompt = buildAdaptByNameSystemPrompt();
    expect(prompt).toMatch(/no additions, no substitutions, no canonical-recipe overrides/i);
  });

  it("clarifies the model's job is quantities/method only — not ingredient choice", () => {
    const prompt = buildAdaptByNameSystemPrompt();
    expect(prompt).toMatch(/ONLY adding quantities, units, method, glassware, and garnish/i);
  });
});

describe('buildAdaptByNameUserPrompt — Required Ingredients block', () => {
  const bottles = [makeBottle({ name: 'Cocchi Americano', category: 'vermouth' })];

  it('renders a Required Ingredients block when keyIngredients is non-empty', () => {
    const prompt = buildAdaptByNameUserPrompt(
      'Amnesia',
      bottles,
      'A bittersweet aperitif.',
      ['Cocchi Americano', 'Green Chartreuse', 'Lemon Juice'],
    );
    expect(prompt).toMatch(/Required Ingredients/);
    expect(prompt).toMatch(/BINDING/);
    expect(prompt).toContain('- Cocchi Americano');
    expect(prompt).toContain('- Green Chartreuse');
    expect(prompt).toContain('- Lemon Juice');
  });

  it('preserves the order of the ingredient list (base first, accents last)', () => {
    const prompt = buildAdaptByNameUserPrompt('X', bottles, null, ['A', 'B', 'C']);
    const a = prompt.indexOf('- A');
    const b = prompt.indexOf('- B');
    const c = prompt.indexOf('- C');
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('omits the BINDING ingredient block when keyIngredients is empty or missing', () => {
    // Absence test: no binding heading and no bulleted ingredient list to
    // force-feed Claude. The user-prompt task may still mention "Required
    // Ingredients" in the back-compat instruction line; what matters is that
    // no actual binding list is rendered.
    const noKey = buildAdaptByNameUserPrompt('Negroni', bottles, 'A balanced aperitif.');
    expect(noKey).not.toMatch(/Required Ingredients \(BINDING/);

    const emptyKey = buildAdaptByNameUserPrompt('Negroni', bottles, 'A balanced aperitif.', []);
    expect(emptyKey).not.toMatch(/Required Ingredients \(BINDING/);
  });

  it('includes the Promised Build (reasoning) when provided', () => {
    const reasoning = 'A bittersweet aperitif tied to the 1977 Cannes Festival.';
    const prompt = buildAdaptByNameUserPrompt('Amnesia', bottles, reasoning, ['Cocchi Americano']);
    expect(prompt).toContain('Promised Build');
    expect(prompt).toContain(reasoning);
  });

  it('tells Claude the ingredients array must mirror Required Ingredients 1:1', () => {
    const prompt = buildAdaptByNameUserPrompt('Amnesia', bottles, '', ['Cocchi Americano', 'Green Chartreuse']);
    expect(prompt).toMatch(/one entry per Required Ingredient, in the same order/i);
  });

  it('still includes the user inventory so Claude can resolve bottles', () => {
    const prompt = buildAdaptByNameUserPrompt('Amnesia', bottles, null, ['Cocchi Americano']);
    expect(prompt).toContain('Cocchi Americano');
    expect(prompt).toContain('Bar Inventory');
  });
});
