/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';
export type ColorTheme = 'default' | 'stalwart' | 'ocean' | 'forest' | 'violet' | 'rose' | 'amber' | 'teal';
export type Radius = 'rounded' | 'square';

interface UIState {
  theme: Theme;
  colorTheme: ColorTheme;
  radius: Radius;
  sidebarOpen: boolean;
  activeSection: string;

  setTheme: (theme: Theme) => void;
  setColorTheme: (colorTheme: ColorTheme) => void;
  setRadius: (radius: Radius) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveSection: (section: string) => void;
}

function applyThemeClass(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function applyColorThemeAttribute(colorTheme: ColorTheme) {
  // The neutral "Default" theme is defined directly on :root/.dark, so it needs no attribute.
  if (colorTheme === 'default') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.dataset.theme = colorTheme;
  }
}

function applyRadiusAttribute(radius: Radius) {
  document.documentElement.dataset.radius = radius;
}

export const COLOR_THEMES: { value: ColorTheme; labelKey: string; fallback: string; swatch: string }[] = [
  {
    value: 'default',
    labelKey: 'appearance.theme.default',
    fallback: 'Default',
    swatch: 'linear-gradient(135deg, oklch(0.205 0.017 285.823) 50%, oklch(0.92 0.007 285.823) 50%)',
  },
  {
    value: 'stalwart',
    labelKey: 'appearance.theme.stalwart',
    fallback: 'Stalwart',
    swatch: 'oklch(0.586 0.207 14.6)',
  },
  { value: 'ocean', labelKey: 'appearance.theme.ocean', fallback: 'Ocean', swatch: 'oklch(0.546 0.215 262.9)' },
  { value: 'forest', labelKey: 'appearance.theme.forest', fallback: 'Forest', swatch: 'oklch(0.527 0.137 150.1)' },
  { value: 'violet', labelKey: 'appearance.theme.violet', fallback: 'Violet', swatch: 'oklch(0.541 0.281 293)' },
  { value: 'rose', labelKey: 'appearance.theme.rose', fallback: 'Rose', swatch: 'oklch(0.577 0.245 12)' },
  { value: 'amber', labelKey: 'appearance.theme.amber', fallback: 'Amber', swatch: 'oklch(0.65 0.16 70)' },
  { value: 'teal', labelKey: 'appearance.theme.teal', fallback: 'Teal', swatch: 'oklch(0.55 0.13 195)' },
];

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme:
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      colorTheme: 'ocean',
      radius: 'square',
      sidebarOpen: typeof window !== 'undefined' ? (window.matchMedia?.('(min-width: 768px)').matches ?? true) : true,
      activeSection: '',

      setTheme: (theme) => {
        applyThemeClass(theme);
        set({ theme });
      },

      setColorTheme: (colorTheme) => {
        applyColorThemeAttribute(colorTheme);
        set({ colorTheme });
      },

      setRadius: (radius) => {
        applyRadiusAttribute(radius);
        set({ radius });
      },

      toggleSidebar: () => {
        set({ sidebarOpen: !get().sidebarOpen });
      },

      setSidebarOpen: (open) => {
        set({ sidebarOpen: open });
      },

      setActiveSection: (section) => {
        set({ activeSection: section });
      },
    }),
    {
      name: 'stalwart-ui',
      partialize: (state) => ({
        theme: state.theme,
        colorTheme: state.colorTheme,
        radius: state.radius,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            applyThemeClass(state.theme);
            applyColorThemeAttribute(state.colorTheme ?? 'ocean');
            applyRadiusAttribute(state.radius ?? 'square');
          }
        };
      },
    },
  ),
);
