Theme Selection Implementation Plan
Overview
Implement a theme selection system in the Aristar Worktrees app with:
- 5 built-in themes (Aristar, Claude, VS Code, Dracula, Nord)
- Each theme has integrated light/dark color schemes
- System preference detection for color scheme
- Theme selection in Settings dialog with preview
- Light/Dark toggle in header
---
Phase 1: Type System & State Management
1.1 Update src/store/types.ts
- [ ] Add ThemeColorScheme type (Record<string, string>)
- [ ] Add ThemeDefinition interface with name, displayName, description, light, dark
- [ ] Add ColorScheme type: 'light' | 'dark' | 'system'
- [ ] Update AppSettings interface:
  - [ ] Replace theme: 'light' | 'dark' | 'system' with themeName: string
  - [ ] Add colorScheme: ColorScheme
- [ ] Update all imports/exports to include new types
1.2 Update src/store/use-app-store.ts
- [ ] Update defaultSettings to include:
  - [ ] themeName: 'aristar'
  - [ ] colorScheme: 'system'
- [ ] Verify persistence includes new fields
- [ ] Test that settings save/load correctly
1.3 Update src-tauri/src/core/types.rs
- [ ] Add theme_name: String field to AppSettings
- [ ] Add color_scheme: String field to AppSettings
- [ ] Update #[derive(Default)] implementation
- [ ] Verify serde serialization/deserialization
---
Phase 2: Theme Registry & Data Files
2.1 Create src/modules/core/lib/themes/index.ts
- [ ] Create ThemeColorScheme type
- [ ] Create ThemeDefinition interface
- [ ] Import all theme modules
- [ ] Create THEMES constant with all themes
- [ ] Export ThemeName type
- [ ] Export DEFAULT_THEME constant
- [ ] Export DEFAULT_COLOR_SCHEME constant
- [ ] Create helper function: getThemeByName(name: string): ThemeDefinition
- [ ] Create helper function: getColorSchemeVars(theme, scheme): ThemeColorScheme
2.2 Create src/modules/core/lib/themes/aristar.ts
- [ ] Extract :root variables from current index.css into light object
- [ ] Extract .dark variables from current index.css into dark object
- [ ] Include all CSS variables: colors, fonts, radius, shadows, spacing, tracking
- [ ] Ensure variable format: 'hsl(...)' or 'value' strings
- [ ] Export with proper TypeScript typing
2.3 Create src/modules/core/lib/themes/claude.ts
- [ ] Convert provided Claude theme CSS to TypeScript object
- [ ] Map :root variables to light object
- [ ] Map .dark variables to dark object
- [ ] Include all variables (colors, fonts, radius, shadows, etc.)
- [ ] Export with proper TypeScript typing
2.4 Create src/modules/core/lib/themes/vscode.ts
- [ ] Research/create VS Code inspired color palette
- [ ] Create light color scheme (blue accents, clean whites)
- [ ] Create dark color scheme (dark background, blue accents)
- [ ] Include all required CSS variables
- [ ] Export with proper TypeScript typing
2.5 Create src/modules/core/lib/themes/dracula.ts
- [ ] Research/create Dracula-inspired color palette
- [ ] Create light color scheme
- [ ] Create dark color scheme
- [ ] Include all required CSS variables
- [ ] Export with proper TypeScript typing
2.6 Create src/modules/core/lib/themes/nord.ts
- [ ] Research/create Nord-inspired color palette
- [ ] Create light color scheme
- [ ] Create dark color scheme
- [ ] Include all required CSS variables
- [ ] Export with proper TypeScript typing
2.7 Update src/modules/core/lib/index.ts
- [ ] Re-export everything from ./themes/index.ts
- [ ] Ensure clean public API
---
Phase 3: Theme Hook
3.1 Create src/modules/core/hooks/use-theme.ts
- [ ] Create useTheme() hook function
- [ ] Import useAppStore for settings access
- [ ] Import THEMES for theme data
- [ ] Implement theme variable application:
  - [ ] Get current theme by themeName
  - [ ] Get color scheme vars based on colorScheme + system preference
  - [ ] Apply variables to document.documentElement.style
- [ ] Implement dark mode class:
  - [ ] Detect if should be dark (explicit 'dark' or 'system' + OS preference)
  - [ ] Toggle dark class on document.documentElement
- [ ] Implement system preference listener:
  - [ ] Add matchMedia('prefers-color-scheme') listener
  - [ ] Update dark mode when system changes (only if colorScheme === 'system')
  - [ ] Cleanup listener on unmount
- [ ] Return helper functions:
  - [ ] theme (current ThemeDefinition)
  - [ ] themeName (current theme name)
  - [ ] colorScheme (current scheme)
  - [ ] setThemeName(name: string)
  - [ ] setColorScheme(scheme: ColorScheme)
  - [ ] toggleColorScheme()
- [ ] Add JSDoc documentation
---
Phase 4: CSS Architecture Refactor
4.1 Update src/index.css
- [ ] Keep @import "tailwindcss" directive
- [ ] Keep @custom-variant dark directive
- [ ] Move static CSS variables from :root to new section:
  - [ ] Font families (sans, serif, mono)
  - [ ] Radius base value
  - [ ] Tracking normal
  - [ ] Spacing base
- [ ] Remove all theme-specific color/shadow variables (they'll be injected by JS)
- [ ] Keep @theme inline with CSS variable mappings (unchanged)
- [ ] Keep @layer base styles (unchanged)
- [ ] Keep @layer utilities for font classes (unchanged)
- [ ] Add comment explaining theme injection mechanism
4.2 Verify Tailwind integration
- [ ] Ensure all --color-* variables still map to Tailwind classes
- [ ] Test that bg-background, text-foreground, etc. still work
- [ ] Test that dark mode classes work correctly
---
Phase 5: Theme UI Components
5.1 Create src/modules/core/components/theme-preview.tsx
- [ ] Create ThemePreviewProps interface
- [ ] Accept theme: ThemeDefinition and colorScheme: 'light' | 'dark'
- [ ] Create preview card layout:
  - [ ] Header showing theme name
  - [ ] Color swatch showing primary color
  - [ ] Color swatch showing background
  - [ ] Color swatch showing accent
  - [ ] Optional: small sample text
- [ ] Style with current theme's colors (inline styles for preview)
- [ ] Add responsive design (works on mobile)
5.2 Create src/modules/core/components/theme-selector.tsx
- [ ] Create ThemeSelectorProps interface
- [ ] Accept value: string and onValueChange: (value: string) => void
- [ ] Use Select component from @core/ui/select
- [ ] Render all themes from THEMES registry
- [ ] Display theme displayName in each option
- [ ] Add optional description tooltip or subtitle
- [ ] Add AppIcon if themes have icons (optional)
5.3 Create src/modules/core/components/color-scheme-toggle.tsx
- [ ] Create ColorSchemeToggleProps interface
- [ ] Accept value: 'light' | 'dark' | 'system' and onChange
- [ ] Create segmented control or toggle group
- [ ] Use sun icon for light, moon icon for dark, computer icon for system
- [ ] Add accessible labels for each option
- [ ] Style to match app aesthetics
5.4 Update src/modules/core/components/theme-toggle.tsx
- [ ] Keep existing light/dark toggle functionality
- [ ] Import useTheme hook
- [ ] Update to use colorScheme from store instead of theme
- [ ] Keep dropdown menu with three options:
  - [ ] Light (sun icon)
  - [ ] Dark (moon icon)
  - [ ] System (computer icon)
- [ ] On selection, call setColorScheme()
- [ ] Update icon rotation transitions if desired
- [ ] Ensure proper TypeScript typing
---
Phase 6: Settings Dialog Integration
6.1 Update src/modules/core/components/settings-dialog.tsx
- [ ] Add imports for new theme components
- [ ] Add local state for themeName (sync with store on dialog open)
- [ ] Add local state for colorScheme (sync with store on dialog open)
- [ ] Update handleSave() to include new theme settings
- [ ] Add new "Theme" section in the dialog:
  - [ ] Section header with 🎨 emoji and "Theme" label
  - [ ] Theme selector dropdown
  - [ ] Color scheme toggle (light/dark/system)
  - [ ] Theme preview card
- [ ] Add separator above and below theme section
- [ ] Ensure proper spacing and layout
- [ ] Add descriptions/helper text if needed
6.2 Test settings persistence
- [ ] Open settings, change theme, save, close, reopen - verify persistence
- [ ] Change color scheme, verify it applies immediately
- [ ] Test system preference detection
- [ ] Verify no console errors
---
Phase 7: Testing & Polish
7.1 Test all themes
- [ ] Test Aristar theme light/dark switching
- [ ] Test Claude theme light/dark switching
- [ ] Test VS Code theme light/dark switching
- [ ] Test Dracula theme light/dark switching
- [ ] Test Nord theme light/dark switching
- [ ] Verify all CSS variables are applied correctly
7.2 Test system preference
- [ ] Set color scheme to "system"
- [ ] Change OS light/dark mode
- [ ] Verify app updates accordingly
- [ ] Test on both macOS light and dark modes
7.3 Test settings dialog
- [ ] Verify theme preview shows correct colors
- [ ] Verify theme selector shows all themes
- [ ] Verify color scheme toggle works
- [ ] Test cancel button - settings should not change
- [ ] Test save button - settings should persist
7.4 Test header theme toggle
- [ ] Click toggle, select light/dark
- [ ] Verify icon updates correctly
- [ ] Verify theme applies immediately
- [ ] Test system option if implemented
7.5 Run linting & typechecking
- [ ] Run bun run lint
- [ ] Run bun run tsc
- [ ] Fix any errors or warnings
---
Phase 8: Documentation
8.1 Update src/modules/core/README.md
- [ ] Document new theme architecture
- [ ] Document how to add new themes
- [ ] Document theme file structure
- [ ] Add examples for theme definition
- [ ] Document CSS variable requirements
8.2 Update AGENTS.md
- [ ] Update build commands if needed
- [ ] Document new project structure
- [ ] Add theme-related commands if any
---
Phase 9: Additional Themes (Optional, Later)
9.1 Create src/modules/core/lib/themes/github.ts
- [ ] GitHub light/dark inspired theme
- [ ] Export with proper typing
9.2 Create src/modules/core/lib/themes/catppuccin.ts
- [ ] Catppuccin-inspired theme
- [ ] Export with proper typing
---
File Summary
| File | Action | Lines (est.) |
|------|--------|--------------|
| src/store/types.ts | Modify | +20 |
| src/store/use-app-store.ts | Modify | +5 |
| src-tauri/src/core/types.rs | Modify | +5 |
| src/modules/core/lib/themes/index.ts | Create | ~80 |
| src/modules/core/lib/themes/aristar.ts | Create | ~120 |
| src/modules/core/lib/themes/claude.ts | Create | ~120 |
| src/modules/core/lib/themes/vscode.ts | Create | ~120 |
| src/modules/core/lib/themes/dracula.ts | Create | ~120 |
| src/modules/core/lib/themes/nord.ts | Create | ~120 |
| src/modules/core/lib/index.ts | Modify | +5 |
| src/modules/core/hooks/use-theme.ts | Create | ~100 |
| src/index.css | Modify | -50 |
| src/modules/core/components/theme-preview.tsx | Create | ~60 |
| src/modules/core/components/theme-selector.tsx | Create | ~40 |
| src/modules/core/components/color-scheme-toggle.tsx | Create | ~50 |
| src/modules/core/components/theme-toggle.tsx | Modify | +20 |
| src/modules/core/components/settings-dialog.tsx | Modify | +60 |
| src/modules/core/README.md | Modify | +50 |
---
Dependencies
- No new npm packages required
- Uses existing zustand, lucide-react, Tailwind CSS v4
- Uses existing UI components (Select, Button, etc.)
---
Notes for Implementation
1. CSS Variable Injection: Theme variables are applied via JavaScript to document.documentElement.style. This allows instant theme switching without page reload.
2. Shadow Variables: Each theme defines its own shadow variables (e.g., --shadow-sm, --shadow-md). This is why shadows look different between Aristar and Claude.
3. Font Variables: Font families can be theme-specific or shared. Currently shared in base CSS, but could be per-theme if needed.
4. Color Scheme Detection: When colorScheme === 'system', the app listens to prefers-color-scheme media query and automatically switches between light/dark of the selected theme.
5. Persistence: Both themeName and colorScheme are persisted via Zustand's persist middleware to localStorage.