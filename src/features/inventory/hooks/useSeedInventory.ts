import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { KOELLER_BAR_INVENTORY } from '../seed-data';
import { useAuth } from '@/features/auth/hooks/useAuth';

export function useSeedInventory() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const rows = KOELLER_BAR_INVENTORY.map(b => ({
        user_id: user.id,
        name: b.name,
        brand: b.brand,
        category: b.category,
        subcategory: b.subcategory,
        spirit_type: b.spirit_type,
        tags: b.tags,
        abv: b.abv,
        proof: b.abv ? b.abv * 2 : null,
        is_premium: b.is_premium,
        price_tier: b.price_tier,
        active: true,
        notes: null,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('bottles') as any).insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bottles', 'active'] });
    },
  });
}
