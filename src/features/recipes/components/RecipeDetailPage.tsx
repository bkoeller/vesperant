import { useState } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { ArrowLeft, GlassWater, Wand2, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { useRecipeBySlug } from '../hooks/useRecipes';
import { useAdaptRecipe } from '../hooks/useAdaptRecipe';
import { useBottles } from '@/features/inventory/hooks/useBottles';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useCreateLog } from '@/features/cocktail-log/hooks/useCocktailLog';
import { LogForm } from '@/features/cocktail-log/components/LogForm';
import { hasClaudeApiKey } from '@/lib/claude';
import { METHOD_LABELS } from '../recipes.types';
import type { IngredientRole } from '@/types/database.types';

const ROLE_LABELS: Record<IngredientRole, string> = {
  base: 'Base',
  modifier: 'Modifier',
  accent: 'Accent',
  sweetener: 'Sweetener',
  sour: 'Sour',
  bitters: 'Bitters',
  garnish: 'Garnish',
  topper: 'Topper',
  rinse: 'Rinse',
  other: '',
};

function formatQuantity(qty: number | null, unit: string | null): string {
  if (!qty && !unit) return '';
  if (!qty) return unit ?? '';
  const fractions: Record<number, string> = {
    0.25: '\u00BC', 0.33: '\u2153', 0.5: '\u00BD',
    0.67: '\u2154', 0.75: '\u00BE', 1.5: '1\u00BD',
    2.5: '2\u00BD',
  };
  const display = fractions[qty] ?? qty.toString();
  return unit ? `${display} ${unit}` : display;
}

export function RecipeDetailPage() {
  const { slug } = useParams({ from: '/recipes/$slug' });
  const { data: recipe, isLoading, error } = useRecipeBySlug(slug);
  const { data: bottles } = useBottles();
  const { user } = useAuth();
  const createLog = useCreateLog();
  const { adapted, loading: adapting, error: adaptError, adapt, reset } = useAdaptRecipe();
  const [showLogForm, setShowLogForm] = useState(false);

  const handleLog = (data: { rating: number | null; tasting_notes: string | null; social_context: string | null }) => {
    if (!user || !recipe) return;
    createLog.mutate({
      user_id: user.id,
      recipe_id: recipe.id,
      recipe_name: recipe.name,
      rating: data.rating,
      tasting_notes: data.tasting_notes,
      social_context: data.social_context,
      bottles_used: [],
      suggestion_session_id: null,
    }, {
      onSuccess: () => setShowLogForm(false),
    });
  };

  const handleAdapt = () => {
    if (!recipe || !bottles) return;
    adapt(
      recipe.name,
      recipe.recipe_ingredients,
      recipe.method,
      recipe.glassware ?? '',
      recipe.garnish ?? '',
      bottles,
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-4 pt-20">
        <div className="h-1 w-16 animate-pulse rounded-full bg-accent-gold-dim" />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="flex flex-col items-center gap-4 pt-12 text-center">
        <p className="text-text-secondary">Recipe not found.</p>
        <Link to="/recipes" className="text-sm text-accent-gold no-underline hover:text-accent-amber">
          Back to recipes
        </Link>
      </div>
    );
  }

  const mainIngredients = recipe.recipe_ingredients.filter(i => i.role !== 'garnish');
  const garnishes = recipe.recipe_ingredients.filter(i => i.role === 'garnish');

  return (
    <div className="flex flex-col gap-6 pt-2">
      {/* Back link */}
      <Link
        to="/recipes"
        className="flex items-center gap-1.5 text-sm text-text-secondary no-underline hover:text-text-primary"
      >
        <ArrowLeft size={16} />
        Recipes
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-4xl font-semibold tracking-tight">{recipe.name}</h1>
        {recipe.aliases && recipe.aliases.length > 0 && (
          <p className="mt-1 text-sm italic text-text-tertiary">
            aka {recipe.aliases.join(', ')}
          </p>
        )}
        {recipe.description && (
          <p className="mt-3 leading-relaxed text-text-secondary">{recipe.description}</p>
        )}
      </div>

      {/* Method & Glassware badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-pill bg-bg-surface px-3 py-1 text-xs font-medium text-text-secondary">
          {METHOD_LABELS[recipe.method]}
        </span>
        {recipe.glassware && (
          <span className="flex items-center gap-1.5 rounded-pill bg-bg-surface px-3 py-1 text-xs text-text-secondary">
            <GlassWater size={12} />
            {recipe.glassware}
          </span>
        )}
        {recipe.iba_category && (
          <span className="rounded-pill bg-accent-gold/10 px-3 py-1 text-xs font-medium text-accent-gold">
            IBA {recipe.iba_category}
          </span>
        )}
      </div>

      {/* Tags */}
      {recipe.tags && recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {recipe.tags.map(tag => (
            <span key={tag} className="rounded-pill bg-bg-hover px-2 py-0.5 text-xs font-medium text-text-tertiary">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Canonical Ingredients */}
      <div className="rounded-card bg-bg-surface p-4">
        <h2 className="mb-3 text-lg font-semibold">Canonical Recipe</h2>
        <ul className="flex flex-col gap-2.5">
          {mainIngredients.map(ing => (
            <li key={ing.id} className="flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-text-primary">{ing.ingredient_name}</span>
                {ing.optional && (
                  <span className="text-xs italic text-text-tertiary">optional</span>
                )}
                {ing.notes && (
                  <span className="text-xs text-text-tertiary">({ing.notes})</span>
                )}
              </div>
              <div className="flex items-baseline gap-2 text-right">
                <span className="whitespace-nowrap text-sm text-text-secondary">
                  {formatQuantity(ing.quantity, ing.unit)}
                </span>
                {ROLE_LABELS[ing.role] && (
                  <span className="text-xs text-text-tertiary">{ROLE_LABELS[ing.role]}</span>
                )}
              </div>
            </li>
          ))}
        </ul>

        {garnishes.length > 0 && (
          <>
            <div className="my-3 h-px bg-bg-hover" />
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">Garnish</h3>
            <ul className="flex flex-col gap-1.5">
              {garnishes.map(g => (
                <li key={g.id} className="text-sm text-text-secondary">
                  {g.ingredient_name}
                  {g.notes && <span className="text-text-tertiary"> ({g.notes})</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Adapt to My Bar */}
      {!adapted && (
        <button
          onClick={handleAdapt}
          disabled={adapting || !hasClaudeApiKey()}
          className="flex items-center justify-center gap-2 rounded-button bg-accent-gold py-3 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber disabled:opacity-50"
        >
          {adapting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-bg-base border-t-transparent" />
              Adapting to your bar...
            </>
          ) : (
            <>
              <Wand2 size={16} />
              {hasClaudeApiKey() ? 'Adapt to My Bar' : 'Set up Claude API key in Settings'}
            </>
          )}
        </button>
      )}

      {adaptError && (
        <div className="rounded-card bg-error/10 p-3">
          <p className="text-sm text-error">{adaptError}</p>
        </div>
      )}

      {/* Adapted Recipe */}
      {adapted && (
        <div className="rounded-card border border-accent-gold-dim/30 bg-bg-surface p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-accent-gold">
              <Wand2 size={18} />
              Your Build
            </h2>
            <button
              onClick={reset}
              className="text-xs text-text-tertiary hover:text-text-secondary"
            >
              Dismiss
            </button>
          </div>

          {/* Adapted ingredients */}
          <ul className="flex flex-col gap-3">
            {adapted.ingredients.map((ing, i) => (
              <li key={i} className="flex flex-col gap-0.5">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {ing.bottle_from_inventory ? (
                      <span className="font-medium text-accent-gold">{ing.bottle_from_inventory}</span>
                    ) : (
                      <span className="font-medium text-text-primary">{ing.ingredient_name}</span>
                    )}
                  </div>
                  <span className="whitespace-nowrap text-sm text-text-secondary">
                    {ing.quantity} {ing.unit}
                  </span>
                </div>
                {ing.notes && (
                  <p className="flex items-start gap-1.5 text-xs text-text-tertiary">
                    <Info size={11} className="mt-0.5 flex-shrink-0" />
                    {ing.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>

          {/* Method */}
          <div className="mt-4 border-t border-bg-hover pt-3">
            <p className="text-sm text-text-secondary">{adapted.method}</p>
          </div>

          {/* Garnish */}
          {adapted.garnish && (
            <p className="mt-2 text-sm text-text-tertiary">
              Garnish: {adapted.garnish}
            </p>
          )}

          {/* Warnings and notes */}
          {adapted.proof_warning && (
            <div className="mt-3 flex items-start gap-2 rounded-button bg-warning/10 p-2.5">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-warning" />
              <p className="text-xs text-warning">{adapted.proof_warning}</p>
            </div>
          )}
          {adapted.value_notes && (
            <div className="mt-2 flex items-start gap-2 rounded-button bg-accent-gold/5 p-2.5">
              <Info size={14} className="mt-0.5 flex-shrink-0 text-accent-gold-dim" />
              <p className="text-xs text-text-secondary">{adapted.value_notes}</p>
            </div>
          )}
          {adapted.variation_notes && (
            <div className="mt-2 flex items-start gap-2 rounded-button bg-info/10 p-2.5">
              <Info size={14} className="mt-0.5 flex-shrink-0 text-info" />
              <p className="text-xs text-text-secondary">{adapted.variation_notes}</p>
            </div>
          )}
        </div>
      )}

      {/* I made this */}
      <button
        onClick={() => setShowLogForm(true)}
        className="flex items-center justify-center gap-2 rounded-button bg-bg-surface py-3 text-sm font-medium text-text-primary transition-colors hover:bg-bg-hover"
      >
        <CheckCircle size={16} />
        I made this
      </button>

      {/* History */}
      {recipe.history && (
        <div className="rounded-card bg-bg-surface p-4">
          <h2 className="mb-2 text-lg font-semibold">History</h2>
          <p className="text-sm leading-relaxed text-text-secondary">{recipe.history}</p>
        </div>
      )}

      {/* Log modal */}
      {showLogForm && (
        <LogForm
          recipeName={recipe.name}
          onSubmit={handleLog}
          onClose={() => setShowLogForm(false)}
          submitting={createLog.isPending}
        />
      )}
    </div>
  );
}
