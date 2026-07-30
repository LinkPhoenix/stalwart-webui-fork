/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getApiBaseUrl } from '@/services/api';

export type Theme = 'light' | 'dark';
export type ColorTheme = 'stalwart' | 'ocean' | 'forest' | 'violet';
export type Radius = 'rounded' | 'square';

let logoAbortController: AbortController | null = null;
let logoObjectUrl: string | null = null;

function revokeLogoObjectUrl() {
  if (logoObjectUrl) {
    URL.revokeObjectURL(logoObjectUrl);
    logoObjectUrl = null;
  }
}

interface UIState {
  theme: Theme;
  colorTheme: ColorTheme;
  radius: Radius;
  sidebarOpen: boolean;
  activeSection: string;
  logoUrl: string | null;
  logoLoading: boolean;

  setTheme: (theme: Theme) => void;
  setColorTheme: (colorTheme: ColorTheme) => void;
  setRadius: (radius: Radius) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveSection: (section: string) => void;
  setLogoUrl: (url: string | null) => void;
  setLogoLoading: (loading: boolean) => void;
  fetchLogo: () => void;
}

function applyThemeClass(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function applyColorThemeAttribute(colorTheme: ColorTheme) {
  // The default theme is defined directly on :root/.dark, so it needs no attribute.
  if (colorTheme === 'stalwart') {
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
    value: 'stalwart',
    labelKey: 'appearance.theme.stalwart',
    fallback: 'Stalwart',
    swatch: 'linear-gradient(135deg, oklch(0.205 0.017 285.823) 50%, oklch(0.92 0.007 285.823) 50%)',
  },
  { value: 'ocean', labelKey: 'appearance.theme.ocean', fallback: 'Ocean', swatch: 'oklch(0.546 0.215 262.9)' },
  { value: 'forest', labelKey: 'appearance.theme.forest', fallback: 'Forest', swatch: 'oklch(0.527 0.137 150.1)' },
  { value: 'violet', labelKey: 'appearance.theme.violet', fallback: 'Violet', swatch: 'oklch(0.541 0.281 293)' },
];

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme:
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      colorTheme: 'stalwart',
      radius: 'rounded',
      sidebarOpen: typeof window !== 'undefined' ? (window.matchMedia?.('(min-width: 768px)').matches ?? true) : true,
      activeSection: '',
      logoUrl: null,
      logoLoading: false,

      setLogoUrl: (url) => {
        revokeLogoObjectUrl();
        if (url) {
          logoObjectUrl = url;
        }
        set({ logoUrl: url, logoLoading: false });
      },

      setLogoLoading: (loading) => {
        set({ logoLoading: loading });
      },

      fetchLogo: () => {
        const { logoUrl, logoLoading } = get();
        if (logoUrl !== null || logoLoading) return;

        set({ logoLoading: true });
        if (logoAbortController) {
          logoAbortController.abort();
        }
        logoAbortController = new AbortController();

        fetch(`${getApiBaseUrl()}/logo`, {
          signal: logoAbortController.signal,
        })
          .then((response) => {
            const contentType = response.headers.get('content-type') ?? '';
            if (response.ok && contentType.startsWith('image/')) {
              return response.blob().then((blob) => {
                revokeLogoObjectUrl();
                logoObjectUrl = URL.createObjectURL(blob);
                set({ logoUrl: logoObjectUrl, logoLoading: false });
              });
            }
            set({ logoUrl: null, logoLoading: false });
          })
          .catch(() => {
            set({ logoUrl: null, logoLoading: false });
          });
      },

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
            applyColorThemeAttribute(state.colorTheme ?? 'stalwart');
            applyRadiusAttribute(state.radius ?? 'rounded');
          }
        };
      },
    },
  ),
);
