import { useState } from 'react';
import { Sparkles, Cloud, Calendar, Send, RotateCcw } from 'lucide-react';
import { useSuggestions } from '../hooks/useSuggestions';
import { SuggestionCard } from './SuggestionCard';
import { LogForm } from '@/features/cocktail-log/components/LogForm';
import { useCreateLog } from '@/features/cocktail-log/hooks/useCocktailLog';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { hasClaudeApiKey } from '@/lib/claude';
import type { SuggestionResult } from '@/lib/claude';

export function TonightPage() {
  const { user } = useAuth();
  const { suggestions, loading, error, weather, suggest, refine, reset, responseTimeMs, sessionId } = useSuggestions(user?.id);
  const createLog = useCreateLog();
  const [mood, setMood] = useState('');
  const [occasion, setOccasion] = useState('');
  const [guests, setGuests] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [refinement, setRefinement] = useState('');
  const [loggingSuggestion, setLoggingSuggestion] = useState<SuggestionResult | null>(null);

  const handleSuggest = () => {
    suggest(
      mood || null,
      occasion || null,
      guests || null,
    );
  };

  const handleRefine = () => {
    if (!refinement.trim()) return;
    refine(refinement.trim());
    setRefinement('');
  };

  const handleMakeThis = (suggestion: SuggestionResult) => {
    setLoggingSuggestion(suggestion);
  };

  const handleLog = (data: { rating: number | null; tasting_notes: string | null; social_context: string | null }) => {
    if (!user || !loggingSuggestion) return;
    createLog.mutate({
      user_id: user.id,
      recipe_id: null,
      recipe_name: loggingSuggestion.recipe_name,
      rating: data.rating,
      tasting_notes: data.tasting_notes,
      social_context: data.social_context,
      bottles_used: [],
      suggestion_session_id: sessionId,
    }, {
      onSuccess: () => setLoggingSuggestion(null),
    });
  };

  const apiKeyReady = hasClaudeApiKey();

  // Initial state — no suggestions yet
  if (!suggestions && !loading) {
    return (
      <div className="flex flex-col items-center gap-8 pt-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-surface">
            <Sparkles size={28} className="text-accent-gold" />
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">Tonight</h1>
          <p className="text-text-secondary">
            What should you make this evening?
          </p>
        </div>

        {/* Weather badge */}
        {weather && (
          <div className="flex items-center gap-2 rounded-pill bg-bg-surface px-4 py-2 text-sm text-text-secondary">
            <Cloud size={16} />
            {weather.temp_f}°F, {weather.condition}
          </div>
        )}

        {/* Optional context inputs */}
        <div className="w-full max-w-sm">
          <button
            onClick={() => setShowContext(c => !c)}
            className="mb-3 flex items-center gap-1.5 text-xs font-medium text-text-tertiary hover:text-text-secondary"
          >
            <Calendar size={12} />
            {showContext ? 'Less context' : 'Add context (optional)'}
          </button>

          {showContext && (
            <div className="mb-4 flex flex-col gap-3">
              <input
                type="text"
                value={mood}
                onChange={e => setMood(e.target.value)}
                placeholder="Mood — relaxed, adventurous, celebratory..."
                className="rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover placeholder:text-text-tertiary focus:ring-accent-gold-dim"
              />
              <input
                type="text"
                value={occasion}
                onChange={e => setOccasion(e.target.value)}
                placeholder="Occasion — dinner party, quiet night in..."
                className="rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover placeholder:text-text-tertiary focus:ring-accent-gold-dim"
              />
              <input
                type="text"
                value={guests}
                onChange={e => setGuests(e.target.value)}
                placeholder="Guests — the Rabasas, just me..."
                className="rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover placeholder:text-text-tertiary focus:ring-accent-gold-dim"
              />
            </div>
          )}

          <button
            onClick={handleSuggest}
            disabled={!apiKeyReady || loading}
            className="w-full rounded-button bg-accent-gold py-3 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber disabled:opacity-50"
          >
            {!apiKeyReady
              ? 'Set up Claude API key in Settings'
              : 'Suggest something'
            }
          </button>
        </div>

        {error && (
          <div className="rounded-card bg-error/10 p-3">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-6 pt-16">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-accent-gold-dim border-t-accent-gold" />
        <p className="text-sm text-text-secondary">
          Consulting the bartender...
        </p>
      </div>
    );
  }

  // Suggestions view
  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Tonight</h1>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 rounded-button px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <RotateCcw size={14} />
          Start over
        </button>
      </div>

      {/* Context badges */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
        {weather && (
          <span className="flex items-center gap-1.5">
            <Cloud size={12} />
            {weather.temp_f}°F, {weather.condition}
          </span>
        )}
        {responseTimeMs != null && (
          <span className="flex items-center gap-1.5 italic">
            {responseTimeMs < 1000
              ? `${responseTimeMs}ms`
              : `${(responseTimeMs / 1000).toFixed(1)}s`
            }
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-card bg-error/10 p-3">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Suggestion cards */}
      <div className="flex flex-col gap-4">
        {suggestions?.map((s, i) => (
          <SuggestionCard
            key={`${s.archetype}-${i}`}
            suggestion={s}
            onMakeThis={handleMakeThis}
          />
        ))}
      </div>

      {/* Refinement input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={refinement}
          onChange={e => setRefinement(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleRefine()}
          placeholder="Steer me differently... (lighter, more bourbon, tropical...)"
          className="flex-1 rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover placeholder:text-text-tertiary focus:ring-accent-gold-dim"
        />
        <button
          onClick={handleRefine}
          disabled={!refinement.trim() || loading}
          className="rounded-button bg-accent-gold px-4 text-bg-base transition-colors hover:bg-accent-amber disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </div>

      {/* Log modal */}
      {loggingSuggestion && (
        <LogForm
          recipeName={loggingSuggestion.recipe_name}
          onSubmit={handleLog}
          onClose={() => setLoggingSuggestion(null)}
          submitting={createLog.isPending}
        />
      )}
    </div>
  );
}
