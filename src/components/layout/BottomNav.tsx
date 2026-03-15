import { Link, useMatchRoute } from '@tanstack/react-router';
import { Sparkles, Wine, BookOpen, Clock } from 'lucide-react';

const navItems = [
  { to: '/tonight', label: 'Tonight', icon: Sparkles },
  { to: '/inventory', label: 'Inventory', icon: Wine },
  { to: '/recipes', label: 'Recipes', icon: BookOpen },
  { to: '/history', label: 'History', icon: Clock },
] as const;

export function BottomNav() {
  const matchRoute = useMatchRoute();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-bg-hover bg-bg-base/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-around">
        {navItems.map(({ to, label, icon: Icon }) => {
          const isActive = matchRoute({ to, fuzzy: true });
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium no-underline transition-colors ${
                isActive
                  ? 'text-accent-gold'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
