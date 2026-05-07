import { useState, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Search, BookOpen, Download, Filter, Plus } from 'lucide-react';
import { useRecipes, useMakeableRecipes, useSeedRecipes } from '../hooks/useRecipes';
import { FILTER_TAGS } from '../recipes.types';
import { RecipeCard } from './RecipeCard';

type FilterMode = 'all' | 'can-make' | 'almost';

export function RecipesPage() {
  const { data: recipes, isLoading } = useRecipes();
  const { data: makeable } = useMakeableRecipes();
  const seedRecipes = useSeedRecipes();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const makeableMap = useMemo(() => {
    if (!makeable) return new Map<string, { missing: number; ingredients: string[] | null }>();
    const map = new Map<string, { missing: number; ingredients: string[] | null }>();
    for (const m of makeable) {
      map.set(m.recipe_id, { missing: m.missing_count, ingredients: m.missing_ingredients });
    }
    return map;
  }, [makeable]);

  const filtered = useMemo(() => {
    if (!recipes) return [];
    let result = recipes;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.aliases?.some(a => a.toLowerCase().includes(q))
      );
    }

    if (activeTags.size > 0) {
      result = result.filter(r =>
        r.tags?.some(t => activeTags.has(t))
      );
    }

    if (filterMode === 'can-make') {
      result = result.filter(r => {
        const m = makeableMap.get(r.id);
        return m && m.missing === 0;
      });
    } else if (filterMode === 'almost') {
      result = result.filter(r => {
        const m = makeableMap.get(r.id);
        return m && m.missing >= 1 && m.missing <= 2;
      });
    }

    return result;
  }, [recipes, searchQuery, activeTags, filterMode, makeableMap]);

  const toggleTag = (tag: string) => {
    setActiveTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const handleSeed = async () => {
    // Dynamic import so the large seed file isn't in the main bundle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import('../seed-data') as any;
    const CANONICAL_RECIPES = mod.CANONICAL_RECIPES as {
      name: string; slug: string; aliases: string[]; description: string;
      history: string; method: string; glassware: string; garnish: string;
      tags: string[]; iba_category: string | null;
      ingredients: { ingredient_name: string; ingredient_category: string;
        quantity: number | null; unit: string | null; role: string;
        optional: boolean; notes: string | null; }[];
    }[];
    const mapped = CANONICAL_RECIPES.map(r => ({
      recipe: {
        name: r.name,
        slug: r.slug,
        aliases: r.aliases,
        description: r.description,
        history: r.history,
        method: r.method,
        glassware: r.glassware,
        garnish: r.garnish,
        tags: r.tags,
        iba_category: r.iba_category,
        source: 'canonical-seed',
      },
      ingredients: r.ingredients.map((ing: { ingredient_name: string; ingredient_category: string; quantity: number | null; unit: string | null; role: string; optional: boolean; notes: string | null }, i: number) => ({
        ingredient_name: ing.ingredient_name,
        ingredient_category: ing.ingredient_category,
        quantity: ing.quantity,
        unit: ing.unit,
        role: ing.role,
        optional: ing.optional,
        sort_order: i,
        notes: ing.notes,
      })),
    }));
    seedRecipes.mutate(mapped);
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
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Recipes</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {recipes?.length ?? 0} cocktails
          </p>
        </div>
        <Link
          to="/recipes/new"
          className="flex items-center gap-1.5 rounded-button bg-accent-gold px-3 py-2 text-xs font-medium text-bg-base no-underline transition-colors hover:bg-accent-amber"
        >
          <Plus size={14} />
          New Recipe
        </Link>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search cocktails..."
          className="w-full rounded-button bg-bg-surface py-2.5 pl-9 pr-3 text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow placeholder:text-text-tertiary focus:ring-accent-gold-dim"
        />
      </div>

      {/* Filter controls */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1 rounded-button bg-bg-surface p-0.5">
            {([['all', 'All'], ['can-make', 'Can Make'], ['almost', 'Almost']] as const).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`flex-1 rounded-button px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterMode === mode
                    ? 'bg-accent-gold text-bg-base'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`rounded-button p-2 transition-colors ${
              showFilters || activeTags.size > 0
                ? 'bg-accent-gold/10 text-accent-gold'
                : 'text-text-tertiary hover:bg-bg-hover hover:text-text-primary'
            }`}
          >
            <Filter size={16} />
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-1.5">
            {FILTER_TAGS.map(tag => (
              <button
                key={tag.value}
                onClick={() => toggleTag(tag.value)}
                className={`rounded-pill px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeTags.has(tag.value)
                    ? 'bg-accent-gold text-bg-base'
                    : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'
                }`}
              >
                {tag.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recipe list */}
      {(!recipes || recipes.length === 0) ? (
        <div className="flex flex-col items-center gap-4 pt-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-surface">
            <BookOpen size={28} className="text-accent-gold" />
          </div>
          <p className="text-text-secondary">No recipes yet. Import the canonical collection.</p>
          <button
            onClick={handleSeed}
            disabled={seedRecipes.isPending}
            className="flex items-center gap-2 rounded-button bg-accent-gold px-5 py-2.5 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber disabled:opacity-50"
          >
            <Download size={16} />
            {seedRecipes.isPending ? 'Importing...' : 'Import Canonical Recipes'}
          </button>
          {seedRecipes.isError && (
            <p className="text-xs text-error">Import failed: {(seedRecipes.error as Error).message}</p>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <p className="pt-4 text-center text-sm text-text-tertiary">No recipes match your filters.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(recipe => {
            const m = makeableMap.get(recipe.id);
            return (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                canMake={m ? m.missing === 0 : undefined}
                missingCount={m?.missing}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
