import { supabase } from '@/lib/supabase';

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

async function getAuthHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');
  return `Bearer ${token}`;
}

async function postClaude(body: Record<string, unknown>): Promise<string> {
  const auth = await getAuthHeader();
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${err}`);
  }

  const data = await res.json();
  return data.content;
}

export function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  return postClaude({ systemPrompt, userPrompt });
}

export function callClaudeWithVision(
  systemPrompt: string,
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  textPrompt: string,
): Promise<string> {
  const messages = [
    {
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: imageBase64 },
        },
        { type: 'text', text: textPrompt },
      ],
    },
  ];
  return postClaude({ systemPrompt, messages, model: 'claude-sonnet-4-6' });
}
