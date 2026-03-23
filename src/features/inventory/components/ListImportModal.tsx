import { useState } from 'react';
import { X, Check, Loader2, AlertTriangle } from 'lucide-react';
import { callClaude } from '@/lib/claude';
import { buildListImportSystemPrompt, buildListImportUserPrompt } from '@/lib/prompts';
import type { SpiritCategory, PriceTier } from '@/types/database.types';
import { CATEGORY_LABELS } from '../inventory.types';

interface IdentifiedBottle {
  name: string;
  brand: string | null;
  category: SpiritCategory;
  subcategory: string | null;
  spirit_type: string | null;
  abv: number | null;
  price_tier: PriceTier | null;
  tags: string[];
  selected: boolean;
}

interface ListImportModalProps {
  onImport: (bottles: Omit<IdentifiedBottle, 'selected'>[]) => Promise<void> | void;
  onClose: () => void;
}

type Phase = 'input' | 'analyzing' | 'review';

const VALID_CATEGORIES = new Set<string>([
  'whisky', 'gin', 'vodka', 'rum', 'tequila', 'mezcal', 'brandy', 'cognac',
  'liqueur', 'amaro', 'vermouth', 'bitters', 'syrup', 'mixer', 'garnish',
  'wine', 'beer', 'other',
]);

const VALID_TIERS = new Set<string>(['budget', 'standard', 'premium', 'luxury']);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseBottleResponse(raw: string): IdentifiedBottle[] {
  let jsonStr = raw.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  const parsed = JSON.parse(jsonStr);

  const arr = Array.isArray(parsed)
    ? parsed
    : parsed.bottles && Array.isArray(parsed.bottles)
      ? parsed.bottles
      : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return arr.map((b: any) => ({
    name: b.name ?? 'Unknown',
    brand: b.brand ?? null,
    category: VALID_CATEGORIES.has(b.category) ? b.category : 'other',
    subcategory: b.subcategory ?? null,
    spirit_type: b.spirit_type ?? null,
    abv: typeof b.abv === 'number' ? b.abv : null,
    price_tier: VALID_TIERS.has(b.price_tier) ? b.price_tier : null,
    tags: Array.isArray(b.tags) ? b.tags : [],
    selected: true,
  }));
}

export function ListImportModal({ onImport, onClose }: ListImportModalProps) {
  const [phase, setPhase] = useState<Phase>('input');
  const [text, setText] = useState('');
  const [bottles, setBottles] = useState<IdentifiedBottle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleAnalyze = async () => {
    if (!text.trim()) return;

    setPhase('analyzing');
    setError(null);

    try {
      const systemPrompt = buildListImportSystemPrompt();
      const userPrompt = buildListImportUserPrompt(text);
      const raw = await callClaude(systemPrompt, userPrompt);
      const identified = parseBottleResponse(raw);

      if (identified.length === 0) {
        setError('No bottles were identified in the text. Try a different format.');
        setPhase('input');
        return;
      }

      setBottles(identified);
      setPhase('review');
    } catch (err) {
      setError((err as Error).message);
      setPhase('input');
    }
  };

  const toggleBottle = (index: number) => {
    setBottles(prev => prev.map((b, i) => i === index ? { ...b, selected: !b.selected } : b));
  };

  const toggleAll = () => {
    const allSelected = bottles.every(b => b.selected);
    setBottles(prev => prev.map(b => ({ ...b, selected: !allSelected })));
  };

  const handleImport = async () => {
    const selected = bottles
      .filter(b => b.selected)
      .map(({ selected: _, ...rest }) => rest);
    if (selected.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      await onImport(selected);
    } catch (err) {
      setError(`Import failed: ${(err as Error).message}`);
      setImporting(false);
    }
  };

  const selectedCount = bottles.filter(b => b.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-bg-elevated p-6 sm:rounded-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">
            {phase === 'input' && 'Import from List'}
            {phase === 'analyzing' && 'Analyzing...'}
            {phase === 'review' && 'Review Bottles'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-button p-2 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-card bg-error/10 p-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-error" />
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {/* INPUT PHASE */}
        {phase === 'input' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary">
              Paste or type a list of bottles. Any format works — bullet points, comma-separated, one per line, or even a messy notes dump.
            </p>

            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={10}
              placeholder={"Ardbeg Corryvreckan\nBotanist Gin\nCampari\nDolin Dry Vermouth\nAngostura Bitters\n..."}
              className="w-full resize-none rounded-card bg-bg-surface px-3 py-3 text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow placeholder:text-text-tertiary focus:ring-accent-gold-dim"
            />

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-button bg-bg-surface py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover"
              >
                Cancel
              </button>
              <button
                onClick={handleAnalyze}
                disabled={!text.trim()}
                className="flex-1 rounded-button bg-accent-gold py-2.5 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber disabled:opacity-50"
              >
                Parse List
              </button>
            </div>
          </div>
        )}

        {/* ANALYZING PHASE */}
        {phase === 'analyzing' && (
          <div className="flex flex-col items-center gap-6 py-12">
            <Loader2 size={32} className="animate-spin text-accent-gold" />
            <div className="text-center">
              <p className="text-sm text-text-secondary">Parsing your bottle list...</p>
              <p className="mt-1 text-xs text-text-tertiary">Identifying brands, categories, and details</p>
            </div>
          </div>
        )}

        {/* REVIEW PHASE */}
        {phase === 'review' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                Found {bottles.length} {bottles.length === 1 ? 'bottle' : 'bottles'}. Uncheck any that are wrong.
              </p>
              <button
                onClick={toggleAll}
                className="text-xs text-accent-gold hover:text-accent-amber"
              >
                {bottles.every(b => b.selected) ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {bottles.map((bottle, i) => (
                <button
                  key={i}
                  onClick={() => toggleBottle(i)}
                  className={`flex items-start gap-3 rounded-card p-3 text-left transition-colors ${
                    bottle.selected
                      ? 'bg-bg-surface ring-1 ring-accent-gold-dim'
                      : 'bg-bg-surface/50 opacity-50'
                  }`}
                >
                  <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    bottle.selected
                      ? 'border-accent-gold bg-accent-gold'
                      : 'border-text-tertiary'
                  }`}>
                    {bottle.selected && <Check size={12} className="text-bg-base" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-text-primary truncate block">{bottle.name}</span>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-tertiary">
                      <span>{CATEGORY_LABELS[bottle.category] ?? bottle.category}</span>
                      {bottle.subcategory && <span>· {bottle.subcategory}</span>}
                      {bottle.abv && <span>· {bottle.abv}%</span>}
                      {bottle.price_tier && <span>· {bottle.price_tier}</span>}
                    </div>
                    {bottle.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {bottle.tags.map(tag => (
                          <span key={tag} className="rounded-full bg-bg-hover px-1.5 py-0.5 text-[10px] text-text-tertiary">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setPhase('input'); setBottles([]); }}
                className="flex-1 rounded-button bg-bg-surface py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover"
              >
                Edit List
              </button>
              <button
                onClick={handleImport}
                disabled={selectedCount === 0 || importing}
                className="flex-1 rounded-button bg-accent-gold py-2.5 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber disabled:opacity-50"
              >
                {importing ? 'Adding...' : `Add ${selectedCount} ${selectedCount === 1 ? 'Bottle' : 'Bottles'}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
