import { Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useProfile } from '@/features/auth/hooks/useProfile';
import { AllowedUsersPanel } from './AllowedUsersPanel';

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const isAdmin = profile?.is_admin === true;

  return (
    <div className="flex flex-col gap-8 pt-4">
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-text-secondary" />
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      </div>
      <div className="flex flex-col gap-4">
        {/* Allowed Users — admin only */}
        {isAdmin && <AllowedUsersPanel />}

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
              <p className="text-xs text-text-tertiary">
                Signed in with Google{isAdmin ? ' · Admin' : ''}
              </p>
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
