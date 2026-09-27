/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { getDevelopmentAccessToken } from '@/lib/devAccessToken';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const authenticated = useAuthStore((s) => s.isAuthenticated());
  const bypassToken = getDevelopmentAccessToken(import.meta.env.DEV, import.meta.env.VITE_ACCESS_TOKEN);
  const location = useLocation();
  if (!authenticated && !bypassToken) {
    const originalPath = location.pathname + location.search;
    return <Navigate to="/login" replace state={{ from: originalPath }} />;
  }
  return <>{children}</>;
}
