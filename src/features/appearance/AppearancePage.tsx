/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Moon, Sun } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { COLOR_THEMES, useUIStore } from '@/stores/uiStore';

/** Matches `:root { --radius: 0.5rem }` so only the Rounded choice stays curved in square mode. */
const ROUNDED_RADIUS_STYLE = { '--radius': '0.5rem' } as CSSProperties;

export function AppearancePage() {
  const { t } = useTranslation();
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const colorTheme = useUIStore((s) => s.colorTheme);
  const setColorTheme = useUIStore((s) => s.setColorTheme);
  const radius = useUIStore((s) => s.radius);
  const setRadius = useUIStore((s) => s.setRadius);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('appearance.label', 'Appearance')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('appearance.description', 'Customize how the interface looks and feels.')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('appearance.mode', 'Mode')}</CardTitle>
          <CardDescription>{t('appearance.modeDescription', 'Switch between light and dark mode.')}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <OptionCard
            selected={theme === 'light'}
            onClick={() => setTheme('light')}
            label={t('appearance.light', 'Light')}
          >
            <Sun className="h-5 w-5" />
          </OptionCard>
          <OptionCard selected={theme === 'dark'} onClick={() => setTheme('dark')} label={t('appearance.dark', 'Dark')}>
            <Moon className="h-5 w-5" />
          </OptionCard>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('appearance.colorTheme', 'Color theme')}</CardTitle>
          <CardDescription>
            {t('appearance.colorThemeDescription', 'Pick the accent color used across the interface.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {COLOR_THEMES.map((entry) => (
            <OptionCard
              key={entry.value}
              selected={colorTheme === entry.value}
              onClick={() => setColorTheme(entry.value)}
              label={t(entry.labelKey, entry.fallback)}
            >
              <span className="h-6 w-6 rounded-full border border-border" style={{ background: entry.swatch }} />
            </OptionCard>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('appearance.corners', 'Corners')}</CardTitle>
          <CardDescription>
            {t('appearance.cornersDescription', 'Choose between rounded and square corners. Applies to every theme.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <OptionCard
            selected={radius === 'rounded'}
            onClick={() => setRadius('rounded')}
            label={t('appearance.rounded', 'Rounded')}
            style={ROUNDED_RADIUS_STYLE}
          >
            <span className="h-6 w-10 rounded-md border-2 border-current" />
          </OptionCard>
          <OptionCard
            selected={radius === 'square'}
            onClick={() => setRadius('square')}
            label={t('appearance.square', 'Square')}
            className="rounded-none"
          >
            <span className="h-6 w-10 rounded-none border-2 border-current" />
          </OptionCard>
        </CardContent>
      </Card>
    </div>
  );
}

function OptionCard({
  selected,
  onClick,
  label,
  children,
  className,
  style,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={style}
      className={cn(
        'relative flex flex-col items-center gap-2 rounded-lg border bg-field p-4 text-sm transition-colors',
        selected
          ? 'border-primary text-foreground'
          : 'border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        className,
      )}
    >
      {selected && <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />}
      {children}
      <span>{label}</span>
    </button>
  );
}
