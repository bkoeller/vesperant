import { useState, useMemo } from 'react';
import { Clock, Search, Star, Trash2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { useCocktailLogs, useDeleteLog } from '../hooks/useCocktailLog';
import { useSuggestionHistory } from '@/features/suggestions/hooks/useSuggestionHistory';
import type { CocktailLog } from '@/types/database.types';
import type { SuggestionHistorySession } from '@/features/suggestions/suggestion.service';

type Tab = 'cocktails' | 'suggestions';

const ARCHETYPE_STYLES: Record<string, string> = {
  safe: 'bg-archetype-safe/20 text-archetype-safe',
  adventurous: 'bg-archetype-adventurous/20 text-archetype-adventurous',
  cultural: 'bg-archetype-cultural/20 text-archetype-cultural',
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={12}
          fill={n <= rating ? '#c9a84c' : 'transparent'}
          className={n <= rating ? 'text-accent-gold' : 'text-text-tertiary'}
        />
      ))}
    </div>
  );
}

function LogEntry({ log, onDelete }: { log: CocktailLog; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = log.rating || log.tasting_notes || log.social_context;

  return (
    <div className="rounded-card bg-bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="font-serif text-lg font-semibold text-text-primary">
            {log.recipe_name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <span className="text-xs text-text-tertiary">
              {format(new Date(log.logged_at), 'MMM d, yyyy · h:mm a')}
            </span>
            {log.rating && <StarRating rating={log.rating} />}
          </div>
        </div>
        <button
          onClick={() => onDelete(log.id)}
          className="rounded-button p-1.5 text-text-tertiary opacity-0 transition-all hover:bg-bg-hover hover:text-error group-hover:opacity-100 [div:hover>&]:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {hasDetails && (
        <>
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-2 flex items-center gap-1 text-[11px] text-text-tertiary hover:text-text-secondary"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Less' : 'More'}
          </button>

          {expanded && (
            <div className="mt-2 flex flex-col gap-1.5 border-t border-bg-hover pt-2">
              {log.tasting_notes && (
                <p className="text-sm text-text-secondary">{log.tasting_notes}</p>
              )}
              {log.social_context && (
                <p className="text-xs italic text-text-tertiary">{log.social_context}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SuggestionSessionEntry({ session }: { session: SuggestionHistorySession }) {
  const [expanded, setExpanded] = useState(false);
  const ctx = session.context_signals as { mood?: string; occasion?: string; weather?: { temp_f?: number; condition?: string } };

  return (
    <div className="rounded-card bg-bg-surface p-4">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {session.suggestions.map((s, i) => (
              <span key={i} className="font-serif text-base font-semibold text-text-primary">
                {s.recipe_name}{i < session.suggestions.length - 1 ? ',' : ''}
              </span>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
            <span>{format(new Date(session.created_at), 'MMM d, yyyy · h:mm a')}</span>
            {ctx.mood && <span>· {ctx.mood}</span>}
            {ctx.occasion && <span>· {ctx.occasion}</span>}
            {ctx.weather?.temp_f && <span>· {ctx.weather.temp_f}°F</span>}
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="mt-1 shrink-0 text-text-tertiary" /> : <ChevronDown size={14} className="mt-1 shrink-0 text-text-tertiary" />}
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2 border-t border-bg-hover pt-3">
          {session.suggestions.map((s, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className={`rounded-pill px-2 py-0.5 text-[10px] font-medium ${ARCHETYPE_STYLES[s.archetype] ?? ''}`}>
                  {s.archetype}
                </span>
                <span className="text-sm font-medium text-text-primary">{s.recipe_name}</span>
              </div>
              <p className="text-xs text-text-secondary">{s.reasoning}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function HistoryPage() {
  const { data: logs, isLoading: logsLoading } = useCocktailLogs();
  const { data: suggestionSessions, isLoading: sugLoading } = useSuggestionHistory();
  const deleteLog = useDeleteLog();
  const [tab, setTab] = useState<Tab>('cocktails');
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    let result = logs;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.recipe_name.toLowerCase().includes(q) ||
        l.tasting_notes?.toLowerCase().includes(q) ||
        l.social_context?.toLowerCase().includes(q)
      );
    }
    if (ratingFilter) {
      result = result.filter(l => l.rating === ratingFilter);
    }
    return result;
  }, [logs, searchQuery, ratingFilter]);

  const filteredSuggestions = useMemo(() => {
    if (!suggestionSessions) return [];
    if (!searchQuery) return suggestionSessions;
    const q = searchQuery.toLowerCase();
    return suggestionSessions.filter(s =>
      s.suggestions.some(sug =>
        sug.recipe_name.toLowerCase().includes(q) ||
        sug.reasoning.toLowerCase().includes(q)
      )
    );
  }, [suggestionSessions, searchQuery]);

  const handleDelete = (id: string) => {
    if (confirm('Delete this log entry?')) {
      deleteLog.mutate(id);
    }
  };

  const isLoading = tab === 'cocktails' ? logsLoading : sugLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-4 pt-20">
        <div className="h-1 w-16 animate-pulse rounded-full bg-accent-gold-dim" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">History</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {tab === 'cocktails'
            ? `${logs?.length ?? 0} ${logs?.length === 1 ? 'cocktail' : 'cocktails'} logged`
            : `${suggestionSessions?.length ?? 0} ${suggestionSessions?.length === 1 ? 'session' : 'sessions'}`
          }
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-button bg-bg-surface p-1">
        <button
          onClick={() => { setTab('cocktails'); setSearchQuery(''); setRatingFilter(null); }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-button py-2 text-sm font-medium transition-colors ${
            tab === 'cocktails'
              ? 'bg-bg-hover text-text-primary'
              : 'text-text-tertiary hover:text-text-secondary'
          }`}
        >
          <Clock size={14} />
          Cocktails
        </button>
        <button
          onClick={() => { setTab('suggestions'); setSearchQuery(''); setRatingFilter(null); }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-button py-2 text-sm font-medium transition-colors ${
            tab === 'suggestions'
              ? 'bg-bg-hover text-text-primary'
              : 'text-text-tertiary hover:text-text-secondary'
          }`}
        >
          <Sparkles size={14} />
          Suggestions
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={tab === 'cocktails' ? 'Search history...' : 'Search suggestions...'}
            className="w-full rounded-button bg-bg-surface py-2.5 pl-9 pr-3 text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow placeholder:text-text-tertiary focus:ring-accent-gold-dim"
          />
        </div>

        {/* Rating filter — only for cocktails tab */}
        {tab === 'cocktails' && logs && logs.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary">Filter:</span>
            {[null, 5, 4, 3, 2, 1].map(r => (
              <button
                key={r ?? 'all'}
                onClick={() => setRatingFilter(r)}
                className={`rounded-pill px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  ratingFilter === r
                    ? 'bg-accent-gold text-bg-base'
                    : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'
                }`}
              >
                {r === null ? 'All' : `${r}★`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {tab === 'cocktails' ? (
        (!logs || logs.length === 0) ? (
          <div className="flex flex-col items-center gap-4 pt-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-surface">
              <Clock size={28} className="text-accent-gold-dim" />
            </div>
            <p className="text-text-secondary">No cocktails logged yet. Make something tonight.</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <p className="pt-4 text-center text-sm text-text-tertiary">No entries match your search.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredLogs.map(log => (
              <LogEntry key={log.id} log={log} onDelete={handleDelete} />
            ))}
          </div>
        )
      ) : (
        (!suggestionSessions || suggestionSessions.length === 0) ? (
          <div className="flex flex-col items-center gap-4 pt-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-surface">
              <Sparkles size={28} className="text-accent-gold-dim" />
            </div>
            <p className="text-text-secondary">No suggestions yet. Ask the bartender tonight.</p>
          </div>
        ) : filteredSuggestions.length === 0 ? (
          <p className="pt-4 text-center text-sm text-text-tertiary">No sessions match your search.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredSuggestions.map(session => (
              <SuggestionSessionEntry key={session.id} session={session} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
