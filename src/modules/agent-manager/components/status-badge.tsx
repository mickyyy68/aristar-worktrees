import { Loader2, Pause, Check, X, Circle } from 'lucide-react';
import { cn } from '@core/lib/utils';
import type { TaskStatus, AgentStatus } from '../store/types';

type Status = TaskStatus | AgentStatus;

interface StatusBadgeProps {
  status: Status;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

const statusConfig: Record<Status, {
  label: string;
  icon: typeof Loader2;
  className: string;
  iconClassName?: string;
}> = {
  idle: {
    label: 'Idle',
    icon: Circle,
    className: 'bg-muted text-muted-foreground',
  },
  running: {
    label: 'Running',
    icon: Loader2,
    className: 'bg-green-500/10 text-green-600 dark:text-green-400',
    iconClassName: 'animate-spin',
  },
  paused: {
    label: 'Paused',
    icon: Pause,
    className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  },
  completed: {
    label: 'Completed',
    icon: Check,
    className: 'bg-green-500/10 text-green-600 dark:text-green-400',
  },
  failed: {
    label: 'Failed',
    icon: X,
    className: 'bg-red-500/10 text-red-600 dark:text-red-400',
  },
};

export function StatusBadge({ status, size = 'md', showLabel = true }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs gap-1',
    md: 'px-2 py-1 text-sm gap-1.5',
  };

  const iconSizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        sizeClasses[size],
        config.className
      )}
    >
      <Icon className={cn(iconSizeClasses[size], config.iconClassName)} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

// Simpler dot indicator for tight spaces
interface StatusDotProps {
  status: Status;
  size?: 'sm' | 'md';
}

const dotColors: Record<Status, string> = {
  idle: 'bg-muted-foreground',
  running: 'bg-green-500 animate-pulse',
  paused: 'bg-yellow-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
};

export function StatusDot({ status, size = 'md' }: StatusDotProps) {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
  };

  return (
    <span
      className={cn('inline-block rounded-full', sizeClasses[size], dotColors[status])}
      title={statusConfig[status].label}
    />
  );
}
