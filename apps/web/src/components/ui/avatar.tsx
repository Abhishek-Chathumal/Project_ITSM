import { cn } from '../../lib/cn';
import { initialsOf } from '../../lib/initials';

interface AvatarProps {
  name: string | undefined | null;
  className?: string;
  size?: 'sm' | 'md';
}

export function Avatar({ name, className, size = 'md' }: AvatarProps) {
  return (
    <span
      // The name is already rendered as text everywhere this appears, so the avatar
      // itself is decorative — announcing the initials again would just be noise.
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full bg-primary font-medium text-primary-foreground',
        size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs',
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
