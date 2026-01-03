/**
 * Theme Registry
 *
 * This module provides theme definitions and helper functions for the theme system.
 * Each theme contains light and dark color schemes with all required CSS variables.
 *
 * Adding a new theme:
 * 1. Create a new file (e.g., `my-theme.ts`) with a ThemeDefinition export
 * 2. Import and add it to the THEMES array below
 * 3. The theme will automatically appear in the settings dialog
 */

import type { ThemeDefinition, ThemeColorScheme, ColorScheme } from '@/store/types';
import { aristarTheme } from './aristar';
import { claudeTheme } from './claude';
import { vercelTheme } from './vercel';
import { natureTheme } from './nature';

/** All available themes */
export const THEMES: ThemeDefinition[] = [
  aristarTheme,
  claudeTheme,
  vercelTheme,
  natureTheme,
];

/** Available theme names */
export type ThemeName = (typeof THEMES)[number]['name'];

/** Default theme to use when no theme is selected */
export const DEFAULT_THEME = 'aristar';

/** Default color scheme preference */
export const DEFAULT_COLOR_SCHEME: ColorScheme = 'system';

/**
 * Get a theme by its name
 * @param name - The theme name to look up
 * @returns The theme definition, or the default theme if not found
 */
export function getThemeByName(name: string): ThemeDefinition {
  const theme = THEMES.find((t) => t.name === name);
  if (!theme) {
    // Fall back to default theme
    return THEMES.find((t) => t.name === DEFAULT_THEME) ?? THEMES[0];
  }
  return theme;
}

/**
 * Get the CSS variables for a specific theme and color scheme
 * @param theme - The theme definition
 * @param scheme - The color scheme ('light' or 'dark')
 * @returns The CSS variables for the specified scheme
 */
export function getColorSchemeVars(
  theme: ThemeDefinition,
  scheme: 'light' | 'dark'
): ThemeColorScheme {
  return scheme === 'dark' ? theme.dark : theme.light;
}

/**
 * Apply theme CSS variables to the document
 * @param theme - The theme definition
 * @param scheme - The color scheme ('light' or 'dark')
 */
export function applyThemeToDocument(
  theme: ThemeDefinition,
  scheme: 'light' | 'dark'
): void {
  const vars = getColorSchemeVars(theme, scheme);
  const root = document.documentElement;

  // Apply all CSS variables
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }

  // Toggle dark class
  root.classList.toggle('dark', scheme === 'dark');
}

/**
 * Determine the effective color scheme based on preference and system settings
 * @param preference - The user's color scheme preference
 * @returns The effective color scheme ('light' or 'dark')
 */
export function getEffectiveColorScheme(preference: ColorScheme): 'light' | 'dark' {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

// Re-export types for convenience
export type { ThemeDefinition, ThemeColorScheme, ColorScheme };
