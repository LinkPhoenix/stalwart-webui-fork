/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { Moon, Palette, Sun, Square, Radius } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { COLOR_THEMES, useUIStore, type ColorTheme, type Radius as RadiusValue, type Theme } from '@/stores/uiStore';

export function ThemeSwitcher() {
  const { t } = useTranslation();
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const colorTheme = useUIStore((s) => s.colorTheme);
  const setColorTheme = useUIStore((s) => s.setColorTheme);
  const radius = useUIStore((s) => s.radius);
  const setRadius = useUIStore((s) => s.setRadius);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('appearance.label', 'Appearance')}>
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t('appearance.mode', 'Mode')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
          <DropdownMenuRadioItem value="light">
            <Sun className="mr-2 h-4 w-4" />
            {t('appearance.light', 'Light')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="mr-2 h-4 w-4" />
            {t('appearance.dark', 'Dark')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('appearance.colorTheme', 'Color theme')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={colorTheme} onValueChange={(value) => setColorTheme(value as ColorTheme)}>
          {COLOR_THEMES.map((entry) => (
            <DropdownMenuRadioItem key={entry.value} value={entry.value}>
              <span
                className="mr-2 h-3.5 w-3.5 shrink-0 rounded-full border border-border"
                style={{ background: entry.swatch }}
              />
              {t(entry.labelKey, entry.fallback)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('appearance.corners', 'Corners')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={radius} onValueChange={(value) => setRadius(value as RadiusValue)}>
          <DropdownMenuRadioItem value="rounded">
            <Radius className="mr-2 h-4 w-4" />
            {t('appearance.rounded', 'Rounded')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="square">
            <Square className="mr-2 h-4 w-4" />
            {t('appearance.square', 'Square')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
