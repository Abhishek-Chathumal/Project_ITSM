import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import type { Tone } from './badge';

const valueToneClasses: Record<Tone, string> = {
  neutral: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  accent: 'text-accent',
};

interface StatTileProps {
  label: string;
  /** `undefined` renders the loading state — distinct from a real zero. */
  value: number | string | undefined;
  tone?: Tone;
  icon?: ReactNode;
  /** Shown in place of the value when the metric isn't available yet. */
  placeholder?: string;
  className?: string;
}

/**
 * The big-number KPI tile that heads a dashboard.
 *
 * `value === undefined` means "still loading" and shows a pulse, never a 0 — a metric
 * that reads zero while it is actually unknown is worse than one that admits it doesn't
 * know yet. `placeholder` covers the different case of a metric that has no source at
 * all (a Phase 1 ticket count, today).
 */
export function StatTile({
  label,
  value,
  tone = 'neutral',
  icon,
  placeholder,
  className,
}: StatTileProps) {
  const loading = value === undefined && placeholder === undefined;

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {loading ? (
          <div className="h-9 w-12 animate-pulse rounded bg-muted" aria-hidden="true" />
        ) : (
          <span
            className={cn(
              'text-3xl font-semibold tabular-nums',
              placeholder !== undefined && value === undefined
                ? 'text-base font-normal text-muted-foreground'
                : valueToneClasses[tone],
            )}
          >
            {value ?? placeholder}
          </span>
        )}
        {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
      </div>
      <span className="truncate text-sm text-muted-foreground" title={label}>
        {label}
      </span>
      {loading && <span className="sr-only">Loading {label}</span>}
    </div>
  );
}
