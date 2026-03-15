import { supabase } from '@/lib/supabase';
import type { Bottle } from '@/types/database.types';

export type BottleInsert = Omit<Bottle, 'id' | 'created_at' | 'updated_at'>;
export type BottleUpdate = Partial<Omit<Bottle, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

// Helper to get an untyped table reference. Our manual Database type doesn't
// have per-table schemas, so Supabase's generics resolve to `never`.
// We cast to `any` here and rely on runtime SQL schema for correctness.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bottles = () => supabase.from('bottles') as any;

export const bottleService = {
  async getActive(): Promise<Bottle[]> {
    const { data, error } = await bottles()
      .select('*')
      .eq('active', true)
      .order('category')
      .order('name');
    if (error) throw error;
    return data as Bottle[];
  },

  async getAll(): Promise<Bottle[]> {
    const { data, error } = await bottles()
      .select('*')
      .order('category')
      .order('name');
    if (error) throw error;
    return data as Bottle[];
  },

  async create(bottle: BottleInsert): Promise<Bottle> {
    const { data, error } = await bottles()
      .insert(bottle)
      .select()
      .single();
    if (error) throw error;
    return data as Bottle;
  },

  async update(id: string, updates: BottleUpdate): Promise<Bottle> {
    const { data, error } = await bottles()
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Bottle;
  },

  async deactivate(id: string): Promise<void> {
    const { error } = await bottles()
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async reactivate(id: string): Promise<void> {
    const { error } = await bottles()
      .update({ active: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await bottles()
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
