import { Circle, type LucideIcon } from 'lucide-react';
import { DynamicIcon } from 'lucide-react/dynamic.js';
import { resolveLucideIconName } from '@/lib/lucideIconName';

const warnedIcons = new Set<string>();

interface SchemaIconProps {
  name: string;
  className?: string;
  fallback?: LucideIcon;
  warnUnknown?: boolean;
}

export function SchemaIcon({ name, className, fallback: Fallback = Circle, warnUnknown = false }: SchemaIconProps) {
  const iconName = resolveLucideIconName(name);

  if (!iconName) {
    if (warnUnknown && import.meta.env.DEV && !warnedIcons.has(name)) {
      warnedIcons.add(name);
      console.warn(`Unknown icon name: "${name}"`);
    }
    return <Fallback className={className} />;
  }

  return <DynamicIcon name={iconName} className={className} fallback={() => <Fallback className={className} />} />;
}
