import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface PageHeaderProps {
  title: string;
  /** Secondary context beside the title — a saved view or dashboard selector. */
  context?: ReactNode;
  description?: string;
  /** Right-aligned toolbar: icon buttons, then the primary action. */
  actions?: ReactNode;
  className?: string;
}

/**
 * The standard head of every page: title on the left, action cluster on the right.
 * Having one component for this is what keeps Tickets, Assets and Reports from each
 * inventing their own header spacing.
 */
export function PageHeader({ title, context, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {context}
        </div>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}
