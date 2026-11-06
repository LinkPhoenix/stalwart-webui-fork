/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useSchemaStore } from '@/stores/schemaStore';
import { usePermissionCheckers } from '@/hooks/usePermissions';
import { resolveObject } from '@/lib/schemaResolver';
import type { PermissionCheckers } from '@/lib/permissions';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { DynamicList } from '@/components/lists/DynamicList';
import { DynamicForm } from '@/components/forms/DynamicForm';
import { DynamicViewPage } from '@/components/views/DynamicViewPage';
import { LoadingFallback } from '@/components/common/LoadingFallback';
import type { Schema } from '@/types/schema';

function lazyFeature<M, P>(load: () => Promise<M>, select: (module: M) => ComponentType<P>) {
  return lazy(() => load().then((module) => ({ default: select(module) })));
}

const DeliveryTracePage = lazyFeature(
  () => import('@/features/troubleshoot/DeliveryTracePage'),
  (m) => m.DeliveryTracePage,
);
// SPDX-SnippetBegin
// SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
// SPDX-License-Identifier: LicenseRef-SEL
const DashboardView = lazyFeature(
  () => import('@/features/dashboard/components/DashboardView'),
  (m) => m.DashboardView,
);
const LiveTracingPage = lazyFeature(
  () => import('@/features/tracing/components/LiveTracingPage'),
  (m) => m.LiveTracingPage,
);
const TraceDetailView = lazyFeature(
  () => import('@/features/tracing/components/TraceDetailView'),
  (m) => m.TraceDetailView,
);
// SPDX-SnippetEnd
const OnboardingChecklistPage = lazyFeature(
  () => import('@/features/onboarding/OnboardingChecklistPage'),
  (m) => m.OnboardingChecklistPage,
);
const OverviewPage = lazyFeature(
  () => import('@/features/overview/OverviewPage'),
  (m) => m.OverviewPage,
);
const ActionPage = lazyFeature(
  () => import('@/features/actions/ActionPage'),
  (m) => m.ActionPage,
);

interface MainContentProps {
  viewName?: string;
  id?: string;
  section?: string;
}

export function MainContent({ viewName, id, section }: MainContentProps) {
  const schema = useSchemaStore((s) => s.schema);
  const permissions = usePermissionCheckers();
  const location = useLocation();
  const { t } = useTranslation();
  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<LoadingFallback />}>{renderView(t, schema, permissions, viewName, id, section)}</Suspense>
    </ErrorBoundary>
  );
}

function renderView(
  t: TFunction,
  schema: Schema | null,
  permissions: PermissionCheckers,
  viewName?: string,
  id?: string,
  section?: string,
): ReactNode {
  if (!viewName) {
    return <LoadingFallback />;
  }

  // SPDX-SnippetBegin
  // SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
  // SPDX-License-Identifier: LicenseRef-SEL
  if (viewName.startsWith('Dashboard/')) {
    const dashboardId = viewName.slice('Dashboard/'.length);
    return <DashboardView dashboardId={dashboardId} section={section ?? ''} />;
  }
  // SPDX-SnippetEnd

  if (viewName.startsWith('CustomComponent/')) {
    const componentName = viewName.slice('CustomComponent/'.length);
    // SPDX-SnippetBegin
    // SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
    // SPDX-License-Identifier: LicenseRef-SEL
    if (componentName === 'Dashboard') {
      const firstId = schema?.dashboards?.[0]?.id ?? 'overview';
      return <DashboardView dashboardId={firstId} section={section ?? ''} />;
    }
    // SPDX-SnippetEnd
    if (componentName === 'LiveDelivery') {
      return <DeliveryTracePage />;
    }
    // SPDX-SnippetBegin
    // SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
    // SPDX-License-Identifier: LicenseRef-SEL
    if (componentName === 'LiveTracing') {
      return <LiveTracingPage />;
    }
    // SPDX-SnippetEnd
    if (componentName === 'Onboarding') {
      return <OnboardingChecklistPage />;
    }
    if (componentName === 'Overview') {
      return <OverviewPage />;
    }
    return (
      <div className="mt-3 rounded-2xl bg-muted p-10 text-center text-muted-foreground">
        {t('errors.unknownComponent', 'Unknown component: {{name}}', { name: componentName })}
      </div>
    );
  }

  if (!schema) {
    return <LoadingFallback />;
  }

  const resolved = resolveObject(schema, viewName);
  if (!resolved) {
    return (
      <div role="alert" className="mt-3 rounded-xl bg-destructive-soft p-4 text-center text-sm text-destructive">
        {t('errors.unknownView', 'Unknown view: {{name}}', { name: viewName })}
      </div>
    );
  }

  if (resolved.objectName === 'x:Action') {
    return <ActionPage key={viewName} viewName={viewName} />;
  }

  if (resolved.objectType.type === 'singleton') {
    return <DynamicForm key={`${viewName}/singleton`} viewName={viewName} objectId="singleton" />;
  }

  if (id === 'new') {
    return <DynamicForm key={`${viewName}/new`} viewName={viewName} objectId={null} />;
  }

  if (id) {
    // SPDX-SnippetBegin
    // SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
    // SPDX-License-Identifier: LicenseRef-SEL
    if (resolved.objectName === 'x:Trace') {
      return <TraceDetailView key={`${viewName}/${id}`} viewName={viewName} objectId={id} />;
    }
    // SPDX-SnippetEnd
    if (!permissions.hasObjectPermission(resolved.permissionPrefix, 'Update')) {
      return <DynamicViewPage key={`${viewName}/${id}`} viewName={viewName} objectId={id} />;
    }
    return <DynamicForm key={`${viewName}/${id}`} viewName={viewName} objectId={id} />;
  }

  return <DynamicList key={viewName} viewName={viewName} />;
}
