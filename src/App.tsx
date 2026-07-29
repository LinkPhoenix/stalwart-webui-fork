/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { LoadingFallback } from '@/components/common/LoadingFallback';
import { Toaster } from '@/components/ui/toaster';

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback fullScreen />}>
        <Outlet />
      </Suspense>
      <Toaster />
    </ErrorBoundary>
  );
}
