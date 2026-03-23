import { useState, useRef } from 'react';
import { X, Camera, Check, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { callClaudeWithVision } from '@/lib/claude';
import { buildPhotoImportSystemPrompt, buildPhotoImportUserPrompt } from '@/lib/prompts';
import type { SpiritCategory, PriceTier } from '@/types/database.types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { bottleService } from '../inventory.service';
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
  confidence: 'high' | 'medium' | 'low';
  selected: boolean;
}

interface PhotoImportModalProps {
  onClose: () => void;
}

type Phase = 'capture' | 'analyzing' | 'review' | 'importing' | 'done';

const CONFIDENCE_STYLES = {
  high: 'bg-green-900/30 text-green-400',
  medium: 'bg-yellow-900/30 text-yellow-400',
  low: 'bg-red-900/30 text-red-400',
};

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
    confidence: ['high', 'medium', 'low'].includes(b.confidence) ? b.confidence : 'medium',
    selected: true,
  }));
}

export function PhotoImportModal({ onClose }: PhotoImportModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>('capture');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
  const [bottles, setBottles] = useState<IdentifiedBottle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ added: number; skipped: number }>({ added: 0, skipped: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const type = file.type as 'image/jpeg' | 'image/png' | 'image/webp';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) {
      setError('Please select a JPEG, PNG, or WebP image.');
      return;
    }

    setMediaType(type);
    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(',')[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!imageBase64) return;

    setPhase('analyzing');
    setError(null);

    try {
      const systemPrompt = buildPhotoImportSystemPrompt();
      const userPrompt = buildPhotoImportUserPrompt();
      const raw = await callClaudeWithVision(systemPrompt, imageBase64, mediaType, userPrompt);
      const identified = parseBottleResponse(raw);

      if (identified.length === 0) {
        setError('No bottles were identified in this photo. Try a clearer image with visible labels.');
        setPhase('capture');
        return;
      }

      setBottles(identified);
      setPhase('review');
    } catch (err) {
      setError((err as Error).message);
      setPhase('capture');
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
    if (!user) return;
    const selected = bottles
      .filter(b => b.selected)
      .map(({ confidence: _, selected: __, ...rest }) => rest);
    if (selected.length === 0) return;

    setPhase('importing');
    setError(null);

    // Fetch fresh inventory to check for dupes
    let existingNames: Set<string>;
    try {
      const existing = await bottleService.getActive();
      existingNames = new Set(existing.map(b => b.name.toLowerCase()));
    } catch {
      existingNames = new Set();
    }

    // Deduplicate within batch and against existing inventory
    const seen = new Set<string>();
    const toInsert = selected.filter(b => {
      const key = b.name.toLowerCase();
      if (existingNames.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const skippedCount = selected.length - toInsert.length;
    let addedCount = 0;

    if (toInsert.length > 0) {
      const results = await Promise.allSettled(
        toInsert.map(b =>
          bottleService.create({
            ...b,
            user_id: user.id,
            active: true,
            is_premium: b.price_tier === 'premium' || b.price_tier === 'luxury',
            proof: b.abv ? b.abv * 2 : null,
            notes: null,
          })
        )
      );
      addedCount = results.filter(r => r.status === 'fulfilled').length;
      const failedCount = results.filter(r => r.status === 'rejected').length;
      if (failedCount > 0) {
        setError(`${failedCount} ${failedCount === 1 ? 'bottle' : 'bottles'} failed to save.`);
      }
      queryClient.invalidateQueries({ queryKey: ['bottles', 'active'] });
    }

    setResult({ added: addedCount, skipped: skippedCount });
    setPhase('done');
  };

  const selectedCount = bottles.filter(b => b.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-bg-elevated p-6 sm:rounded-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">
            {phase === 'capture' && 'Import from Photo'}
            {phase === 'analyzing' && 'Analyzing...'}
            {phase === 'review' && 'Review Bottles'}
            {phase === 'importing' && 'Adding...'}
            {phase === 'done' && 'Import Complete'}
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

        {/* CAPTURE PHASE */}
        {phase === 'capture' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary">
              Take a photo of your bar shelf or select one from your gallery. Claude will identify the bottles and add them to your inventory.
            </p>

            {imagePreview ? (
              <div className="relative overflow-hidden rounded-card">
                <img
                  src={imagePreview}
                  alt="Bar shelf preview"
                  className="w-full rounded-card object-cover"
                  style={{ maxHeight: '300px' }}
                />
                <button
                  onClick={() => { setImagePreview(null); setImageBase64(null); }}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-3 rounded-card border-2 border-dashed border-bg-hover py-12 text-text-tertiary transition-colors hover:border-accent-gold-dim hover:text-text-secondary"
              >
                <Camera size={32} />
                <span className="text-sm">Tap to take or select a photo</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
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
                disabled={!imageBase64}
                className="flex-1 rounded-button bg-accent-gold py-2.5 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber disabled:opacity-50"
              >
                Identify Bottles
              </button>
            </div>
          </div>
        )}

        {/* ANALYZING PHASE */}
        {phase === 'analyzing' && (
          <div className="flex flex-col items-center gap-6 py-12">
            <Loader2 size={32} className="animate-spin text-accent-gold" />
            <div className="text-center">
              <p className="text-sm text-text-secondary">Identifying bottles in your photo...</p>
              <p className="mt-1 text-xs text-text-tertiary">This may take a few seconds</p>
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
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">{bottle.name}</span>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${CONFIDENCE_STYLES[bottle.confidence]}`}>
                        {bottle.confidence}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-tertiary">
                      <span>{CATEGORY_LABELS[bottle.category] ?? bottle.category}</span>
                      {bottle.subcategory && <span>· {bottle.subcategory}</span>}
                      {bottle.abv && <span>· {bottle.abv}%</span>}
                      {bottle.price_tier && <span>· {bottle.price_tier}</span>}
                    </div>
                    {bottle.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {bottle.tags.map(tag => (
                          <span key={tag} className="rounded-full bg-bg-hover px-1.5 py-0.5 text-xs text-text-tertiary">
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
                onClick={() => { setPhase('capture'); setBottles([]); }}
                className="flex-1 rounded-button bg-bg-surface py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover"
              >
                Retake
              </button>
              <button
                onClick={handleImport}
                disabled={selectedCount === 0}
                className="flex-1 rounded-button bg-accent-gold py-2.5 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber disabled:opacity-50"
              >
                Add {selectedCount} {selectedCount === 1 ? 'Bottle' : 'Bottles'}
              </button>
            </div>
          </div>
        )}

        {/* IMPORTING PHASE */}
        {phase === 'importing' && (
          <div className="flex flex-col items-center gap-6 py-12">
            <Loader2 size={32} className="animate-spin text-accent-gold" />
            <p className="text-sm text-text-secondary">Adding bottles to your inventory...</p>
          </div>
        )}

        {/* DONE PHASE */}
        {phase === 'done' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle size={40} className="text-success" />
            <div className="text-center">
              {result.added > 0 && (
                <p className="text-sm text-text-primary">
                  Added {result.added} {result.added === 1 ? 'bottle' : 'bottles'} to your inventory.
                </p>
              )}
              {result.skipped > 0 && (
                <p className="mt-1 text-xs text-text-tertiary">
                  {result.skipped} already in inventory, skipped.
                </p>
              )}
              {result.added === 0 && result.skipped === 0 && (
                <p className="text-sm text-text-secondary">No bottles were added.</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="mt-2 rounded-button bg-accent-gold px-8 py-2.5 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
