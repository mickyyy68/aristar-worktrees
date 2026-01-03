import { useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '@/store/use-app-store';
import {
  THEMES,
  getThemeByName,
  getColorSchemeVars,
  getEffectiveColorScheme,
} from '@core/lib/themes';
import type { ColorScheme } from '@/store/types';

/**
 * Hook for managing theme and color scheme
 *
 * This hook handles:
 * - Applying theme CSS variables to the document
 * - Toggling the dark class based on color scheme
 * - Listening to system preference changes
 * - Providing helpers to change theme and color scheme
 */
export function useTheme() {
  const { settings, setSettings } = useAppStore();
  const { themeName, colorScheme } = settings;

  // Get the current theme definition
  const theme = useMemo(() => getThemeByName(themeName), [themeName]);

  // Get the effective color scheme (resolves 'system' to actual value)
  const effectiveColorScheme = useMemo(
    () => getEffectiveColorScheme(colorScheme),
    [colorScheme]
  );

  // Apply theme CSS variables whenever theme or color scheme changes
  useEffect(() => {
    const vars = getColorSchemeVars(theme, effectiveColorScheme);
    const root = document.documentElement;

    // Apply all CSS variables
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }

    // Toggle dark class
    root.classList.toggle('dark', effectiveColorScheme === 'dark');
  }, [theme, effectiveColorScheme]);

  // Listen to system preference changes when colorScheme is 'system'
  useEffect(() => {
    if (colorScheme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      const newScheme = e.matches ? 'dark' : 'light';
      const vars = getColorSchemeVars(theme, newScheme);
      const root = document.documentElement;

      // Apply all CSS variables
      for (const [key, value] of Object.entries(vars)) {
        root.style.setProperty(key, value);
      }

      // Toggle dark class
      root.classList.toggle('dark', newScheme === 'dark');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [colorScheme, theme]);

  // Set the theme by name
  const setThemeName = useCallback(
    (name: string) => {
      setSettings({ themeName: name });
    },
    [setSettings]
  );

  // Set the color scheme preference
  const setColorScheme = useCallback(
    (scheme: ColorScheme) => {
      setSettings({ colorScheme: scheme });
    },
    [setSettings]
  );

  // Toggle between light and dark (ignoring system)
  const toggleColorScheme = useCallback(() => {
    const newScheme = effectiveColorScheme === 'dark' ? 'light' : 'dark';
    setSettings({ colorScheme: newScheme });
  }, [effectiveColorScheme, setSettings]);

  return {
    /** Current theme definition */
    theme,
    /** Current theme name */
    themeName,
    /** Current color scheme preference ('light' | 'dark' | 'system') */
    colorScheme,
    /** Resolved color scheme ('light' | 'dark') */
    effectiveColorScheme,
    /** All available themes */
    themes: THEMES,
    /** Set the theme by name */
    setThemeName,
    /** Set the color scheme preference */
    setColorScheme,
    /** Toggle between light and dark */
    toggleColorScheme,
  };
}
