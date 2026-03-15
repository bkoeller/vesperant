import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logService, type LogInsert } from '../log.service';
import { useAuth } from '@/features/auth/hooks/useAuth';

const LOG_KEY = ['cocktail-logs'] as const;

export function useCocktailLogs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: LOG_KEY,
    queryFn: () => logService.getAll(user!.id),
    enabled: !!user,
  });
}

export function useCreateLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (log: LogInsert) => logService.create(log),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LOG_KEY }),
  });
}

export function useUpdateLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<{ rating: number | null; tasting_notes: string | null; social_context: string | null }> }) =>
      logService.update(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LOG_KEY }),
  });
}

export function useDeleteLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => logService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LOG_KEY }),
  });
}
