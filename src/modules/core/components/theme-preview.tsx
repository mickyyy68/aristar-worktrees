import type { ThemeDefinition } from '@/store/types';

interface ThemePreviewProps {
  /** The theme to preview */
  theme: ThemeDefinition;
  /** The color scheme to preview ('light' or 'dark') */
  colorScheme: 'light' | 'dark';
  /** Optional className for the container */
  className?: string;
}

/**
 * A preview card showing theme colors
 * Uses inline styles to display the theme's colors without affecting the current theme
 */
export function ThemePreview({ theme, colorScheme, className = '' }: ThemePreviewProps) {
  const colors = colorScheme === 'dark' ? theme.dark : theme.light;

  return (
    <div
      className={`rounded-lg border overflow-hidden ${className}`}
      style={{
        backgroundColor: colors['--background'],
        borderColor: colors['--border'],
      }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 text-sm font-medium"
        style={{
          backgroundColor: colors['--card'],
          color: colors['--card-foreground'],
          borderBottom: `1px solid ${colors['--border']}`,
        }}
      >
        {theme.displayName}
      </div>

      {/* Color swatches */}
      <div className="p-3 space-y-2">
        <div className="flex gap-2">
          {/* Primary */}
          <div
            className="w-8 h-8 rounded-md shadow-sm"
            style={{ backgroundColor: colors['--primary'] }}
            title="Primary"
          />
          {/* Secondary */}
          <div
            className="w-8 h-8 rounded-md shadow-sm"
            style={{ backgroundColor: colors['--secondary'] }}
            title="Secondary"
          />
          {/* Accent */}
          <div
            className="w-8 h-8 rounded-md shadow-sm"
            style={{ backgroundColor: colors['--accent'] }}
            title="Accent"
          />
          {/* Muted */}
          <div
            className="w-8 h-8 rounded-md shadow-sm"
            style={{ backgroundColor: colors['--muted'] }}
            title="Muted"
          />
        </div>

        {/* Sample text */}
        <p
          className="text-xs"
          style={{ color: colors['--muted-foreground'] }}
        >
          {theme.description}
        </p>
      </div>
    </div>
  );
}
