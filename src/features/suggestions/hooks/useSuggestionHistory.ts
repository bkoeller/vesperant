import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { suggestionService } from '../suggestion.service';

const SUGGESTION_HISTORY_KEY = ['suggestion-history'] as const;

export function useSuggestionHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: SUGGESTION_HISTORY_KEY,
    queryFn: () => suggestionService.getHistory(user!.id),
    enabled: !!user,
  });
}
