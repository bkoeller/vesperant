import { Link } from '@tanstack/react-router';
import { Settings } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';

export function Header() {
  const { user } = useAuth();
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const initials = (user?.user_metadata?.full_name as string)?.charAt(0)?.toUpperCase() ?? user?.email?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <header className="sticky top-0 z-40 border-b border-bg-hover bg-bg-base/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
        <Link to="/tonight" className="font-serif text-2xl font-semibold tracking-tight text-text-primary no-underline">
          Vesperant
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/settings"
            className="flex items-center gap-2 rounded-button p-1.5 text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
            aria-label="Settings"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="h-7 w-7 rounded-full border border-bg-hover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-surface text-xs font-medium text-text-primary">
                {initials}
              </div>
            )}
            <Settings size={16} />
          </Link>
        </div>
      </div>
    </header>
  );
}
