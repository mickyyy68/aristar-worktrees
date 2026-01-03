'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Palette, Terminal, Code, Bot, Wand2, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@core/ui/button';
import { Input } from '@core/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@core/ui/dialog';
import { Label } from '@core/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@core/ui/select';
import { AppIcon } from '@core/ui/app-icon';
import { Switch } from '@core/ui/switch';
import { useAppStore } from '@/store/use-app-store';
import type { TerminalApp, EditorApp, ToolOutputVisibility, ColorScheme, OptimizationModelSelection } from '@/store/types';
import { getThemeByName, getEffectiveColorScheme } from '@core/lib/themes';
import { ThemeSelector } from './theme-selector';
import { ColorSchemeToggle } from './color-scheme-toggle';
import { ThemePreview } from './theme-preview';
import { SingleModelSelector } from '@agent-manager/components/single-model-selector';
import { opencodeClient } from '@agent-manager/api/opencode';
import type { OpenCodeProvider } from '@agent-manager/store/types';
import { cn } from '@core/lib/utils';

// Tab definitions
const settingsTabs = [
  { id: 'theme', label: 'Theme', icon: Palette },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'editor', label: 'Editor', icon: Code },
  { id: 'agent', label: 'Agent Manager', icon: Bot },
  { id: 'optimization', label: 'Optimization', icon: Wand2 },
] as const;

type TabId = typeof settingsTabs[number]['id'];

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { settings, setSettings } = useAppStore();

  // Active tab
  const [activeTab, setActiveTab] = useState<TabId>('theme');

  // Theme settings
  const [themeName, setThemeName] = useState(settings.themeName);
  const [colorScheme, setColorScheme] = useState<ColorScheme>(settings.colorScheme);

  // Local state for form
  const [terminalApp, setTerminalApp] = useState<TerminalApp>(settings.terminalApp);
  const [customTerminalCommand, setCustomTerminalCommand] = useState(settings.customTerminalCommand || '');
  const [editorApp, setEditorApp] = useState<EditorApp>(settings.editorApp);
  const [customEditorCommand, setCustomEditorCommand] = useState(settings.customEditorCommand || '');

  // Tool display settings
  const [expandToolsByDefault, setExpandToolsByDefault] = useState(settings.toolDisplay?.expandToolsByDefault ?? false);
  const [showToolCommands, setShowToolCommands] = useState(settings.toolDisplay?.showToolCommands ?? false);
  const [outputVisibility, setOutputVisibility] = useState<ToolOutputVisibility>(settings.toolDisplay?.outputVisibility ?? 'hidden');

  // Optimization settings
  const [optimizationModel, setOptimizationModel] = useState<OptimizationModelSelection | undefined>(settings.optimizationModel);
  const [providers, setProviders] = useState<OpenCodeProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);

  // Sync with store when dialog opens
  useEffect(() => {
    if (open) {
      setThemeName(settings.themeName);
      setColorScheme(settings.colorScheme);
      setTerminalApp(settings.terminalApp);
      setCustomTerminalCommand(settings.customTerminalCommand || '');
      setEditorApp(settings.editorApp);
      setCustomEditorCommand(settings.customEditorCommand || '');
      setExpandToolsByDefault(settings.toolDisplay?.expandToolsByDefault ?? false);
      setShowToolCommands(settings.toolDisplay?.showToolCommands ?? false);
      setOutputVisibility(settings.toolDisplay?.outputVisibility ?? 'hidden');
      setOptimizationModel(settings.optimizationModel);
    }
  }, [open, settings]);

  // Load providers when optimization tab is active
  const loadProviders = useCallback(async () => {
    if (providers.length > 0 || loadingProviders) return;
    
    setLoadingProviders(true);
    setProvidersError(null);
    
    try {
      // Try to get providers from any running OpenCode instance
      // First, try a common default port
      const defaultPort = 8080;
      opencodeClient.connect(defaultPort);
      const result = await opencodeClient.getProviders();
      setProviders(result.providers);
    } catch (err) {
      console.log('[SettingsDialog] Failed to load providers:', err);
      setProvidersError('Could not connect to OpenCode. Make sure an agent is running.');
    } finally {
      setLoadingProviders(false);
    }
  }, [providers.length, loadingProviders]);

  useEffect(() => {
    if (open && activeTab === 'optimization') {
      loadProviders();
    }
  }, [open, activeTab, loadProviders]);

  const handleSave = () => {
    setSettings({
      themeName,
      colorScheme,
      terminalApp,
      customTerminalCommand: terminalApp === 'custom' ? customTerminalCommand : undefined,
      editorApp,
      customEditorCommand: editorApp === 'custom' ? customEditorCommand : undefined,
      toolDisplay: {
        expandToolsByDefault,
        showToolCommands,
        outputVisibility,
        truncatedOutputLines: settings.toolDisplay?.truncatedOutputLines ?? 10,
      },
      optimizationModel,
    });
    onOpenChange(false);
  };

  const handleResetOptimization = () => {
    setOptimizationModel(undefined);
  };

  // Get preview theme and color scheme
  const previewTheme = getThemeByName(themeName);
  const previewColorScheme = getEffectiveColorScheme(colorScheme);

  const outputVisibilityOptions = [
    { value: 'hidden', label: 'Hidden', description: 'Click to show output' },
    { value: 'truncated', label: 'Truncated', description: 'Show first 10 lines' },
    { value: 'always', label: 'Always visible', description: 'Show full output' },
  ];

  // Terminal options with display names and notes
  const terminalOptions = [
    { value: 'terminal', label: 'Terminal.app', icon: 'terminal', fallback: '>', note: 'Opens new window' },
    { value: 'ghostty', label: 'Ghostty', icon: 'ghostty', fallback: '>', note: 'Opens new tab in existing instance' },
    { value: 'alacritty', label: 'Alacritty', icon: 'alacritty', fallback: '>', note: 'Opens new window (tabs not supported via CLI)' },
    { value: 'kitty', label: 'Kitty', icon: 'kitty', fallback: '>', note: 'Opens in existing instance' },
    { value: 'iterm', label: 'iTerm2', icon: 'iterm', fallback: '>', note: 'Opens new window' },
    { value: 'warp', label: 'Warp', icon: 'warp', fallback: '>', note: 'Opens new tab' },
    { value: 'custom', label: 'Custom', icon: 'custom', fallback: '>', note: undefined },
  ];

  const editorOptions = [
    { value: 'vscode', label: 'VS Code', icon: 'vscode', fallback: '>' },
    { value: 'cursor', label: 'Cursor', icon: 'cursor', fallback: '>' },
    { value: 'zed', label: 'Zed', icon: 'zed', fallback: '>' },
    { value: 'antigravity', label: 'Antigravity', icon: 'antigravity', fallback: '>' },
    { value: 'custom', label: 'Custom', icon: 'custom', fallback: '>' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[700px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure your preferences
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-[400px] max-h-[60vh]">
          {/* Sidebar */}
          <div className="w-44 border-r bg-muted/30 shrink-0">
            <nav className="p-2 space-y-1">
              {settingsTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      activeTab === tab.id
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Theme Tab */}
            {activeTab === 'theme' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-1">Theme</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Customize the look and feel of the application
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="theme">Theme</Label>
                    <ThemeSelector value={themeName} onValueChange={setThemeName} />
                  </div>

                  <div className="space-y-2">
                    <Label>Color Scheme</Label>
                    <ColorSchemeToggle value={colorScheme} onChange={setColorScheme} />
                  </div>

                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <ThemePreview theme={previewTheme} colorScheme={previewColorScheme} />
                  </div>
                </div>
              </div>
            )}

            {/* Terminal Tab */}
            {activeTab === 'terminal' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-1">Terminal</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure your preferred terminal application
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="terminal">Default Terminal</Label>
                    <Select value={terminalApp} onValueChange={(v) => setTerminalApp(v as TerminalApp)}>
                      <SelectTrigger id="terminal">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {terminalOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <span className="flex items-center gap-2">
                              {opt.icon ? (
                                <AppIcon category="terminals" name={opt.icon} fallback={opt.fallback} size={18} />
                              ) : (
                                <span>{opt.fallback}</span>
                              )}
                              <span>{opt.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {terminalOptions.find(t => t.value === terminalApp)?.note && (
                      <p className="text-xs text-muted-foreground">
                        {terminalOptions.find(t => t.value === terminalApp)?.note}
                      </p>
                    )}
                  </div>

                  {terminalApp === 'custom' && (
                    <div className="space-y-2">
                      <Label htmlFor="customTerminal">Custom Command</Label>
                      <Input
                        id="customTerminal"
                        placeholder="e.g., wezterm start --cwd"
                        value={customTerminalCommand}
                        onChange={(e) => setCustomTerminalCommand(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        The path will be appended to this command
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Editor Tab */}
            {activeTab === 'editor' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-1">Code Editor</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure your preferred code editor
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="editor">Default Editor</Label>
                    <Select value={editorApp} onValueChange={(v) => setEditorApp(v as EditorApp)}>
                      <SelectTrigger id="editor">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {editorOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <span className="flex items-center gap-2">
                              {opt.icon ? (
                                <AppIcon category="editors" name={opt.icon} fallback={opt.fallback} size={18} />
                              ) : (
                                <span>{opt.fallback}</span>
                              )}
                              <span>{opt.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {editorApp === 'custom' && (
                    <div className="space-y-2">
                      <Label htmlFor="customEditor">Custom Command</Label>
                      <Input
                        id="customEditor"
                        placeholder="e.g., nvim"
                        value={customEditorCommand}
                        onChange={(e) => setCustomEditorCommand(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        The path will be appended to this command
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Agent Manager Tab */}
            {activeTab === 'agent' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-1">Agent Manager</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure how agent tools and outputs are displayed
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="expandTools">Expand tools by default</Label>
                      <p className="text-xs text-muted-foreground">
                        Show tool details expanded when they appear
                      </p>
                    </div>
                    <Switch
                      id="expandTools"
                      checked={expandToolsByDefault}
                      onCheckedChange={setExpandToolsByDefault}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="showCommands">Show tool commands</Label>
                      <p className="text-xs text-muted-foreground">
                        Display commands alongside tool descriptions
                      </p>
                    </div>
                    <Switch
                      id="showCommands"
                      checked={showToolCommands}
                      onCheckedChange={setShowToolCommands}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="outputVisibility">Output visibility</Label>
                    <Select
                      value={outputVisibility}
                      onValueChange={(v) => setOutputVisibility(v as ToolOutputVisibility)}
                    >
                      <SelectTrigger id="outputVisibility">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {outputVisibilityOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <span className="flex flex-col">
                              <span>{opt.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {outputVisibilityOptions.find((o) => o.value === outputVisibility)?.description}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Optimization Tab */}
            {activeTab === 'optimization' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-1">Prompt Optimization</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure the AI model used to optimize prompts before sending
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Optimization Model</Label>
                    {loadingProviders ? (
                      <div className="flex items-center gap-2 h-9 px-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading available models...
                      </div>
                    ) : providersError ? (
                      <div className="rounded-md bg-muted/50 p-4 text-center">
                        <p className="text-sm text-muted-foreground mb-2">{providersError}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setProviders([]);
                            loadProviders();
                          }}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Retry
                        </Button>
                      </div>
                    ) : (
                      <SingleModelSelector
                        providers={providers}
                        selectedModel={optimizationModel}
                        onChange={setOptimizationModel}
                        isLoading={loadingProviders}
                        placeholder="Select optimization model..."
                      />
                    )}
                    <p className="text-xs text-muted-foreground">
                      This model is used when clicking the wand icon to optimize prompts
                    </p>
                  </div>

                  {optimizationModel && (
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetOptimization}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset to Defaults
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
