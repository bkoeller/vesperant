import { Link } from '@tanstack/react-router';
import type { Recipe } from '@/types/database.types';
import { METHOD_LABELS } from '../recipes.types';

interface RecipeCardProps {
  recipe: Recipe;
  canMake?: boolean;
  missingCount?: number;
}

export function RecipeCard({ recipe, canMake, missingCount }: RecipeCardProps) {
  return (
    <Link
      to="/recipes/$slug"
      params={{ slug: recipe.slug }}
      className="block rounded-card bg-bg-surface p-4 no-underline transition-colors hover:bg-bg-elevated"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-serif text-lg font-semibold text-text-primary">
            {recipe.name}
          </h3>
          {recipe.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">
              {recipe.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-pill bg-bg-hover px-2 py-0.5 text-xs font-medium text-text-secondary">
              {METHOD_LABELS[recipe.method]}
            </span>
            {recipe.glassware && (
              <span className="text-xs text-text-tertiary">{recipe.glassware}</span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 pt-1">
          {canMake === true && (
            <span className="rounded-pill bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
              Can make
            </span>
          )}
          {canMake === false && missingCount !== undefined && missingCount > 0 && (
            <span className="rounded-pill bg-bg-hover px-2 py-0.5 text-xs font-medium text-text-tertiary">
              {missingCount} missing
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
