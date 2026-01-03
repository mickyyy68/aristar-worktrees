# Plan: Settings Reorganization + Optimization Model Setting

## Overview

Reorganize the Settings dialog with sidebar navigation (5 tabs) and add a new "Optimization" tab where users can configure the AI model used for prompt optimization. Without a model configured, the optimize button in the chat is disabled with a tooltip prompting the user to set one in settings.

When optimization completes, a **popover** attached to the optimize button shows the original and optimized prompts side-by-side for review, editing, and acceptance.

---

## Backlog

### Phase 1: Foundation - Single Model Selector Component

- [ ] **1.1** Create `src/modules/agent-manager/components/single-model-selector.tsx`
  - Import types: `OpenCodeProvider`, `ModelSelection` from `../store/types`
  - Create props interface: `SingleModelSelectorProps`
    - `providers: OpenCodeProvider[]`
    - `selectedModel: ModelSelection | undefined`
    - `onChange: (model: ModelSelection | undefined) => void`
    - `isLoading?: boolean`
    - `disabled?: boolean`
  - Implement simplified dropdown (single selection only)
  - Reuse search/input styling from existing `ModelSelector`
  - Display: "Select model..." when empty, "provider/model-id" when selected
  - Handle clear/remove of selection
  - Return `{ providerId, modelId }` object or `undefined`

- [ ] **1.2** Export `SingleModelSelector` from `src/modules/agent-manager/components/index.ts`
  - Add to existing exports

- [ ] **1.3** TypeScript type-check the new component
  - Run `bun run tsc` to verify no errors

---

### Phase 2: Store Updates - Add Optimization Model to App Settings

- [ ] **2.1** Update `src/store/types.ts`
  - Find `AppSettings` interface
  - Add new property: `optimizationModel?: ModelSelection`
  - Add JSDoc comment: `/** AI model to use for prompt optimization (provider/model-id format) */`

- [ ] **2.2** Update `src/store/use-app-store.ts`
  - Find `defaultSettings` constant
  - Add `optimizationModel: undefined` to the object

- [ ] **2.3** Run TypeScript check
  - Verify no type errors

---

### Phase 3: Reorganize Settings Dialog - Sidebar Structure

- [ ] **3.1** Create tab definitions constant in `settings-dialog.tsx`
  - Define `settingsTabs` array with 5 items:
    ```typescript
    const settingsTabs = [
      { id: 'theme', label: 'Theme', icon: '🎨' },
      { id: 'terminal', label: 'Terminal', icon: '🖥️' },
      { id: 'editor', label: 'Editor', icon: '📝' },
      { id: 'agent', label: 'Agent Manager', icon: '🤖' },
      { id: 'optimization', label: 'Optimization', icon: '🪄' },
    ] as const;
    ```

- [ ] **3.2** Add active tab state
  - Add `const [activeTab, setActiveTab] = useState<'theme' | 'terminal' | 'editor' | 'agent' | 'optimization'>('theme');`
  - Initialize to 'theme' (existing behavior)

- [ ] **3.3** Add sidebar navigation UI
  - Create sidebar div with `w-48 border-r` classes
  - Map through `settingsTabs` to create buttons
  - Apply `bg-muted` to active tab
  - Add hover states

- [ ] **3.4** Add reset button state for Optimization tab
  - Add `const [loadingProviders, setLoadingProviders] = useState(false);`
  - Add `const hasSavedModel = settings.optimizationModel !== undefined;`

- [ ] **3.5** Restructure dialog content area
  - Wrap existing content in conditional rendering based on `activeTab`
  - Extract each section into its own render function or component

- [ ] **3.6** Create `ThemeSettings` component (inline or separate)
  - Move theme-related state and JSX into a render function
  - Content: ThemeSelector, ColorSchemeToggle, ThemePreview

- [ ] **3.7** Create `TerminalSettings` component
  - Move terminal-related state and JSX into a render function
  - Content: Select for terminal app, custom command input

- [ ] **3.8** Create `EditorSettings` component
  - Move editor-related state and JSX into a render function
  - Content: Select for editor app, custom command input

- [ ] **3.9** Create `AgentSettings` component
  - Move agent manager settings into a render function
  - Content: Expand tools switch, show commands switch, output visibility select

---

### Phase 4: New Optimization Tab Implementation

- [ ] **4.1** Create `OptimizationSettings` component
  - Add state for `providers: OpenCodeProvider[] = []`

- [ ] **4.2** Load providers on mount (when optimization tab is active)
  - Use `useEffect` dependent on `activeTab`
  - Only load if tab is 'optimization' and providers not loaded
  - Handle OpenCode not installed error gracefully

- [ ] **4.3** Implement optimization tab UI content
  - Header with icon and title: "🪄 Prompt Optimization"
  - Description: "Configure the AI model used to optimize prompts before sending"
  - SingleModelSelector for choosing the model
  - Help text: "This model is used when clicking the wand icon to optimize prompts"

- [ ] **4.4** Add "Reset to Defaults" button
  - Show button if `hasSavedModel` is true
  - On click: call `setSettings({ optimizationModel: undefined })`
  - Reset local state as needed

- [ ] **4.5** Handle loading state in Optimization tab
  - Show loading spinner while providers are loading
  - Show "No models available" if OpenCode not installed

---

### Phase 5: Chat Input Updates - Disable Button + Popover

- [ ] **5.1** Import useAppStore in `chat-input.tsx`
  - Add: `import { useAppStore } from '@/store/use-app-store';`

- [ ] **5.2** Get optimization model from store
  - Add inside component: `const { settings } = useAppStore();`
  - Add: `const hasOptimizationModel = settings.optimizationModel !== undefined;`

- [ ] **5.3** Disable optimize button when no model configured
  - Update Button's `disabled` prop:
    ```typescript
    disabled={disabled || isLoading || isOptimizing || !message.trim() || !hasOptimizationModel}
    ```

- [ ] **5.4** Update tooltip content for disabled state
  - Change `TooltipContent` text based on `hasOptimizationModel`:
    - If `isOptimizing`: 'Optimizing...'
    - If `!hasOptimizationModel`: 'Set a model in Settings to enable'
    - Otherwise: 'Optimize prompt'

- [ ] **5.5** Create optimization popover component
  - New file: `src/modules/agent-manager/components/optimization-popover.tsx`
  - Use Popover component from `@core/ui/popover`
  - Props interface:
    ```typescript
    interface OptimizationPopoverProps {
      originalPrompt: string;
      optimizedPrompt: string;
      onAccept: (prompt: string) => void;
      onDismiss: () => void;
      isOpen: boolean;
      onOpenChange: (open: boolean) => void;
    }
    ```
  - Content:
    - Header: "Prompt Optimized" with checkmark icon
    - Original prompt (collapsed, expandable with arrow)
    - Optimized prompt in editable textarea with monospace font
    - Actions: "Accept", "Copy", "Dismiss" buttons
  - Attach to the optimize button (use same trigger ref pattern)

- [ ] **5.6** Add state for optimization popover in agent-manager-view
  - Add: `const [optimizationPopoverOpen, setOptimizationPopoverOpen] = useState(false);`
  - Add: `const [optimizationResult, setOptimizationResult] = useState<{original: string; optimized: string} | null>(null);`

- [ ] **5.7** Update handleOptimize to show popover on completion
  - Modify to store result and open popover:
    ```typescript
    const result = await optimize(prompt, currentRepo.path, model);
    if (result) {
      setOptimizationResult({ original: prompt, optimized: result });
      setOptimizationPopoverOpen(true);
    }
    ```

- [ ] **5.8** Remove old optimization-review-dialog.tsx
  - Delete the file since we're using popover instead
  - Remove import from agent-manager-view.tsx

---

### Phase 6: Update Agent Manager View - Use Settings Model

- [ ] **6.1** Import useAppStore in `agent-manager-view.tsx`
  - Verify import exists (should already be there)

- [ ] **6.2** Get optimization model from settings
  - Inside `AgentManagerView` component:
    ```typescript
    const { settings } = useAppStore();
    const optimizationModel = settings.optimizationModel;
    ```

- [ ] **6.3** Update handleOptimize to use settings model
  - Modify the model construction logic:
    ```typescript
    const model = optimizationModel
      ? `${optimizationModel.providerId}/${optimizationModel.modelId}`
      : null;
    
    if (!model) {
      // Optionally show a toast or do nothing
      return;
    }
    ```

- [ ] **6.4** Conditionally pass onOptimize callback
  - Change ChatInput prop:
    ```tsx
    onOptimize={optimizationModel ? handleOptimize : undefined}
    ```

---

### Phase 7: Documentation Updates

- [ ] **7.1** Add Optimization Settings section to agent-manager README
  - File: `src/modules/agent-manager/README.md`
  - Section: "Prompt Optimization Settings"
  - Document:
    - How to configure the optimization model
    - What happens when no model is configured
    - Where to find the settings

- [ ] **7.2** Update Settings Dialog documentation in core README
  - File: `src/modules/core/README.md` (if exists)
  - Describe the new sidebar navigation
  - List all 5 tabs

---

### Phase 8: Testing & Verification

- [ ] **8.1** Run TypeScript check
  - Command: `bun run tsc`

- [ ] **8.2** Run lint
  - Command: `bun run lint`

- [ ] **8.3** Build the application
  - Command: `bun run tauri build`

- [ ] **8.4** Manual testing checklist:
  - [ ] Settings dialog opens with sidebar tabs
  - [ ] Theme tab works as before
  - [ ] Terminal tab works as before
  - [ ] Editor tab works as before
  - [ ] Agent Manager tab works as before
  - [ ] Optimization tab is visible
  - [ ] Optimization tab shows "No models available" when OpenCode not running
  - [ ] Can select an optimization model
  - [ ] Reset button clears the selection
  - [ ] Chat input optimize button is disabled when no model set
  - [ ] Tooltip shows "Set a model in Settings to enable" when disabled
  - [ ] Optimize button works when model is configured
  - [ ] Optimization popover appears after optimization completes
  - [ ] Popover shows original and optimized prompts
  - [ ] Can edit optimized prompt in textarea
  - [ ] Accept button replaces chat input with optimized prompt
  - [ ] Copy button copies optimized prompt to clipboard
  - [ ] Dismiss button closes popover without changes

- [ ] **8.5** Verify localStorage persistence
  - Set an optimization model
  - Reload the app
  - Verify the setting is persisted

---

## File Changes Summary

### New Files
- `src/modules/agent-manager/components/single-model-selector.tsx` - New component
- `src/modules/agent-manager/components/optimization-popover.tsx` - New popover component (replaces dialog)

### Modified Files
- `src/store/types.ts` - Add `optimizationModel` to `AppSettings`
- `src/store/use-app-store.ts` - Add default value
- `src/modules/core/components/settings-dialog.tsx` - Complete reorganization with sidebar tabs
- `src/modules/agent-manager/components/chat/chat-input.tsx` - Disable button logic
- `src/modules/agent-manager/components/agent-manager-view.tsx` - Use settings model + popover state
- `src/modules/agent-manager/README.md` - Add documentation

### Deleted Files
- `src/modules/agent-manager/components/optimization-review-dialog.tsx` - Replaced by popover

---

## Dependencies & Order

```
1.1 → 1.2 → 1.3 (Single Model Selector)
         ↓
2.1 → 2.2 → 2.3 (Store Updates)
         ↓
3.1 → 3.2 → ... → 3.9 (Settings Reorganization)
               ↓
4.1 → 4.2 → ... → 4.5 (Optimization Tab)
         ↓
5.1 → 5.2 → 5.3 → 5.4 → 5.5 → 5.6 → 5.7 → 5.8 (Chat Input + Popover)
         ↓
6.1 → 6.2 → 6.3 → 6.4 (Agent Manager View Update)
         ↓
7.1 → 7.2 (Documentation)
         ↓
8.1 → 8.2 → 8.3 → 8.4 → 8.5 (Testing)
```

---

## Notes for Implementer

- The `ModelSelection` type is already exported from `@agent-manager/store/types`
- Use the existing `ModelSelector` as reference for UI patterns
- The `SingleModelSelector` should NOT be multi-select - it selects exactly one model or none
- When `optimizationModel` is `undefined`, the optimize button in chat should be disabled
- Tooltip text should clearly communicate what the user needs to do
- Provider loading in the Optimization tab should handle errors gracefully (OpenCode may not be installed)
- Consider using `useMemo` for expensive computations in the settings dialog
- The optimization popover should use the Popover component from `@core/ui/popover`
- The popover should attach to the optimize button using a trigger ref pattern
- The popover content should include: header with checkmark, expandable original prompt, editable textarea for optimized prompt, and action buttons
- The sidebar layout uses Tailwind's flexbox - `flex-row` for the main layout, `w-48` for sidebar width
