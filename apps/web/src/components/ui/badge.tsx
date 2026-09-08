import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/**
 * The semantic vocabulary the rest of the UI expresses state in. Call sites pass a
 * *meaning* ("danger"), never a colour ("red"), so a palette change stays a token edit.
 */
export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
  info: 'bg-info-subtle text-info',
  accent: 'bg-accent-subtle text-accent',
};

const dotClasses: Record<Tone, string> = {
  neutral: 'bg-muted-foreground',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  accent: 'bg-accent',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** Renders a leading dot, the way a ticket status reads in a dense table. */
  withDot?: boolean;
}

export function Badge({ className, tone = 'neutral', withDot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {withDot && <span className={cn('h-1.5 w-1.5 rounded-full', dotClasses[tone])} />}
      {children}
    </span>
  );
}

interface StatusDotProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** Accessible name. Colour alone must never be the only carrier of meaning. */
  label: string;
}

/**
 * A bare dot plus its label — the table-cell form of a status, where a filled badge
 * would be too heavy at row density.
 */
export function StatusDot({ className, tone = 'neutral', label, ...props }: StatusDotProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)} {...props}>
      <span className={cn('h-2 w-2 shrink-0 rounded-full', dotClasses[tone])} />
      <span className="truncate">{label}</span>
    </span>
  );
}

/**
 * A monospaced identifier chip — the `SR-00812804` treatment that makes a reference
 * scannable in a list. Kept here so ticket, asset and change IDs all render alike.
 */
export function IdChip({ className, children, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
