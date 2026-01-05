import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function getRepositoryName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || 'Unknown';
}

export function truncatePath(path: string, maxLength: number = 40): string {
  if (path.length <= maxLength) return path;
  const parts = path.split('/');
  if (parts.length === 1) return path.substring(0, maxLength);
  
  const filename = parts[parts.length - 1];
  const prefix = '.../' + parts.slice(-2, -1).join('/') + '/';
  
  if (prefix.length + filename.length > maxLength) {
    return '.../' + filename;
  }
  
  return prefix + filename;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export type IconCategory = 'terminals' | 'editors';

export function getIconPath(category: IconCategory, name: string): string {
  return `/src/assets/${category}/${name}`;
}
