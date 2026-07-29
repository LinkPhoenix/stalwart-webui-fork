/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';
type Radius = 'rounded' | 'square';

interface UIState {
  theme: Theme;
  radius: Radius;
  sidebarOpen: boolean;
  activeSection: string;

  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  toggleRadius: () => void;
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

function applyRadiusAttribute(radius: Radius) {
  document.documentElement.dataset.radius = radius;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme:
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      radius: 'rounded',
      sidebarOpen: typeof window !== 'undefined' ? (window.matchMedia?.('(min-width: 768px)').matches ?? true) : true,
      activeSection: '',

      toggleTheme: () => {
        const next = get().theme === 'light' ? 'dark' : 'light';
        applyThemeClass(next);
        set({ theme: next });
      },

      setTheme: (theme) => {
        applyThemeClass(theme);
        set({ theme });
      },

      toggleRadius: () => {
        const next = get().radius === 'rounded' ? 'square' : 'rounded';
        applyRadiusAttribute(next);
        set({ radius: next });
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
        radius: state.radius,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            applyThemeClass(state.theme);
            applyRadiusAttribute(state.radius ?? 'rounded');
          }
        };
      },
    },
  ),
);
