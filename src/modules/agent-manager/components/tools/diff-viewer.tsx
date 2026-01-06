import { useState, useMemo } from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { Plus, Minus, Columns, AlignJustify } from 'lucide-react';
import { cn } from '@core/lib/utils';
import type { FileDiff } from '../../api/opencode-types';

interface DiffViewerProps {
  diff: FileDiff;
  defaultSplitView?: boolean;
}

export function DiffViewer({ diff, defaultSplitView = false }: DiffViewerProps) {
  const [splitView, setSplitView] = useState(defaultSplitView);

  // Custom styles using CSS variables for theme compatibility
  const styles = useMemo(
    () => ({
      variables: {
        light: {
          diffViewerBackground: 'hsl(var(--background))',
          diffViewerColor: 'hsl(var(--foreground))',
          addedBackground: 'hsl(142 76% 36% / 0.15)',
          addedColor: 'hsl(142 76% 36%)',
          removedBackground: 'hsl(0 84% 60% / 0.15)',
          removedColor: 'hsl(0 84% 60%)',
          wordAddedBackground: 'hsl(142 76% 36% / 0.3)',
          wordRemovedBackground: 'hsl(0 84% 60% / 0.3)',
          addedGutterBackground: 'hsl(142 76% 36% / 0.2)',
          removedGutterBackground: 'hsl(0 84% 60% / 0.2)',
          gutterBackground: 'hsl(var(--muted))',
          gutterBackgroundDark: 'hsl(var(--muted))',
          highlightBackground: 'hsl(var(--accent))',
          highlightGutterBackground: 'hsl(var(--accent))',
          codeFoldGutterBackground: 'hsl(var(--muted))',
          codeFoldBackground: 'hsl(var(--muted))',
          emptyLineBackground: 'hsl(var(--muted))',
          codeFoldContentColor: 'hsl(var(--muted-foreground))',
        },
        dark: {
          diffViewerBackground: 'hsl(var(--background))',
          diffViewerColor: 'hsl(var(--foreground))',
          addedBackground: 'hsl(142 76% 36% / 0.15)',
          addedColor: 'hsl(142 76% 60%)',
          removedBackground: 'hsl(0 84% 60% / 0.15)',
          removedColor: 'hsl(0 84% 70%)',
          wordAddedBackground: 'hsl(142 76% 36% / 0.3)',
          wordRemovedBackground: 'hsl(0 84% 60% / 0.3)',
          addedGutterBackground: 'hsl(142 76% 36% / 0.2)',
          removedGutterBackground: 'hsl(0 84% 60% / 0.2)',
          gutterBackground: 'hsl(var(--muted))',
          gutterBackgroundDark: 'hsl(var(--muted))',
          highlightBackground: 'hsl(var(--accent))',
          highlightGutterBackground: 'hsl(var(--accent))',
          codeFoldGutterBackground: 'hsl(var(--muted))',
          codeFoldBackground: 'hsl(var(--muted))',
          emptyLineBackground: 'hsl(var(--muted))',
          codeFoldContentColor: 'hsl(var(--muted-foreground))',
        },
      },
      line: {
        padding: '4px 8px',
        fontSize: '12px',
        fontFamily: 'var(--font-mono)',
      },
      gutter: {
        padding: '0 8px',
        minWidth: '40px',
      },
      contentText: {
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
      },
    }),
    []
  );

  return (
    <div className="mt-2 space-y-2">
      {/* Header with stats and view toggle */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <Plus className="h-3 w-3" />
            {diff.additions} addition{diff.additions !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <Minus className="h-3 w-3" />
            {diff.deletions} deletion{diff.deletions !== 1 ? 's' : ''}
          </span>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-md border bg-muted/50 p-0.5">
          <button
            onClick={() => setSplitView(false)}
            className={cn(
              'rounded px-2 py-1 text-xs transition-colors',
              !splitView
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="Unified view"
          >
            <AlignJustify className="h-3 w-3" />
          </button>
          <button
            onClick={() => setSplitView(true)}
            className={cn(
              'rounded px-2 py-1 text-xs transition-colors',
              splitView
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="Split view"
          >
            <Columns className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Diff viewer */}
      <div className="overflow-hidden rounded-md border">
        <ReactDiffViewer
          oldValue={diff.before}
          newValue={diff.after}
          splitView={splitView}
          compareMethod={DiffMethod.WORDS}
          styles={styles}
          useDarkTheme={document.documentElement.classList.contains('dark')}
          showDiffOnly={true}
          extraLinesSurroundingDiff={3}
        />
      </div>
    </div>
  );
}
