import { supabase } from '@/lib/supabase';
import type { SuggestionResult } from '@/lib/claude';
import type { ContextSignals } from './hooks/useSuggestions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sessions = () => supabase.from('suggestion_sessions') as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const suggestions = () => supabase.from('suggestions') as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const logs = () => supabase.from('cocktail_logs') as any;

export interface RecentSuggestion {
  recipe_name: string;
  archetype: string;
  created_at: string;
}

export interface SuggestionHistorySession {
  id: string;
  created_at: string;
  context_signals: Record<string, unknown>;
  suggestions: {
    recipe_name: string;
    archetype: 'safe' | 'adventurous' | 'cultural';
    reasoning: string;
  }[];
}

export const suggestionService = {
  /**
   * Get recipe names suggested in the last N days, plus recently logged cocktails.
   * Returns a deduplicated list of recipe names to avoid.
   */
  async getRecentRecipeNames(userId: string, days: number = 14): Promise<string[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceIso = since.toISOString();

    // Fetch recent suggestions and recent logs in parallel
    const [sugResult, logResult] = await Promise.all([
      sessions()
        .select('id, created_at')
        .eq('user_id', userId)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false }),
      logs()
        .select('recipe_name, logged_at')
        .eq('user_id', userId)
        .gte('logged_at', sinceIso)
        .order('logged_at', { ascending: false }),
    ]);

    const recentNames = new Set<string>();

    // Get suggestion recipe names from those sessions
    if (sugResult.data && sugResult.data.length > 0) {
      const sessionIds = sugResult.data.map((s: { id: string }) => s.id);
      const { data: sugData } = await suggestions()
        .select('recipe_name, archetype, created_at')
        .in('session_id', sessionIds);

      if (sugData) {
        for (const s of sugData as RecentSuggestion[]) {
          recentNames.add(s.recipe_name);
        }
      }
    }

    // Add logged cocktail names
    if (logResult.data) {
      for (const log of logResult.data as { recipe_name: string }[]) {
        recentNames.add(log.recipe_name);
      }
    }

    return Array.from(recentNames);
  },

  /**
   * Save a suggestion session and its individual suggestions to the database.
   * Returns the session ID.
   */
  async saveSession(
    userId: string,
    context: ContextSignals,
    results: SuggestionResult[],
  ): Promise<string> {
    const { data: session, error: sessionError } = await sessions()
      .insert({ user_id: userId, context_signals: context })
      .select('id')
      .single();

    if (sessionError) throw sessionError;
    const sessionId = (session as { id: string }).id;

    const rows = results.map((s, i) => ({
      session_id: sessionId,
      recipe_name: s.recipe_name,
      archetype: s.archetype,
      reasoning: s.reasoning,
      adapted_recipe: s.adapted_recipe,
      sort_order: i,
      selected: false,
    }));

    const { error: sugError } = await suggestions().insert(rows);
    if (sugError) throw sugError;

    return sessionId;
  },

  /**
   * Get all suggestion sessions with their suggestions, ordered newest first.
   */
  async getHistory(userId: string): Promise<SuggestionHistorySession[]> {
    const { data: sessionData, error: sessionError } = await sessions()
      .select('id, created_at, context_signals')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (sessionError) throw sessionError;
    if (!sessionData || sessionData.length === 0) return [];

    const sessionIds = (sessionData as { id: string }[]).map(s => s.id);
    const { data: sugData, error: sugError } = await suggestions()
      .select('session_id, recipe_name, archetype, reasoning, sort_order')
      .in('session_id', sessionIds)
      .order('sort_order', { ascending: true });

    if (sugError) throw sugError;

    // Group suggestions by session
    const sugBySession = new Map<string, { recipe_name: string; archetype: 'safe' | 'adventurous' | 'cultural'; reasoning: string }[]>();
    if (sugData) {
      for (const s of sugData as { session_id: string; recipe_name: string; archetype: 'safe' | 'adventurous' | 'cultural'; reasoning: string }[]) {
        if (!sugBySession.has(s.session_id)) sugBySession.set(s.session_id, []);
        sugBySession.get(s.session_id)!.push({ recipe_name: s.recipe_name, archetype: s.archetype, reasoning: s.reasoning });
      }
    }

    return (sessionData as { id: string; created_at: string; context_signals: Record<string, unknown> }[]).map(session => ({
      ...session,
      suggestions: sugBySession.get(session.id) ?? [],
    }));
  },
};
