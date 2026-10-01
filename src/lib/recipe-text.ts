import type { AdaptedRecipe } from '@/lib/claude';
import type { RecipeIngredient } from '@/types/database.types';
import type { RecipeWithIngredients } from '@/features/recipes/recipes.service';
import { METHOD_LABELS } from '@/features/recipes/recipes.types';

/**
 * Plain-text recipe formatting for "Copy recipe". The output is pasted into
 * chat apps (Signal, iMessage) that don't render Markdown, so it uses only
 * line breaks and an uppercase title, and ends with a full https:// URL so
 * the receiving app auto-links it.
 */

const FRACTIONS: Record<number, string> = {
  0.25: '¼', 0.33: '⅓', 0.5: '½',
  0.67: '⅔', 0.75: '¾', 1.5: '1½',
  2.5: '2½',
};

export function formatQuantity(qty: number | null, unit: string | null): string {
  if (!qty && !unit) return '';
  if (!qty) return unit ?? '';
  const display = FRACTIONS[qty] ?? qty.toString();
  return unit ? `${display} ${unit}` : display;
}

export function recipeUrl(slug: string, origin: string): string {
  return `${origin.replace(/\/$/, '')}/recipes/${slug}`;
}

function joinLine(...parts: (string | null | undefined)[]): string {
  return parts.map(p => p?.trim()).filter(Boolean).join(' ');
}

function libraryIngredientLine(ing: RecipeIngredient): string {
  const notes = ing.notes?.trim() ? `(${ing.notes.trim()})` : null;
  const optional = ing.optional ? '(optional)' : null;
  return joinLine(formatQuantity(ing.quantity, ing.unit), ing.ingredient_name, notes, optional);
}

/** Assemble blocks separated by blank lines, skipping empty ones. */
function blocks(...parts: (string | string[] | null | undefined)[]): string {
  return parts
    .map(p => (Array.isArray(p) ? p.filter(Boolean).join('\n') : p?.trim() ?? ''))
    .filter(Boolean)
    .join('\n\n');
}

/** A library recipe (canonical or custom). */
export function formatRecipeText(recipe: RecipeWithIngredients, url?: string): string {
  const ingredients = recipe.recipe_ingredients ?? [];
  const main = ingredients.filter(i => i.role !== 'garnish');
  const garnishItems = ingredients.filter(i => i.role === 'garnish');
  const garnish = garnishItems.length > 0
    ? garnishItems.map(g => joinLine(g.ingredient_name, g.notes?.trim() ? `(${g.notes.trim()})` : null)).join(', ')
    : recipe.garnish?.trim();

  const subtitle = [METHOD_LABELS[recipe.method], recipe.glassware?.trim()].filter(Boolean).join(' · ');

  return blocks(
    [recipe.name.toUpperCase(), subtitle],
    main.map(libraryIngredientLine),
    garnish ? `Garnish: ${garnish}` : null,
    recipe.description,
    url,
  );
}

/** A recipe adapted to the user's bottles (Adapt to My Bar, Tonight). */
export function formatAdaptedRecipeText(name: string, recipe: AdaptedRecipe, url?: string): string {
  const lines = (recipe.ingredients ?? []).map(ing =>
    joinLine(
      ing.quantity,
      ing.unit,
      ing.bottle_from_inventory ?? ing.ingredient_name,
      ing.notes?.trim() ? `(${ing.notes.trim()})` : null,
    ),
  );

  return blocks(
    [name.toUpperCase(), recipe.glassware],
    lines,
    recipe.method,
    recipe.garnish?.trim() ? `Garnish: ${recipe.garnish.trim()}` : null,
    recipe.proof_warning ? `Note: ${recipe.proof_warning}` : null,
    url,
  );
}
