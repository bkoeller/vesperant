import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bottleService, type BottleInsert, type BottleUpdate } from '../inventory.service';

const BOTTLES_KEY = ['bottles', 'active'] as const;

export function useBottles() {
  return useQuery({
    queryKey: BOTTLES_KEY,
    queryFn: bottleService.getActive,
  });
}

export function useCreateBottle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bottle: BottleInsert) => bottleService.create(bottle),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BOTTLES_KEY }),
  });
}

export function useUpdateBottle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: BottleUpdate }) =>
      bottleService.update(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BOTTLES_KEY }),
  });
}

export function useDeactivateBottle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bottleService.deactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BOTTLES_KEY }),
  });
}

export function useDeleteBottle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bottleService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BOTTLES_KEY }),
  });
}
