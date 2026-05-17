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
  // Lazily populated by phase 2 (SuggestionCard's expand action) — null
  // immediately after phase-1 streaming completes.
  adapted_recipe: AdaptedRecipe | null;
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

/**
 * Stream a Claude completion. `onDelta` is called with the cumulative
 * concatenated text each time new tokens arrive (not just the delta — the
 * caller usually wants the running buffer for incremental JSON parsing).
 * Resolves with the final accumulated text.
 */
export async function callClaudeStreaming(
  systemPrompt: string,
  userPrompt: string,
  onDelta: (accumulated: string) => void,
  model?: string,
): Promise<string> {
  const auth = await getAuthHeader();
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify({ systemPrompt, userPrompt, stream: true, model }),
  });

  if (!res.ok || !res.body) {
    const err = await res.text();
    throw new Error(`Claude API error: ${err}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';
  let accumulated = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });

    let nl;
    while ((nl = sseBuffer.indexOf('\n\n')) !== -1) {
      const event = sseBuffer.slice(0, nl);
      sseBuffer = sseBuffer.slice(nl + 2);
      const dataLine = event.split('\n').find(l => l.startsWith('data: '));
      if (!dataLine) continue;
      try {
        const evt = JSON.parse(dataLine.slice(6));
        if (evt?.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
          accumulated += evt.delta.text ?? '';
          onDelta(accumulated);
        }
      } catch {
        // Ignore unparseable event payloads (e.g., comment heartbeats).
      }
    }
  }

  return accumulated;
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
