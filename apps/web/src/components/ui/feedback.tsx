import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** Loading placeholder shaped like the content it stands in for. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-muted', className)} aria-hidden="true" />;
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * The "nothing here" state. Worth a real component: an empty list that renders as blank
 * space is indistinguishable from one that failed to load.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-4 py-10 text-center', className)}>
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * The failure counterpart to `EmptyState` (Article VII — a failure the user can see,
 * not a silently blank panel).
 */
export function ErrorState({
  title = 'Something went wrong',
  description,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-2 px-4 py-10 text-center', className)}
    >
      <p className="text-sm font-medium text-danger">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
