import { useState, useMemo } from 'react';
import { Clock, Search, Star, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { useCocktailLogs, useDeleteLog } from '../hooks/useCocktailLog';
import type { CocktailLog } from '@/types/database.types';

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

export function HistoryPage() {
  const { data: logs, isLoading } = useCocktailLogs();
  const deleteLog = useDeleteLog();
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);

  const filtered = useMemo(() => {
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

  const handleDelete = (id: string) => {
    if (confirm('Delete this log entry?')) {
      deleteLog.mutate(id);
    }
  };

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
          {logs?.length ?? 0} {logs?.length === 1 ? 'cocktail' : 'cocktails'} logged
        </p>
      </div>

      {/* Search & filter */}
      {logs && logs.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search history..."
              className="w-full rounded-button bg-bg-surface py-2.5 pl-9 pr-3 text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow placeholder:text-text-tertiary focus:ring-accent-gold-dim"
            />
          </div>
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
        </div>
      )}

      {/* Timeline */}
      {(!logs || logs.length === 0) ? (
        <div className="flex flex-col items-center gap-4 pt-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-surface">
            <Clock size={28} className="text-accent-gold-dim" />
          </div>
          <p className="text-text-secondary">No cocktails logged yet. Make something tonight.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="pt-4 text-center text-sm text-text-tertiary">No entries match your search.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(log => (
            <LogEntry key={log.id} log={log} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
