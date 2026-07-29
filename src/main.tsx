/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './i18n';
import './index.css';
import App from './App';
import LoginPage from './pages/LoginPage';
import OAuthCallback from './pages/OAuthCallback';
import NotFound from './pages/NotFound';
import { AdminPanel } from './pages/AdminPanel.lazy';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { getBasePath } from './lib/basePath';

(() => {
  try {
    const persisted = localStorage.getItem('stalwart-ui');
    const state = persisted ? (JSON.parse(persisted)?.state ?? null) : null;
    const theme = state?.theme;
    const dark = theme === 'dark' || (theme !== 'light' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    const colorTheme = state?.colorTheme;
    if (colorTheme === 'ocean' || colorTheme === 'forest' || colorTheme === 'violet') {
      document.documentElement.dataset.theme = colorTheme;
    }
    if (state?.radius === 'square') {
      document.documentElement.dataset.radius = 'square';
    }
    // eslint-disable-next-line no-empty
  } catch {}
})();

const basePath = getBasePath();

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      errorElement: <NotFound />,
      children: [
        { path: 'login', element: <LoginPage /> },
        { path: 'oauth/callback', element: <OAuthCallback /> },
        {
          path: ':section/*',
          element: (
            <ProtectedRoute>
              <AdminPanel />
            </ProtectedRoute>
          ),
        },
        {
          index: true,
          element: (
            <ProtectedRoute>
              <AdminPanel />
            </ProtectedRoute>
          ),
        },
      ],
    },
  ],
  { basename: basePath },
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
