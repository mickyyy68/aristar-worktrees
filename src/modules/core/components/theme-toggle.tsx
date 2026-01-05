import { useEffect, useState } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@core/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@core/ui/dropdown-menu';
import { useTheme } from '@core/hooks/use-theme';

export function ThemeToggle() {
  const { colorScheme, setColorScheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Button variant="ghost" size="icon" disabled />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setColorScheme('light')}>
          <Sun className="mr-2 h-4 w-4" />
          Light
          {colorScheme === 'light' && <span className="ml-auto">&#10003;</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setColorScheme('dark')}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
          {colorScheme === 'dark' && <span className="ml-auto">&#10003;</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setColorScheme('system')}>
          <Monitor className="mr-2 h-4 w-4" />
          System
          {colorScheme === 'system' && <span className="ml-auto">&#10003;</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
