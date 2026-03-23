import { Trash2, Pencil, Archive } from 'lucide-react';
import type { Bottle } from '@/types/database.types';

interface BottleCardProps {
  bottle: Bottle;
  onEdit: (bottle: Bottle) => void;
  onDeactivate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function BottleCard({ bottle, onEdit, onDeactivate, onDelete }: BottleCardProps) {
  return (
    <div className="group flex items-center justify-between rounded-card bg-bg-surface px-4 py-3 transition-colors hover:bg-bg-elevated">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">
          {bottle.name}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          {bottle.subcategory && (
            <span className="text-xs text-text-tertiary">{bottle.subcategory}</span>
          )}
          {bottle.abv && (
            <span className="rounded-pill bg-bg-hover px-1.5 py-0.5 text-xs font-medium text-text-secondary">
              {bottle.abv}%
            </span>
          )}
          {bottle.is_premium && (
            <span className="rounded-pill bg-accent-gold/10 px-1.5 py-0.5 text-xs font-medium text-accent-gold">
              {bottle.price_tier ?? 'premium'}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => onEdit(bottle)}
          className="rounded-button p-1.5 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
          aria-label="Edit"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => onDeactivate(bottle.id)}
          className="rounded-button p-1.5 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-warning"
          aria-label="Archive"
        >
          <Archive size={14} />
        </button>
        <button
          onClick={() => onDelete(bottle.id)}
          className="rounded-button p-1.5 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-error"
          aria-label="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
