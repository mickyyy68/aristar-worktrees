// Branch color system using existing design system chart colors
// Maps branch names to consistent colors for visual organization

// Special branch patterns get fixed colors for consistency
const BRANCH_PATTERNS: [RegExp, number][] = [
  [/^(main|master)$/, 0],
  [/^develop(ment)?$/, 1],
  [/^feature\//, 2],
  [/^(fix|bugfix|hotfix)\//, 3],
  [/^release\//, 4],
];

/**
 * Simple string hash function for consistent color assignment
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Get the color index for a branch name (0-4)
 * Returns null for detached HEAD (no branch)
 */
export function getBranchColorIndex(branchName: string | undefined): number | null {
  if (!branchName) return null; // No branch = detached HEAD (gray)

  // Check special patterns first for consistent assignment
  for (const [pattern, index] of BRANCH_PATTERNS) {
    if (pattern.test(branchName)) return index;
  }

  // Hash for consistent color per unique branch name
  return hashString(branchName) % 5;
}

export interface BranchColorStyle {
  iconBg: React.CSSProperties;
  iconText: React.CSSProperties;
  badgeBg: React.CSSProperties;
  badgeText: React.CSSProperties;
}

/**
 * Get inline styles for branch coloring using CSS variables
 * @param colorIndex - Color index from getBranchColorIndex
 * @param isMain - Whether this is the main worktree
 */
export function getBranchColorStyle(
  colorIndex: number | null,
  isMain: boolean
): BranchColorStyle {
  // Detached HEAD (from commit) - gray styling
  if (colorIndex === null) {
    return {
      iconBg: { backgroundColor: 'hsl(var(--muted) / 0.3)' },
      iconText: { color: 'hsl(var(--muted-foreground))' },
      badgeBg: { backgroundColor: 'hsl(var(--muted) / 0.3)' },
      badgeText: { color: 'hsl(var(--muted-foreground))' },
    };
  }

  // Map index to chart color variable
  const chartVar = `--chart-${colorIndex + 1}`;
  
  // Main worktree gets full opacity, others get lighter
  const bgOpacity = isMain ? 0.2 : 0.12;
  const textOpacity = isMain ? 1 : 0.85;

  return {
    iconBg: { backgroundColor: `hsl(var(${chartVar}) / ${bgOpacity})` },
    iconText: { color: `hsl(var(${chartVar}) / ${textOpacity})` },
    badgeBg: { backgroundColor: `hsl(var(${chartVar}) / ${bgOpacity})` },
    badgeText: { color: `hsl(var(${chartVar}) / ${textOpacity})` },
  };
}

/**
 * Check if a branch is a protected branch (main/master/develop)
 */
export function isProtectedBranch(branchName: string | undefined): boolean {
  if (!branchName) return false;
  const protectedBranches = ['main', 'master', 'develop', 'development'];
  return protectedBranches.includes(branchName.toLowerCase());
}
