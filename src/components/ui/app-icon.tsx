'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface AppIconProps {
  category: 'terminals' | 'editors';
  name: string;
  fallback?: string;
  className?: string;
  size?: number;
}

export function AppIcon({ category, name, fallback, className, size = 20 }: AppIconProps) {
  const [hasError, setHasError] = useState(false);

  const src = `/assets/${category}/${name}.png`;

  if (hasError) {
    return fallback ? (
      <span className={className}>{fallback}</span>
    ) : null;
  }

  return (
    <img
      src={src}
      alt={name}
      className={cn('object-contain', className)}
      style={{ width: size, height: size }}
      onError={() => setHasError(true)}
    />
  );
}
