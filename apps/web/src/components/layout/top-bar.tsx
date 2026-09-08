import { Sun, Moon, Menu } from './icons';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { useAuth } from '../../hooks/use-auth';
import { useUiStore } from '../../stores/ui-store';

export function TopBar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, navCollapsed, setNavCollapsed } = useUiStore();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-3">
        <button
          aria-label="Toggle navigation"
          className="rounded-md p-2 hover:bg-muted md:hidden"
          onClick={() => setNavCollapsed(!navCollapsed)}
        >
          <Menu />
        </button>
        <span className="font-semibold">IT Support Portal</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2" aria-label="Toggle dark mode">
          <Sun className="h-4 w-4" />
          <Switch
            checked={theme === 'dark'}
            onCheckedChange={toggleTheme}
            aria-label="Toggle dark mode"
          />
          <Moon className="h-4 w-4" />
        </div>
        {user && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {user.name} · {user.role.name}
            </span>
            <Button variant="outline" onClick={() => logout.mutate()}>
              Sign out
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
