import { useState } from 'react';
import { Settings, LogOut, Eye, EyeOff, Check, Key } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getClaudeApiKey, setClaudeApiKey, clearClaudeApiKey, hasClaudeApiKey } from '@/lib/claude';

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasKey, setHasKey] = useState(hasClaudeApiKey);
  const [saved, setSaved] = useState(false);

  const handleSaveKey = () => {
    if (!apiKey.trim()) return;
    setClaudeApiKey(apiKey.trim());
    setHasKey(true);
    setSaved(true);
    setApiKey('');
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearKey = () => {
    clearClaudeApiKey();
    setHasKey(false);
    setApiKey('');
  };

  const maskedKey = () => {
    const key = getClaudeApiKey();
    if (!key) return '';
    return key.slice(0, 10) + '...' + key.slice(-4);
  };

  return (
    <div className="flex flex-col gap-8 pt-4">
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-text-secondary" />
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      </div>
      <div className="flex flex-col gap-4">
        {/* Claude API Key */}
        <div className="rounded-card bg-bg-surface p-4">
          <div className="mb-3 flex items-center gap-2">
            <Key size={16} className="text-accent-gold" />
            <h2 className="text-lg">Claude API Key</h2>
          </div>
          {hasKey ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm text-text-secondary">{maskedKey()}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-success">
                    <Check size={12} /> Configured
                  </p>
                </div>
                <button
                  onClick={handleClearKey}
                  className="rounded-button px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-hover hover:text-error"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-text-secondary">
                Required for recipe adaptation and cocktail suggestions.
                Get your key from{' '}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-gold no-underline hover:text-accent-amber"
                >
                  console.anthropic.com
                </a>
              </p>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full rounded-button bg-bg-elevated px-3 py-2.5 pr-10 font-mono text-sm text-text-primary outline-none ring-1 ring-bg-hover transition-shadow placeholder:text-text-tertiary focus:ring-accent-gold-dim"
                />
                <button
                  onClick={() => setShowKey(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-secondary"
                  type="button"
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                onClick={handleSaveKey}
                disabled={!apiKey.trim()}
                className="rounded-button bg-accent-gold py-2.5 text-sm font-medium text-bg-base transition-colors hover:bg-accent-amber disabled:opacity-50"
              >
                {saved ? 'Saved!' : 'Save Key'}
              </button>
            </div>
          )}
        </div>

        {/* Location */}
        <div className="rounded-card bg-bg-surface p-4">
          <h2 className="mb-1 text-lg">Location</h2>
          <p className="text-sm text-text-secondary">For weather-aware recommendations. Coming soon.</p>
        </div>

        {/* Account */}
        <div className="rounded-card bg-bg-surface p-4">
          <h2 className="mb-2 text-lg">Account</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-primary">{user?.email}</p>
              <p className="text-xs text-text-tertiary">Signed in with Google</p>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 rounded-button px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-error"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
