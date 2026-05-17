import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface DryRunResult {
  dryRun: true;
  candidates: string[];
  candidateCount: number;
  offLibraryTotal: number;
}

interface PromoteResult {
  dryRun: false;
  candidates: number;
  promoted: number;
  excluded: { candidate_name: string; reason: string }[];
  failures: { name: string; error: string }[];
}

type Result = DryRunResult | PromoteResult | { message: string };

async function callPromote(dryRun: boolean): Promise<Result> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');

  const res = await fetch('/api/promote-recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ dryRun }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Promotion failed');
  }
  return res.json();
}

export function RecipePromotionPanel() {
  const [busy, setBusy] = useState<'preview' | 'run' | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handle = async (dryRun: boolean) => {
    setBusy(dryRun ? 'preview' : 'run');
    setError(null);
    setResult(null);
    try {
      setResult(await callPromote(dryRun));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-card bg-bg-surface p-4">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={16} className="text-accent-gold" />
        <h2 className="text-lg">Promote Suggestions to Library</h2>
      </div>
      <p className="mb-3 text-sm text-text-secondary">
        Scans the history of Tonight suggestions for cocktails not yet in the
        canonical recipe library, has Claude canonicalize them, and adds them
        as canonical recipes. Runs automatically every Monday at noon UTC; you
        can also trigger it here.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => handle(true)}
          disabled={busy !== null}
          className="rounded-button bg-bg-hover px-3 py-2 text-sm text-text-primary transition-colors hover:bg-bg-base disabled:opacity-50"
        >
          {busy === 'preview' ? 'Scanning...' : 'Preview candidates'}
        </button>
        <button
          onClick={() => handle(false)}
          disabled={busy !== null}
          className="rounded-button bg-accent-gold px-3 py-2 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber disabled:opacity-50"
        >
          {busy === 'run' ? 'Promoting...' : 'Run promotion now'}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-error">{error}</p>
      )}

      {result && 'message' in result && (
        <p className="mt-3 text-sm text-text-secondary">{result.message}</p>
      )}

      {result && 'dryRun' in result && result.dryRun && (
        <div className="mt-3 text-sm">
          <p className="text-text-secondary">
            {result.offLibraryTotal} distinct off-library names found; would promote
            the top {result.candidateCount} this run:
          </p>
          <ul className="mt-2 max-h-60 overflow-y-auto text-text-primary">
            {result.candidates.map(c => (
              <li key={c} className="py-0.5">· {c}</li>
            ))}
          </ul>
        </div>
      )}

      {result && 'dryRun' in result && !result.dryRun && (
        <div className="mt-3 text-sm text-text-secondary">
          <p>
            Promoted <strong className="text-text-primary">{result.promoted}</strong> of {result.candidates} candidates.
          </p>
          {result.excluded.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-text-tertiary">
                {result.excluded.length} excluded
              </summary>
              <ul className="mt-1 max-h-40 overflow-y-auto text-xs">
                {result.excluded.map((e, i) => (
                  <li key={i} className="py-0.5">{e.candidate_name} — {e.reason}</li>
                ))}
              </ul>
            </details>
          )}
          {result.failures.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-error">
                {result.failures.length} failures
              </summary>
              <ul className="mt-1 max-h-40 overflow-y-auto text-xs">
                {result.failures.map((f, i) => (
                  <li key={i} className="py-0.5">{f.name} — {f.error}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
