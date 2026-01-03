import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@core/ui/select';
import { THEMES } from '@core/lib/themes';

interface ThemeSelectorProps {
  /** Currently selected theme name */
  value: string;
  /** Callback when theme selection changes */
  onValueChange: (value: string) => void;
}

/**
 * Dropdown selector for choosing a theme
 */
export function ThemeSelector({ value, onValueChange }: ThemeSelectorProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a theme" />
      </SelectTrigger>
      <SelectContent>
        {THEMES.map((theme) => (
          <SelectItem key={theme.name} value={theme.name}>
            <div className="flex flex-col items-start">
              <span>{theme.displayName}</span>
              <span className="text-xs text-muted-foreground">
                {theme.description}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
