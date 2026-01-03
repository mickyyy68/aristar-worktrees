import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@core/ui/button';
import type { ColorScheme } from '@/store/types';

interface ColorSchemeToggleProps {
  /** Current color scheme preference */
  value: ColorScheme;
  /** Callback when color scheme changes */
  onChange: (value: ColorScheme) => void;
}

const schemes: { value: ColorScheme; icon: React.ElementType; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
];

/**
 * Toggle group for selecting color scheme (light/dark/system)
 */
export function ColorSchemeToggle({ value, onChange }: ColorSchemeToggleProps) {
  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg">
      {schemes.map((scheme) => {
        const Icon = scheme.icon;
        const isActive = value === scheme.value;
        return (
          <Button
            key={scheme.value}
            variant={isActive ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onChange(scheme.value)}
            className="flex-1 gap-1.5"
            aria-label={scheme.label}
          >
            <Icon className="h-4 w-4" />
            <span className="text-xs">{scheme.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
