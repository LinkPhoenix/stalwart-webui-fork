import type { IconName } from 'lucide-react/dynamic.js';

/** Resolve schema icon strings in kebab-case or PascalCase to Lucide's names. */
export function resolveLucideIconName(
  supportedNames: ReadonlySet<string> | readonly string[],
  name: string,
): IconName | null {
  const supported = supportedNames instanceof Set ? supportedNames : new Set(supportedNames);
  const normalized = name
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();

  return supported.has(normalized) ? (normalized as IconName) : null;
}
