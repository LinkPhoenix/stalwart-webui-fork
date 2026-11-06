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
import { ensureLogoLoaded } from './lib/logoCache';
import { applyAccessTokenOverride } from './stores/authStore';
import { QueryProvider } from './data/QueryProvider';
import { bindQueryClientToAuth, queryClient } from './data/queryClient';

(() => {
  try {
    const persisted = localStorage.getItem('stalwart-ui');
    if (persisted) {
      const parsed = JSON.parse(persisted);
      const theme = parsed?.state?.theme;
      if (theme === 'dark' || theme === 'light') {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        return;
      }
    }
    // eslint-disable-next-line no-empty
  } catch {}
  // Dark is the default when the user has not chosen a theme yet.
  document.documentElement.classList.add('dark');
})();

ensureLogoLoaded();
applyAccessTokenOverride();
bindQueryClientToAuth(queryClient);

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
    <QueryProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryProvider>
  </StrictMode>,
);
