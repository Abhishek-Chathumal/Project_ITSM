import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: the button has no text, so this is its only accessible name. */
  label: string;
  size?: 'sm' | 'md';
}

/**
 * Square icon-only button for the toolbar clusters in page headers and the top bar.
 * `label` is mandatory rather than optional — an unlabelled icon button is invisible to
 * a screen reader, and making it a required prop is cheaper than catching it in review.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, label, size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors',
        'hover:bg-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
        className,
      )}
      {...props}
    />
  ),
);
IconButton.displayName = 'IconButton';
