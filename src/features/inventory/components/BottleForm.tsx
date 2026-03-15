import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import type { Bottle, SpiritCategory, PriceTier } from '@/types/database.types';
import { CATEGORY_LABELS, CATEGORY_ORDER, PRICE_TIER_OPTIONS } from '../inventory.types';

interface BottleFormData {
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  spirit_type: string;
  abv: string;
  price_tier: string;
  tags: string;
  notes: string;
}

interface BottleFormProps {
  bottle?: Bottle | null;
  onSubmit: (data: {
    name: string;
    brand: string | null;
    category: SpiritCategory;
    subcategory: string | null;
    spirit_type: string | null;
    abv: number | null;
    price_tier: PriceTier | null;
    is_premium: boolean;
    tags: string[];
    notes: string | null;
  }) => void;
  onClose: () => void;
}

export function BottleForm({ bottle, onSubmit, onClose }: BottleFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BottleFormData>({
    defaultValues: {
      name: bottle?.name ?? '',
      brand: bottle?.brand ?? '',
      category: bottle?.category ?? 'whisky',
      subcategory: bottle?.subcategory ?? '',
      spirit_type: bottle?.spirit_type ?? '',
      abv: bottle?.abv?.toString() ?? '',
      price_tier: bottle?.price_tier ?? '',
      tags: bottle?.tags?.join(', ') ?? '',
      notes: bottle?.notes ?? '',
    },
  });

  const onFormSubmit = (data: BottleFormData) => {
    if (!data.name.trim()) return;
    const priceTier = data.price_tier ? data.price_tier as PriceTier : null;
    onSubmit({
      name: data.name.trim(),
      brand: data.brand || null,
      category: data.category as SpiritCategory,
      subcategory: data.subcategory || null,
      spirit_type: data.spirit_type || null,
      abv: data.abv ? Number(data.abv) : null,
      price_tier: priceTier,
      is_premium: priceTier === 'premium' || priceTier === 'luxury',
      tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      notes: data.notes || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-bg-elevated p-6 sm:rounded-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">
            {bottle ? 'Edit Bottle' : 'Add Bottle'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-button p-2 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onFormSubmit)} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Name *</label>
            <input
              {...register('name', { required: true })}
              className="w-full rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow focus:ring-accent-gold-dim"
              placeholder="e.g. Ardbeg Corryvreckan"
            />
            {errors.name && <p className="mt-1 text-xs text-error">Name is required</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Category *</label>
              <select
                {...register('category')}
                className="w-full rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow focus:ring-accent-gold-dim"
              >
                {CATEGORY_ORDER.map(cat => (
                  <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">ABV %</label>
              <input
                {...register('abv')}
                type="number"
                step="0.1"
                className="w-full rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow focus:ring-accent-gold-dim"
                placeholder="e.g. 57.1"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Brand</label>
            <input
              {...register('brand')}
              className="w-full rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow focus:ring-accent-gold-dim"
              placeholder="e.g. Ardbeg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Subcategory</label>
              <input
                {...register('subcategory')}
                className="w-full rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow focus:ring-accent-gold-dim"
                placeholder="e.g. Islay Single Malt"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Price Tier</label>
              <select
                {...register('price_tier')}
                className="w-full rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow focus:ring-accent-gold-dim"
              >
                <option value="">--</option>
                {PRICE_TIER_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Tags (comma-separated)</label>
            <input
              {...register('tags')}
              className="w-full rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow focus:ring-accent-gold-dim"
              placeholder="e.g. peated, cask strength, Islay"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Notes</label>
            <textarea
              {...register('notes')}
              rows={2}
              className="w-full resize-none rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow focus:ring-accent-gold-dim"
              placeholder="Any personal notes about this bottle..."
            />
          </div>

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-button bg-bg-surface py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-button bg-accent-gold py-2.5 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber disabled:opacity-50"
            >
              {bottle ? 'Save Changes' : 'Add Bottle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
