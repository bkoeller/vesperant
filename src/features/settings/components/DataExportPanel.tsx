import { useState } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { bottleService } from '@/features/inventory/inventory.service';
import { recipeService, type RecipeWithIngredients } from '@/features/recipes/recipes.service';
import { logService } from '@/features/cocktail-log/log.service';
import { toCsv, downloadCsv, csvFilename, type CsvCell } from '@/lib/csv';

type Dataset = 'bottles' | 'recipes' | 'history';

const BOTTLE_COLUMNS = [
  'name', 'brand', 'category', 'subcategory', 'spirit_type',
  'tags', 'abv', 'proof', 'price_tier', 'is_premium', 'active',
  'notes', 'created_at',
] as const;

const RECIPE_COLUMNS = [
  'name', 'aliases', 'slug', 'source', 'method', 'glassware', 'garnish',
  'tags', 'iba_category', 'description', 'history', 'ingredients',
] as const;

const HISTORY_COLUMNS = [
  'logged_at', 'recipe_name', 'rating', 'tasting_notes',
  'social_context', 'bottles_used',
] as const;

function formatIngredient(ing: { ingredient_name: string; quantity: number | null; unit: string | null; optional: boolean }): string {
  const qty = ing.quantity != null ? `${ing.quantity}${ing.unit ? ' ' + ing.unit : ''} ` : '';
  const tail = ing.optional ? ' (optional)' : '';
  return `${qty}${ing.ingredient_name}${tail}`;
}

function recipeRow(r: RecipeWithIngredients): Record<(typeof RECIPE_COLUMNS)[number], CsvCell> {
  return {
    name: r.name,
    aliases: r.aliases,
    slug: r.slug,
    source: r.source,
    method: r.method,
    glassware: r.glassware,
    garnish: r.garnish,
    tags: r.tags,
    iba_category: r.iba_category,
    description: r.description,
    history: r.history,
    ingredients: (r.recipe_ingredients ?? []).map(formatIngredient).join('; '),
  };
}

export function DataExportPanel() {
  const { user } = useAuth();
  const [busy, setBusy] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (dataset: Dataset) => {
    if (!user) return;
    setBusy(dataset);
    setError(null);
    try {
      if (dataset === 'bottles') {
        const bottles = await bottleService.getAll();
        const rows = bottles.map(b => ({
          name: b.name, brand: b.brand, category: b.category,
          subcategory: b.subcategory, spirit_type: b.spirit_type, tags: b.tags,
          abv: b.abv, proof: b.proof, price_tier: b.price_tier,
          is_premium: b.is_premium, active: b.active, notes: b.notes,
          created_at: b.created_at,
        }));
        downloadCsv(csvFilename('bottles'), toCsv(rows, [...BOTTLE_COLUMNS]));
      } else if (dataset === 'recipes') {
        const recipes = await recipeService.getAllWithIngredients();
        downloadCsv(csvFilename('recipes'), toCsv(recipes.map(recipeRow), [...RECIPE_COLUMNS]));
      } else {
        const logs = await logService.getAll(user.id);
        const rows = logs.map(l => ({
          logged_at: l.logged_at,
          recipe_name: l.recipe_name,
          rating: l.rating,
          tasting_notes: l.tasting_notes,
          social_context: l.social_context,
          bottles_used: l.bottles_used,
        }));
        downloadCsv(csvFilename('history'), toCsv(rows, [...HISTORY_COLUMNS]));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const ExportRow = ({ dataset, label, hint }: { dataset: Dataset; label: string; hint: string }) => (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text-primary">{label}</p>
        <p className="text-xs text-text-tertiary">{hint}</p>
      </div>
      <button
        onClick={() => run(dataset)}
        disabled={busy !== null}
        className="flex shrink-0 items-center gap-2 rounded-button bg-bg-hover px-3 py-2 text-sm text-text-primary transition-colors hover:bg-bg-elevated disabled:opacity-50"
      >
        {busy === dataset ? (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border border-accent-gold-dim border-t-accent-gold" />
        ) : (
          <Download size={14} />
        )}
        Export CSV
      </button>
    </div>
  );

  return (
    <div className="rounded-card bg-bg-surface p-4">
      <h2 className="mb-1 text-lg">Data export</h2>
      <p className="mb-3 text-sm text-text-secondary">Download your data as CSV — opens cleanly in Excel, Numbers, or Google Sheets.</p>
      <div className="flex flex-col gap-3">
        <ExportRow dataset="bottles" label="Bottle inventory" hint="One row per bottle: name, category, ABV, tags, notes." />
        <ExportRow dataset="recipes" label="Recipe library" hint="Canonical + your custom recipes, ingredients joined into one cell." />
        <ExportRow dataset="history" label="Cocktail history" hint="Every logged cocktail with rating, tasting notes, and social context." />
      </div>
      {error && <p className="mt-3 text-xs text-error">Export failed: {error}</p>}
    </div>
  );
}
