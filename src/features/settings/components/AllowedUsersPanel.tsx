import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AllowedEmail } from '@/types/database.types';

// Manual Database type doesn't expose per-table schemas — cast to escape `never`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const allowed = () => supabase.from('allowed_emails') as any;

const QUERY_KEY = ['allowed_emails'];

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export function AllowedUsersPanel() {
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<AllowedEmail[]> => {
      const { data, error: e } = await allowed()
        .select('email, granted_at, granted_by, notes, is_active')
        .order('granted_at', { ascending: true });
      if (e) throw e;
      return (data ?? []) as AllowedEmail[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (input: { email: string; notes: string | null }) => {
      const { error: e } = await allowed()
        .insert({ email: input.email.toLowerCase(), notes: input.notes });
      if (e) throw e;
    },
    onSuccess: () => {
      setNewEmail('');
      setNewNotes('');
      setError(null);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => setError(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error: e } = await allowed()
        .delete()
        .eq('email', email);
      if (e) throw e;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const handleAdd = () => {
    const email = newEmail.trim();
    if (!isValidEmail(email)) {
      setError('Enter a valid email address');
      return;
    }
    addMutation.mutate({ email, notes: newNotes.trim() || null });
  };

  return (
    <div className="rounded-card bg-bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Users size={16} className="text-accent-gold" />
        <h2 className="text-lg">Allowed Users</h2>
      </div>
      <p className="mb-4 text-sm text-text-secondary">
        Anyone signing in with one of these Gmail addresses can use this instance with your Claude key.
      </p>

      {/* Add form */}
      <div className="mb-4 flex flex-col gap-2">
        <input
          type="email"
          value={newEmail}
          onChange={e => setNewEmail(e.target.value)}
          placeholder="someone@gmail.com"
          className="rounded-button bg-bg-elevated px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover placeholder:text-text-tertiary focus:ring-accent-gold-dim"
        />
        <input
          type="text"
          value={newNotes}
          onChange={e => setNewNotes(e.target.value)}
          placeholder="Notes (optional) — e.g., 'Friend, March 2026'"
          className="rounded-button bg-bg-elevated px-3 py-2.5 text-sm text-text-primary outline-none ring-1 ring-bg-hover placeholder:text-text-tertiary focus:ring-accent-gold-dim"
        />
        <button
          onClick={handleAdd}
          disabled={addMutation.isPending || !newEmail.trim()}
          className="flex items-center justify-center gap-1.5 rounded-button bg-accent-gold py-2.5 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber disabled:opacity-50"
        >
          <UserPlus size={14} />
          {addMutation.isPending ? 'Adding...' : 'Grant Access'}
        </button>
        {error && <p className="text-xs text-error">{error}</p>}
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-text-tertiary">Loading...</p>
      ) : rows && rows.length > 0 ? (
        <ul className="flex flex-col divide-y divide-bg-hover">
          {rows.map(row => (
            <li key={row.email} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text-primary">{row.email}</p>
                <p className="text-xs text-text-tertiary">
                  Granted {new Date(row.granted_at).toLocaleDateString()}
                  {row.notes ? ` — ${row.notes}` : ''}
                </p>
              </div>
              <button
                onClick={() => {
                  if (confirm(`Revoke access for ${row.email}?`)) {
                    removeMutation.mutate(row.email);
                  }
                }}
                disabled={removeMutation.isPending}
                className="flex h-8 w-8 items-center justify-center rounded-button text-text-tertiary transition-colors hover:bg-bg-hover hover:text-error disabled:opacity-50"
                aria-label={`Revoke ${row.email}`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-tertiary">No allowed users yet.</p>
      )}
    </div>
  );
}
