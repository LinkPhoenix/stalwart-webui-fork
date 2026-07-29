/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/uiStore';

// Single-click light/dark toggle. Color themes and corner radius live on the
// Appearance settings page instead of a dropdown.
export function ModeToggle() {
  const { t } = useTranslation();
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      aria-label={
        theme === 'light'
          ? t('appearance.switchToDark', 'Switch to dark mode')
          : t('appearance.switchToLight', 'Switch to light mode')
      }
    >
      {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}
