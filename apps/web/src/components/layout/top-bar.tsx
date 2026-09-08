import { Bell, LogOut, Menu, Moon, Plus, Sun } from './icons';
import { IconButton } from '../ui/icon-button';
import { Avatar } from '../ui/avatar';
import { DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator } from '../ui/dropdown-menu';
import { useAuth } from '../../hooks/use-auth';
import { useUiStore } from '../../stores/ui-store';

export function TopBar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, setMobileNavOpen } = useUiStore();
  const isDark = theme === 'dark';

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-3 sm:px-4">
      <IconButton
        label="Open navigation"
        className="md:hidden"
        onClick={() => setMobileNavOpen(true)}
      >
        <Menu />
      </IconButton>

      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
        >
          IT
        </span>
        <span className="truncate font-semibold">IT Support Portal</span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        {/* The create menu is the shell's slot for module actions. It stays visible with a
            single disabled entry so the affordance is where users will expect it once
            ticketing lands, rather than appearing out of nowhere. */}
        <DropdownMenu
          label="Create"
          trigger={
            <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <Plus />
            </span>
          }
          triggerClassName="hover:bg-transparent hover:opacity-90"
        >
          {() => (
            <>
              <DropdownLabel>Create new</DropdownLabel>
              <DropdownItem disabled>Ticket — coming in Phase 1</DropdownItem>
            </>
          )}
        </DropdownMenu>

        <IconButton label="Notifications" disabled title="Notifications — coming in a later phase">
          <Bell />
        </IconButton>

        <IconButton
          label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={toggleTheme}
        >
          {isDark ? <Sun /> : <Moon />}
        </IconButton>

        {user && (
          <DropdownMenu
            label="Account menu"
            trigger={<Avatar name={user.name} className="m-0.5" />}
            triggerClassName="rounded-full p-0 hover:bg-transparent hover:opacity-90"
          >
            {(close) => (
              <>
                <div className="px-2.5 py-2">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{user.role.name}</p>
                </div>
                <DropdownSeparator />
                <DropdownItem
                  tone="danger"
                  icon={<LogOut className="h-4 w-4" />}
                  onSelect={() => {
                    close(false);
                    logout.mutate();
                  }}
                >
                  Sign out
                </DropdownItem>
              </>
            )}
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
