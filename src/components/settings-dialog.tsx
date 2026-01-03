'use client';

import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { AppIcon } from '@/components/ui/app-icon';
import { Switch } from '@/components/ui/switch';
import { useAppStore } from '@/store/use-app-store';
import type { TerminalApp, EditorApp, ToolOutputVisibility } from '@/store/types';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { settings, setSettings } = useAppStore();

  // Local state for form
  const [terminalApp, setTerminalApp] = useState<TerminalApp>(settings.terminalApp);
  const [customTerminalCommand, setCustomTerminalCommand] = useState(settings.customTerminalCommand || '');
  const [editorApp, setEditorApp] = useState<EditorApp>(settings.editorApp);
  const [customEditorCommand, setCustomEditorCommand] = useState(settings.customEditorCommand || '');

  // Tool display settings
  const [expandToolsByDefault, setExpandToolsByDefault] = useState(settings.toolDisplay?.expandToolsByDefault ?? false);
  const [showToolCommands, setShowToolCommands] = useState(settings.toolDisplay?.showToolCommands ?? false);
  const [outputVisibility, setOutputVisibility] = useState<ToolOutputVisibility>(settings.toolDisplay?.outputVisibility ?? 'hidden');

  // Sync with store when dialog opens
  useEffect(() => {
    if (open) {
      setTerminalApp(settings.terminalApp);
      setCustomTerminalCommand(settings.customTerminalCommand || '');
      setEditorApp(settings.editorApp);
      setCustomEditorCommand(settings.customEditorCommand || '');
      setExpandToolsByDefault(settings.toolDisplay?.expandToolsByDefault ?? false);
      setShowToolCommands(settings.toolDisplay?.showToolCommands ?? false);
      setOutputVisibility(settings.toolDisplay?.outputVisibility ?? 'hidden');
    }
  }, [open, settings]);

  const handleSave = () => {
    setSettings({
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
    });
    onOpenChange(false);
  };

  const outputVisibilityOptions = [
    { value: 'hidden', label: 'Hidden', description: 'Click to show output' },
    { value: 'truncated', label: 'Truncated', description: 'Show first 10 lines' },
    { value: 'always', label: 'Always visible', description: 'Show full output' },
  ];

  // Terminal options with display names and notes
  const terminalOptions = [
    { value: 'terminal', label: 'Terminal.app', icon: 'terminal', fallback: '🖥️', note: 'Opens new window' },
    { value: 'ghostty', label: 'Ghostty', icon: 'ghostty', fallback: '👻', note: 'Opens new tab in existing instance' },
    { value: 'alacritty', label: 'Alacritty', icon: 'alacritty', fallback: '🚀', note: 'Opens new window (tabs not supported via CLI)' },
    { value: 'kitty', label: 'Kitty', icon: 'kitty', fallback: '🐱', note: 'Opens in existing instance' },
    { value: 'iterm', label: 'iTerm2', icon: 'iterm', fallback: '💻', note: 'Opens new window' },
    { value: 'warp', label: 'Warp', icon: 'warp', fallback: '⚡', note: 'Opens new tab' },
    { value: 'custom', label: 'Custom', icon: 'custom', fallback: '⚙️', note: undefined },
  ];

  const editorOptions = [
    { value: 'vscode', label: 'VS Code', icon: 'vscode', fallback: '💙' },
    { value: 'cursor', label: 'Cursor', icon: 'cursor', fallback: '🖱️' },
    { value: 'zed', label: 'Zed', icon: 'zed', fallback: '⚡' },
    { value: 'antigravity', label: 'Antigravity', icon: 'antigravity', fallback: '🚀' },
    { value: 'custom', label: 'Custom', icon: 'custom', fallback: '⚙️' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure your preferred applications for opening worktrees
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Terminal Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🖥️</span>
              <h3 className="font-medium">Terminal</h3>
            </div>

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

          <Separator />

          {/* Editor Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📝</span>
              <h3 className="font-medium">Code Editor</h3>
            </div>

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

          <Separator />

          {/* Agent Manager Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <h3 className="font-medium">Agent Manager</h3>
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
        </div>

        <DialogFooter>
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
