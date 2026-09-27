import { iconNames, type IconName } from 'lucide-react/dynamic.js';

const supportedIconNames = new Set<string>(iconNames);

/** Resolve schema icon strings in kebab-case or PascalCase to Lucide's names. */
export function resolveLucideIconName(name: string): IconName | null {
  const normalized = name
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();

  return supportedIconNames.has(normalized) ? (normalized as IconName) : null;
}
