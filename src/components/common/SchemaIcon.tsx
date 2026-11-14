import { useEffect, useState } from 'react';
import { Circle, type LucideIcon } from 'lucide-react';

import { loadLucideDynamic } from '@/lib/lucideDynamic';
import { resolveLucideIconName } from '@/lib/lucideIconName';

type LucideDynamicModule = typeof import('lucide-react/dynamic.js');

const warnedIcons = new Set<string>();

interface SchemaIconProps {
  name: string;
  className?: string;
  fallback?: LucideIcon;
  warnUnknown?: boolean;
}

export function SchemaIcon({ name, className, fallback: Fallback = Circle, warnUnknown = false }: SchemaIconProps) {
  // lucide-react/dynamic.js bundles every icon, so it is loaded on demand only:
  // until it arrives, the fallback icon is shown.
  const [lucide, setLucide] = useState<LucideDynamicModule | null>(null);

  useEffect(() => {
    let active = true;
    void loadLucideDynamic().then((mod) => {
      if (active) setLucide(mod);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!lucide) return <Fallback className={className} />;

  const iconName = resolveLucideIconName(lucide.iconNames, name);

  if (!iconName) {
    if (warnUnknown && import.meta.env.DEV && !warnedIcons.has(name)) {
      warnedIcons.add(name);
      console.warn(`Unknown icon name: "${name}"`);
    }
    return <Fallback className={className} />;
  }

  const DynamicIcon = lucide.DynamicIcon;
  return <DynamicIcon name={iconName} className={className} fallback={() => <Fallback className={className} />} />;
}
