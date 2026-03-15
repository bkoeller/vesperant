import { useState } from 'react';
import { X, Star } from 'lucide-react';

interface LogFormProps {
  recipeName: string;
  onSubmit: (data: { rating: number | null; tasting_notes: string | null; social_context: string | null }) => void;
  onClose: () => void;
  submitting?: boolean;
}

export function LogForm({ recipeName, onSubmit, onClose, submitting }: LogFormProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [social, setSocial] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  const handleQuickLog = () => {
    onSubmit({ rating: null, tasting_notes: null, social_context: null });
  };

  const handleDetailedLog = () => {
    onSubmit({
      rating,
      tasting_notes: notes.trim() || null,
      social_context: social.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-lg rounded-t-2xl bg-bg-elevated p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Log Cocktail</h2>
          <button
            onClick={onClose}
            className="rounded-button p-2 text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </div>

        <p className="mb-5 font-serif text-lg text-accent-gold">{recipeName}</p>

        {!showDetails ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={handleQuickLog}
              disabled={submitting}
              className="rounded-button bg-accent-gold py-3 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber disabled:opacity-50"
            >
              {submitting ? 'Logging...' : 'Log it'}
            </button>
            <button
              onClick={() => setShowDetails(true)}
              className="rounded-button bg-bg-surface py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover"
            >
              Add details
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Star rating */}
            <div>
              <label className="mb-2 block text-xs font-medium text-text-secondary">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setRating(rating === n ? null : n)}
                    className="p-1 transition-colors"
                  >
                    <Star
                      size={24}
                      fill={rating !== null && n <= rating ? '#c9a84c' : 'transparent'}
                      className={rating !== null && n <= rating ? 'text-accent-gold' : 'text-text-tertiary'}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Tasting notes */}
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Tasting notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="How was it? Any tweaks for next time?"
                className="w-full resize-none rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover placeholder:text-text-tertiary focus:ring-accent-gold-dim"
              />
            </div>

            {/* Social context */}
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Social context</label>
              <input
                type="text"
                value={social}
                onChange={e => setSocial(e.target.value)}
                placeholder="Who were you with?"
                className="w-full rounded-button bg-bg-surface px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover placeholder:text-text-tertiary focus:ring-accent-gold-dim"
              />
            </div>

            <div className="mt-1 flex gap-3">
              <button
                onClick={() => setShowDetails(false)}
                className="flex-1 rounded-button bg-bg-surface py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover"
              >
                Back
              </button>
              <button
                onClick={handleDetailedLog}
                disabled={submitting}
                className="flex-1 rounded-button bg-accent-gold py-2.5 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber disabled:opacity-50"
              >
                {submitting ? 'Logging...' : 'Log it'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
