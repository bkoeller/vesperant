import { useState, useMemo } from 'react';
import { Plus, Search, Wine, ChevronDown, ChevronRight, Upload } from 'lucide-react';
import type { Bottle, SpiritCategory, PriceTier } from '@/types/database.types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useBottles, useCreateBottle, useUpdateBottle, useDeactivateBottle, useDeleteBottle } from '../hooks/useBottles';
import { useSeedInventory } from '../hooks/useSeedInventory';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../inventory.types';
import { BottleCard } from './BottleCard';
import { BottleForm } from './BottleForm';

export function InventoryPage() {
  const { user } = useAuth();
  const { data: bottles, isLoading } = useBottles();
  const createBottle = useCreateBottle();
  const updateBottle = useUpdateBottle();
  const deactivateBottle = useDeactivateBottle();
  const deleteBottle = useDeleteBottle();
  const seedInventory = useSeedInventory();

  const [showForm, setShowForm] = useState(false);
  const [editingBottle, setEditingBottle] = useState<Bottle | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    if (!bottles) return [];
    const filtered = searchQuery
      ? bottles.filter(b =>
          b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.subcategory?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : bottles;

    const groups: { category: SpiritCategory; label: string; bottles: Bottle[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const catBottles = filtered.filter(b => b.category === cat);
      if (catBottles.length > 0) {
        groups.push({ category: cat, label: CATEGORY_LABELS[cat], bottles: catBottles });
      }
    }
    return groups;
  }, [bottles, searchQuery]);

  const totalCount = bottles?.length ?? 0;

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleCreate = (data: {
    name: string; brand: string | null; category: SpiritCategory;
    subcategory: string | null; spirit_type: string | null;
    abv: number | null; price_tier: PriceTier | null;
    is_premium: boolean; tags: string[]; notes: string | null;
  }) => {
    if (!user) return;
    createBottle.mutate(
      { ...data, user_id: user.id, active: true, proof: data.abv ? data.abv * 2 : null },
      { onSuccess: () => setShowForm(false) }
    );
  };

  const handleUpdate = (data: {
    name: string; brand: string | null; category: SpiritCategory;
    subcategory: string | null; spirit_type: string | null;
    abv: number | null; price_tier: PriceTier | null;
    is_premium: boolean; tags: string[]; notes: string | null;
  }) => {
    if (!editingBottle) return;
    updateBottle.mutate(
      { id: editingBottle.id, updates: { ...data, proof: data.abv ? data.abv * 2 : null } },
      { onSuccess: () => setEditingBottle(null) }
    );
  };

  const handleDeactivate = (id: string) => {
    if (confirm('Archive this bottle? It will be hidden from your active inventory.')) {
      deactivateBottle.mutate(id);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Permanently delete this bottle?')) {
      deleteBottle.mutate(id);
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
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Inventory</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {totalCount} {totalCount === 1 ? 'bottle' : 'bottles'}
          </p>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search bottles..."
          className="w-full rounded-button bg-bg-surface py-2.5 pl-9 pr-3 text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow placeholder:text-text-tertiary focus:ring-accent-gold-dim"
        />
      </div>

      {grouped.length === 0 && !searchQuery ? (
        <div className="flex flex-col items-center gap-4 pt-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-surface">
            <Wine size={28} className="text-accent-copper" />
          </div>
          <p className="text-text-secondary">Your bar is empty. Add your first bottle.</p>
          <button
            onClick={() => seedInventory.mutate()}
            disabled={seedInventory.isPending}
            className="mt-2 flex items-center gap-2 rounded-button bg-accent-gold px-5 py-2.5 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber disabled:opacity-50"
          >
            <Upload size={16} />
            {seedInventory.isPending ? 'Importing...' : 'Import Koeller Bar'}
          </button>
          {seedInventory.isError && (
            <p className="text-xs text-error">Import failed. Try again.</p>
          )}
        </div>
      ) : grouped.length === 0 ? (
        <p className="pt-4 text-center text-sm text-text-tertiary">No bottles match "{searchQuery}"</p>
      ) : (
        <div className="flex flex-col gap-3">
          {grouped.map(({ category, label, bottles: catBottles }) => {
            const isCollapsed = collapsedCategories.has(category);
            return (
              <div key={category}>
                <button
                  onClick={() => toggleCategory(category)}
                  className="mb-2 flex w-full items-center gap-2 text-left"
                >
                  {isCollapsed ? (
                    <ChevronRight size={14} className="text-text-tertiary" />
                  ) : (
                    <ChevronDown size={14} className="text-text-tertiary" />
                  )}
                  <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                    {label}
                  </span>
                  <span className="text-xs text-text-tertiary">{catBottles.length}</span>
                </button>
                {!isCollapsed && (
                  <div className="flex flex-col gap-1.5">
                    {catBottles.map(bottle => (
                      <BottleCard
                        key={bottle.id}
                        bottle={bottle}
                        onEdit={setEditingBottle}
                        onDeactivate={handleDeactivate}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent-gold shadow-elevated transition-colors hover:bg-accent-amber sm:right-[calc(50%-14rem)]"
        aria-label="Add bottle"
      >
        <Plus size={24} className="text-bg-base" />
      </button>

      {showForm && (
        <BottleForm
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}

      {editingBottle && (
        <BottleForm
          bottle={editingBottle}
          onSubmit={handleUpdate}
          onClose={() => setEditingBottle(null)}
        />
      )}
    </div>
  );
}
