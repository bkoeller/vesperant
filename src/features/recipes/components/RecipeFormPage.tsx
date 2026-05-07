import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, Plus, Trash2, GripVertical } from 'lucide-react';
import { useRecipeBySlug, useCreateRecipe, useUpdateRecipe } from '../hooks/useRecipes';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { FILTER_TAGS, METHOD_LABELS, METHOD_ORDER, ROLE_LABELS, ROLE_ORDER, UNIT_OPTIONS } from '../recipes.types';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/features/inventory/inventory.types';
import type { CocktailMethod, IngredientRole, SpiritCategory } from '@/types/database.types';
import type { RecipeIngredientInput } from '../recipes.service';

interface IngredientRow extends RecipeIngredientInput {
  key: string;
}

const newRow = (): IngredientRow => ({
  key: crypto.randomUUID(),
  ingredient_name: '',
  ingredient_category: 'other',
  quantity: null,
  unit: 'oz',
  role: 'base',
  optional: false,
  notes: null,
});

interface Props {
  mode: 'new' | 'edit';
}

export function RecipeFormPage({ mode }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const params = useParams({ strict: false }) as { slug?: string };
  const editSlug = mode === 'edit' ? params.slug : undefined;
  const { data: existing, isLoading: loadingExisting } = useRecipeBySlug(editSlug ?? '');
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();

  const [name, setName] = useState('');
  const [aliases, setAliases] = useState('');
  const [description, setDescription] = useState('');
  const [history, setHistory] = useState('');
  const [method, setMethod] = useState<CocktailMethod>('stir');
  const [glassware, setGlassware] = useState('');
  const [garnish, setGarnish] = useState('');
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [customTags, setCustomTags] = useState('');
  const [rows, setRows] = useState<IngredientRow[]>([newRow()]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Hydrate when editing
  useEffect(() => {
    if (mode !== 'edit' || !existing) return;
    setName(existing.name);
    setAliases(existing.aliases?.join(', ') ?? '');
    setDescription(existing.description ?? '');
    setHistory(existing.history ?? '');
    setMethod(existing.method);
    setGlassware(existing.glassware ?? '');
    setGarnish(existing.garnish ?? '');
    const known = new Set<string>(FILTER_TAGS.map(t => t.value));
    const knownSelected = new Set<string>();
    const customs: string[] = [];
    for (const t of existing.tags ?? []) {
      if (known.has(t)) knownSelected.add(t);
      else customs.push(t);
    }
    setTags(knownSelected);
    setCustomTags(customs.join(', '));
    setRows(
      (existing.recipe_ingredients ?? []).map(ing => ({
        key: ing.id,
        ingredient_name: ing.ingredient_name,
        ingredient_category: ing.ingredient_category,
        quantity: ing.quantity,
        unit: ing.unit,
        role: ing.role,
        optional: ing.optional,
        notes: ing.notes,
      })),
    );
  }, [mode, existing]);

  const ownsRecipe = mode === 'new' || (existing?.user_id != null && existing.user_id === user?.id);
  const canSubmit = useMemo(
    () => name.trim().length > 0 && rows.some(r => r.ingredient_name.trim().length > 0),
    [name, rows],
  );

  const toggleTag = (tag: string) => {
    setTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const updateRow = (key: string, patch: Partial<IngredientRow>) => {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  };
  const removeRow = (key: string) => setRows(prev => prev.filter(r => r.key !== key));
  const addRow = () => setRows(prev => [...prev, newRow()]);
  const moveRow = (key: string, dir: -1 | 1) => {
    setRows(prev => {
      const idx = prev.findIndex(r => r.key === key);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    const customList = customTags.split(',').map(t => t.trim()).filter(Boolean);
    const allTags = Array.from(new Set([...Array.from(tags), ...customList]));
    const aliasList = aliases.split(',').map(a => a.trim()).filter(Boolean);
    const ingredients: RecipeIngredientInput[] = rows
      .filter(r => r.ingredient_name.trim())
      .map(r => ({
        ingredient_name: r.ingredient_name.trim(),
        ingredient_category: r.ingredient_category,
        quantity: r.quantity,
        unit: r.unit?.trim() || null,
        role: r.role,
        optional: r.optional,
        notes: r.notes?.trim() || null,
      }));
    const input = {
      name: name.trim(),
      aliases: aliasList,
      description: description.trim() || null,
      history: history.trim() || null,
      method,
      glassware: glassware.trim() || null,
      garnish: garnish.trim() || null,
      tags: allTags,
    };
    try {
      if (mode === 'edit') {
        if (!existing) return;
        const updated = await updateRecipe.mutateAsync({ id: existing.id, input, ingredients });
        navigate({ to: '/recipes/$slug', params: { slug: updated.slug } });
      } else {
        const created = await createRecipe.mutateAsync({ input, ingredients });
        navigate({ to: '/recipes/$slug', params: { slug: created.slug } });
      }
    } catch (e) {
      setSubmitError((e as Error).message);
    }
  };

  if (mode === 'edit' && loadingExisting) {
    return (
      <div className="flex flex-col items-center gap-4 pt-20">
        <div className="h-1 w-16 animate-pulse rounded-full bg-accent-gold-dim" />
      </div>
    );
  }

  if (mode === 'edit' && existing && !ownsRecipe) {
    return (
      <div className="flex flex-col items-center gap-4 pt-12 text-center">
        <p className="text-text-secondary">You can only edit your own recipes.</p>
        <Link to="/recipes/$slug" params={{ slug: existing.slug }} className="text-sm text-accent-gold no-underline hover:text-accent-amber">
          Back to recipe
        </Link>
      </div>
    );
  }

  const submitting = createRecipe.isPending || updateRecipe.isPending;

  return (
    <div className="flex flex-col gap-6 pt-2 pb-12">
      <Link
        to="/recipes"
        className="flex items-center gap-1.5 text-sm text-text-secondary no-underline hover:text-text-primary"
      >
        <ArrowLeft size={16} />
        Recipes
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight">
        {mode === 'edit' ? 'Edit Recipe' : 'New Recipe'}
      </h1>

      {/* Basics */}
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">Name *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Penicillin"
            className="w-full rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow focus:ring-accent-gold-dim"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">Also known as (comma-separated)</label>
          <input
            value={aliases}
            onChange={e => setAliases(e.target.value)}
            placeholder="e.g. Penny, Smoky Lemon"
            className="w-full rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow focus:ring-accent-gold-dim"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="One or two sentences about the drink"
            className="w-full resize-none rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow focus:ring-accent-gold-dim"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Method *</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value as CocktailMethod)}
              className="w-full rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow focus:ring-accent-gold-dim"
            >
              {METHOD_ORDER.map(m => (
                <option key={m} value={m}>{METHOD_LABELS[m]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Glassware</label>
            <input
              value={glassware}
              onChange={e => setGlassware(e.target.value)}
              placeholder="e.g. Coupe"
              className="w-full rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow focus:ring-accent-gold-dim"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">Garnish</label>
          <input
            value={garnish}
            onChange={e => setGarnish(e.target.value)}
            placeholder="e.g. Candied ginger and lemon twist"
            className="w-full rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow focus:ring-accent-gold-dim"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-text-secondary">Tags</label>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_TAGS.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => toggleTag(t.value)}
                className={`rounded-pill px-2.5 py-1 text-xs font-medium transition-colors ${
                  tags.has(t.value)
                    ? 'bg-accent-gold text-bg-base'
                    : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            value={customTags}
            onChange={e => setCustomTags(e.target.value)}
            placeholder="Custom tags, comma-separated"
            className="mt-2 w-full rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow focus:ring-accent-gold-dim"
          />
        </div>
      </div>

      {/* Ingredients */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ingredients</h2>
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1 rounded-button bg-bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-hover"
          >
            <Plus size={14} />
            Add
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {rows.map((row, i) => (
            <div key={row.key} className="rounded-card bg-bg-surface p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveRow(row.key, -1)}
                    disabled={i === 0}
                    className="rounded p-1 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <GripVertical size={14} />
                  </button>
                  <span className="text-xs text-text-tertiary">#{i + 1}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  disabled={rows.length === 1}
                  className="rounded p-1 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-error disabled:opacity-30"
                  aria-label="Remove ingredient"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <input
                value={row.ingredient_name}
                onChange={e => updateRow(row.key, { ingredient_name: e.target.value })}
                placeholder="Ingredient name (e.g. Blended Scotch)"
                className="mb-2 w-full rounded-button bg-bg-base px-3 py-2 text-sm text-text-primary outline-none ring-1 ring-bg-hover focus:ring-accent-gold-dim"
              />

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  step="0.05"
                  value={row.quantity ?? ''}
                  onChange={e => updateRow(row.key, { quantity: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="Qty"
                  className="rounded-button bg-bg-base px-2.5 py-2 text-sm text-text-primary outline-none ring-1 ring-bg-hover focus:ring-accent-gold-dim"
                />
                <select
                  value={row.unit ?? ''}
                  onChange={e => updateRow(row.key, { unit: e.target.value || null })}
                  className="rounded-button bg-bg-base px-2.5 py-2 text-sm text-text-primary outline-none ring-1 ring-bg-hover focus:ring-accent-gold-dim"
                >
                  {UNIT_OPTIONS.map(u => (
                    <option key={u} value={u}>{u || '(none)'}</option>
                  ))}
                </select>
                <select
                  value={row.role}
                  onChange={e => updateRow(row.key, { role: e.target.value as IngredientRole })}
                  className="rounded-button bg-bg-base px-2.5 py-2 text-sm text-text-primary outline-none ring-1 ring-bg-hover focus:ring-accent-gold-dim"
                >
                  {ROLE_ORDER.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <select
                  value={row.ingredient_category}
                  onChange={e => updateRow(row.key, { ingredient_category: e.target.value as SpiritCategory })}
                  className="rounded-button bg-bg-base px-2.5 py-2 text-xs text-text-primary outline-none ring-1 ring-bg-hover focus:ring-accent-gold-dim"
                >
                  {CATEGORY_ORDER.map(c => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 px-2 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={row.optional}
                    onChange={e => updateRow(row.key, { optional: e.target.checked })}
                    className="h-4 w-4 rounded border-bg-hover bg-bg-base accent-accent-gold"
                  />
                  Optional
                </label>
              </div>

              <input
                value={row.notes ?? ''}
                onChange={e => updateRow(row.key, { notes: e.target.value })}
                placeholder="Notes (e.g. fresh-squeezed)"
                className="mt-2 w-full rounded-button bg-bg-base px-3 py-2 text-xs text-text-primary outline-none ring-1 ring-bg-hover placeholder:text-text-tertiary focus:ring-accent-gold-dim"
              />
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">History (optional)</label>
        <textarea
          value={history}
          onChange={e => setHistory(e.target.value)}
          rows={3}
          placeholder="Origin, lore, or context"
          className="w-full resize-none rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow focus:ring-accent-gold-dim"
        />
      </div>

      {submitError && (
        <div className="rounded-card bg-error/10 p-3">
          <p className="text-sm text-error">{submitError}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Link
          to="/recipes"
          className="flex-1 rounded-button bg-bg-surface py-3 text-center text-sm font-medium text-text-secondary no-underline transition-colors hover:bg-bg-hover"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="flex-1 rounded-button bg-accent-gold py-3 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber disabled:opacity-50"
        >
          {submitting ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create Recipe'}
        </button>
      </div>
    </div>
  );
}
