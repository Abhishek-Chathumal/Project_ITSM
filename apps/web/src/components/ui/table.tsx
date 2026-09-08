import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/**
 * Dense list table, styled for the ticket/asset/audit lists Phase 1 onward will need.
 *
 * `Table` deliberately renders its own horizontal scroll container: these tables carry
 * more columns than a phone can show, and the page body must never scroll sideways.
 */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('border-b border-border', className)} {...props} />;
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-border', className)} {...props} />;
}

interface TRProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Adds the hover affordance for rows that navigate somewhere. */
  interactive?: boolean;
}

export function TR({ className, interactive, ...props }: TRProps) {
  return (
    <tr
      className={cn(interactive && 'cursor-pointer transition-colors hover:bg-hover', className)}
      {...props}
    />
  );
}

export function TH({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function TD({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 py-2.5 align-middle', className)} {...props} />;
}
