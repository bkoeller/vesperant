import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronDown, ChevronUp, AlertTriangle, Info } from 'lucide-react';
import type { SuggestionResult } from '@/lib/claude';
import type { Bottle } from '@/types/database.types';
import { useRecipeSlugLookup } from '@/features/recipes/hooks/useRecipes';
import { useAdaptByName } from '../hooks/useAdaptByName';

interface SuggestionCardProps {
  suggestion: SuggestionResult;
  onMakeThis: (suggestion: SuggestionResult) => void;
  // Optional: when provided, "Show recipe" lazy-loads the adapted recipe.
  // When omitted (e.g. in tests), the card relies on suggestion.adapted_recipe
  // already being populated.
  bottles?: Bottle[];
}

function getArchetypeConfig(archetype: string) {
  switch (archetype) {
    case 'adventurous':
      return { label: 'Adventurous', labelClass: 'bg-[#7c4a6a]/15 text-[#c084a0]', borderClass: 'border-[#7c4a6a]/30 bg-[#7c4a6a]/5' };
    case 'cultural':
      return { label: 'Cultural', labelClass: 'bg-[#4a6a7c]/15 text-[#80a4b8]', borderClass: 'border-[#4a6a7c]/30 bg-[#4a6a7c]/5' };
    default:
      return { label: 'Safe Choice', labelClass: 'bg-[#4a7c59]/15 text-[#80b890]', borderClass: 'border-[#4a7c59]/30 bg-[#4a7c59]/5' };
  }
}

export function SuggestionCard({ suggestion, onMakeThis, bottles }: SuggestionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = getArchetypeConfig(suggestion.archetype);
  // Phase 2: lazily load the adapted recipe the first time the card is
  // expanded. If Claude included one in phase 1 (rare — only happens when
  // the prompt slips), we prefer that and skip the round trip.
  const { adapted: lazyRecipe, loading: recipeLoading, error: recipeError, load } = useAdaptByName();
  const recipe = suggestion.adapted_recipe ?? lazyRecipe;
  const lookupSlug = useRecipeSlugLookup();
  const librarySlug = lookupSlug(suggestion.recipe_name);

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    // Trigger phase-2 fetch on first expand if we don't already have a recipe.
    // Pass the phase-1 reasoning AND key_ingredients so the recipe stays
    // consistent with what the user has already seen. key_ingredients is the
    // binding contract — without it, Claude drifts into canonical recall
    // (e.g. naming a build "Smoking Bishop" returns the canonical Victorian
    // mulled wine instead of the build the reasoning described).
    if (next && !recipe && !recipeLoading && bottles && bottles.length > 0) {
      void load(suggestion.recipe_name, bottles, suggestion.reasoning, suggestion.key_ingredients);
    }
  };

  return (
    <div className={`rounded-card border p-4 ${config.borderClass}`}>
      {/* Header */}
      <div>
        <span className={`inline-block rounded-pill px-2 py-0.5 text-xs font-medium uppercase tracking-wider ${config.labelClass}`}>
          {config.label}
        </span>
        <h3 className="mt-2 font-serif text-xl font-semibold text-text-primary">
          {librarySlug ? (
            <Link
              to="/recipes/$slug"
              params={{ slug: librarySlug }}
              className="text-text-primary no-underline hover:text-accent-gold hover:underline"
            >
              {suggestion.recipe_name}
            </Link>
          ) : (
            suggestion.recipe_name
          )}
        </h3>
      </div>

      {/* Reasoning */}
      {suggestion.reasoning && (
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          {suggestion.reasoning}
        </p>
      )}

      {/* Missing ingredients warning */}
      {suggestion.missing_ingredients && suggestion.missing_ingredients.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-warning">
          <AlertTriangle size={12} />
          Missing: {suggestion.missing_ingredients.join(', ')}
        </div>
      )}

      {/* Expand/collapse recipe */}
      <button
        onClick={handleExpand}
        className="mt-3 flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
      >
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {expanded ? 'Hide recipe' : 'Show recipe'}
      </button>

      {/* Phase-2 loading state */}
      {expanded && recipeLoading && !recipe && (
        <div className="mt-3 flex items-center gap-2 border-t border-bg-hover pt-3 text-xs text-text-secondary">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border border-accent-gold-dim border-t-accent-gold" />
          Loading recipe...
        </div>
      )}

      {expanded && recipeError && !recipe && (
        <div className="mt-3 border-t border-bg-hover pt-3">
          <p className="text-xs text-error">Couldn't load recipe: {recipeError}</p>
          <button
            onClick={() => bottles && load(suggestion.recipe_name, bottles, suggestion.reasoning, suggestion.key_ingredients)}
            className="mt-1.5 text-xs text-accent-gold hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {expanded && recipe && (
        <div className="mt-3 border-t border-bg-hover pt-3">
          {/* Ingredients */}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <ul className="flex flex-col gap-2">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex items-baseline justify-between gap-2">
                  <span className={`text-sm ${ing.bottle_from_inventory ? 'font-medium text-accent-gold' : 'text-text-primary'}`}>
                    {ing.bottle_from_inventory ?? ing.ingredient_name}
                  </span>
                  <span className="whitespace-nowrap text-xs text-text-secondary">
                    {ing.quantity} {ing.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Method */}
          {recipe.method && (
            <p className="mt-3 text-xs text-text-secondary">{recipe.method}</p>
          )}
          {recipe.garnish && (
            <p className="mt-1 text-xs text-text-tertiary">Garnish: {recipe.garnish}</p>
          )}

          {/* Warnings */}
          {recipe.proof_warning && (
            <div className="mt-2 flex items-start gap-1.5 rounded-button bg-warning/10 p-2">
              <AlertTriangle size={12} className="mt-0.5 flex-shrink-0 text-warning" />
              <p className="text-xs text-warning">{recipe.proof_warning}</p>
            </div>
          )}
          {recipe.value_notes && (
            <div className="mt-1.5 flex items-start gap-1.5 rounded-button p-2" style={{ backgroundColor: 'rgba(201, 168, 76, 0.05)' }}>
              <Info size={12} className="mt-0.5 flex-shrink-0 text-accent-gold-dim" />
              <p className="text-xs text-text-secondary">{recipe.value_notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Make this button */}
      <button
        onClick={() => onMakeThis(suggestion)}
        className="mt-3 w-full rounded-button bg-bg-hover py-2 text-xs font-medium text-text-primary transition-colors hover:bg-bg-surface"
      >
        Make this
      </button>
    </div>
  );
}
