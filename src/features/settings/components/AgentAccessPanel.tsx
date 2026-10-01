import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, KeyRound, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { CopyButton } from '@/components/ui/CopyButton';
import { claudeMcpAddCommand, generateApiToken, hashApiToken, tokenDisplayPrefix } from '@/lib/api-tokens';
import type { ApiToken } from '@/types/database.types';

// Manual Database type doesn't expose per-table schemas — cast to escape `never`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const apiTokens = () => supabase.from('api_tokens') as any;

const QUERY_KEY = ['api_tokens'];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

export function AgentAccessPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  // The plaintext of a just-created token. Shown once, held only in memory.
  const [created, setCreated] = useState<{ name: string; token: string } | null>(null);

  const { data: tokens, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<ApiToken[]> => {
      const { data, error: e } = await apiTokens()
        .select('id, user_id, name, token_prefix, created_at, last_used_at')
        .order('created_at', { ascending: false });
      if (e) throw e;
      return (data ?? []) as ApiToken[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (tokenName: string) => {
      if (!user) throw new Error('Not signed in');
      const token = generateApiToken();
      const { error: e } = await apiTokens().insert({
        user_id: user.id,
        name: tokenName,
        token_hash: await hashApiToken(token),
        token_prefix: tokenDisplayPrefix(token),
      });
      if (e) throw e;
      return { name: tokenName, token };
    },
    onSuccess: result => {
      setCreated(result);
      setName('');
      setError(null);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => setError(e.message),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: e } = await apiTokens().delete().eq('id', id);
      if (e) throw e;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const handleCreate = () => {
    const tokenName = name.trim();
    if (!tokenName) return;
    createMutation.mutate(tokenName.slice(0, 60));
  };

  return (
    <div className="rounded-card bg-bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Bot size={16} className="text-accent-gold" />
        <h2 className="text-lg">Agent access</h2>
      </div>
      <p className="mb-4 text-sm text-text-secondary">
        Let an AI agent like Claude Code read your bottles, recipes, and history. Tokens are read-only and
        only ever see your own data.
      </p>

      {created ? (
        <div className="mb-4 flex flex-col gap-3 rounded-button bg-accent-gold/5 p-3 ring-1 ring-accent-gold-dim/40">
          <p className="text-sm text-text-primary">
            <span className="font-medium">{created.name}</span> is ready. Copy it now; it won't be shown again.
          </p>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-text-tertiary">Token</span>
              <CopyButton variant="text" label="Copy token" getText={() => created.token} />
            </div>
            <code className="block break-all rounded-button bg-bg-base px-3 py-2 font-mono text-xs text-text-primary">
              {created.token}
            </code>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-text-tertiary">Connect Claude Code</span>
              <CopyButton
                variant="text"
                label="Copy command"
                getText={() => claudeMcpAddCommand(window.location.origin, created.token)}
              />
            </div>
            <code className="block break-all rounded-button bg-bg-base px-3 py-2 font-mono text-xs text-text-secondary">
              {claudeMcpAddCommand(window.location.origin, created.token)}
            </code>
          </div>
          <button
            onClick={() => setCreated(null)}
            className="self-end text-xs font-medium text-text-secondary hover:text-text-primary"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="mb-4 flex flex-col gap-2">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            maxLength={60}
            placeholder="Token name — e.g. My laptop"
            className="rounded-button bg-bg-elevated px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover placeholder:text-text-tertiary focus:ring-accent-gold-dim"
          />
          <button
            onClick={handleCreate}
            disabled={createMutation.isPending || !name.trim()}
            className="flex items-center justify-center gap-1.5 rounded-button bg-accent-gold py-2.5 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber disabled:opacity-50"
          >
            <KeyRound size={14} />
            {createMutation.isPending ? 'Creating...' : 'Create token'}
          </button>
          {error && <p className="text-xs text-error">{error}</p>}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-text-tertiary">Loading...</p>
      ) : tokens && tokens.length > 0 ? (
        <ul className="flex flex-col divide-y divide-bg-hover">
          {tokens.map(t => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text-primary">{t.name}</p>
                <p className="text-xs text-text-tertiary">
                  <span className="font-mono">{t.token_prefix}…</span>
                  {' · '}Created {formatDate(t.created_at)}
                  {' · '}{t.last_used_at ? `Last used ${formatDate(t.last_used_at)}` : 'Never used'}
                </p>
              </div>
              <button
                onClick={() => {
                  if (confirm(`Revoke "${t.name}"? Agents using it will lose access immediately.`)) {
                    revokeMutation.mutate(t.id);
                  }
                }}
                disabled={revokeMutation.isPending}
                className="flex h-8 w-8 items-center justify-center rounded-button text-text-tertiary transition-colors hover:bg-bg-hover hover:text-error disabled:opacity-50"
                aria-label={`Revoke ${t.name}`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-tertiary">No tokens yet.</p>
      )}
    </div>
  );
}
