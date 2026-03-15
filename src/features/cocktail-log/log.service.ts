import { supabase } from '@/lib/supabase';
import type { CocktailLog } from '@/types/database.types';

export interface LogInsert {
  user_id: string;
  recipe_id: string | null;
  recipe_name: string;
  rating: number | null;
  tasting_notes: string | null;
  social_context: string | null;
  bottles_used: string[];
  suggestion_session_id: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const logs = () => supabase.from('cocktail_logs') as any;

export const logService = {
  async getAll(userId: string): Promise<CocktailLog[]> {
    const { data, error } = await logs()
      .select('*')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false });
    if (error) throw error;
    return data as CocktailLog[];
  },

  async create(log: LogInsert): Promise<CocktailLog> {
    const { data, error } = await logs()
      .insert(log)
      .select()
      .single();
    if (error) throw error;
    return data as CocktailLog;
  },

  async update(id: string, updates: Partial<Pick<CocktailLog, 'rating' | 'tasting_notes' | 'social_context'>>): Promise<CocktailLog> {
    const { data, error } = await logs()
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as CocktailLog;
  },

  async remove(id: string): Promise<void> {
    const { error } = await logs()
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
