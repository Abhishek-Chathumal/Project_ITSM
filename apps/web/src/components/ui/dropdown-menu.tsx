import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/cn';

interface DropdownMenuProps {
  /** Rendered inside the trigger button. */
  trigger: ReactNode;
  /**
   * Menu content. `close` dismisses the menu; pass `false` to skip returning focus to
   * the trigger, for actions that unmount it or navigate away.
   */
  children: (close: (returnFocus?: boolean) => void) => ReactNode;
  /** Accessible name for the trigger when its content is icon-only. */
  label?: string;
  align?: 'start' | 'end';
  triggerClassName?: string;
  menuClassName?: string;
}

/**
 * Minimal accessible menu: click or Enter/Space to open, Escape to close, click-outside
 * to dismiss, and focus returned to the trigger on close so keyboard users don't get
 * dropped at the top of the document.
 *
 * Written rather than pulled from a library for the same reason as the icons — this is
 * the only overlay the shell needs, and a headless-UI dependency would be a large
 * addition to the production bundle for one component. Revisit if focus-trapped modals
 * and comboboxes arrive; that is the point where a library starts paying for itself.
 */
export function DropdownMenu({
  trigger,
  children,
  label,
  align = 'end',
  triggerClassName,
  menuClassName,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        // A click elsewhere is already moving focus on its own; yanking it back to the
        // trigger would fight the user.
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' && !open) {
      event.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md text-sm transition-colors hover:bg-hover',
          triggerClassName,
        )}
      >
        {trigger}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className={cn(
            'absolute z-50 mt-1 min-w-[12rem] overflow-hidden rounded-lg border border-border bg-card p-1 shadow-lg',
            align === 'end' ? 'right-0' : 'left-0',
            menuClassName,
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

interface DropdownItemProps {
  onSelect?: () => void;
  children: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}

export function DropdownItem({
  onSelect,
  children,
  icon,
  tone = 'default',
  disabled,
}: DropdownItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
        'disabled:pointer-events-none disabled:opacity-50',
        tone === 'danger' ? 'text-danger hover:bg-danger-subtle' : 'hover:bg-hover',
      )}
    >
      {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
      <span className="truncate">{children}</span>
    </button>
  );
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">{children}</div>;
}

export function DropdownSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />;
}
