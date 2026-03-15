const API_KEY_STORAGE_KEY = 'vesperant_claude_api_key';

export function getClaudeApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function setClaudeApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

export function clearClaudeApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}

export function hasClaudeApiKey(): boolean {
  return !!getClaudeApiKey();
}

export interface AdaptedIngredient {
  ingredient_name: string;
  bottle_from_inventory: string | null;
  quantity: string;
  unit: string;
  notes: string | null;
}

export interface AdaptedRecipe {
  ingredients: AdaptedIngredient[];
  method: string;
  glassware: string;
  garnish: string;
  proof_warning: string | null;
  value_notes: string | null;
  variation_notes: string | null;
}

export interface SuggestionResult {
  archetype: 'safe' | 'adventurous' | 'cultural';
  recipe_name: string;
  recipe_slug: string | null;
  reasoning: string;
  adapted_recipe: AdaptedRecipe;
  missing_ingredients: string[];
}

export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const apiKey = getClaudeApiKey();
  if (!apiKey) throw new Error('Claude API key not configured');

  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, systemPrompt, userPrompt }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${err}`);
  }

  const data = await res.json();
  return data.content;
}
