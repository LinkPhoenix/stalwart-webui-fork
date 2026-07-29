/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { lazy, Suspense, useEffect } from 'react';
import { useSchemaStore } from '@/stores/schemaStore';
import { useCacheStore } from '@/stores/cacheStore';
import { useAccountStore } from '@/stores/accountStore';
import { resolveObject } from '@/lib/schemaResolver';
import { DynamicList } from '@/components/lists/DynamicList';
import { DynamicForm } from '@/components/forms/DynamicForm';
import { DynamicViewPage } from '@/components/views/DynamicViewPage';
import { LoadingFallback } from '@/components/common/LoadingFallback';

// Heavy or rarely used feature pages are code-split so the initial bundle
// stays small (the dashboard pulls in recharts, ~150 kB gzipped on its own).
const DashboardView = lazy(() =>
  import('@/features/dashboard/components/DashboardView').then((m) => ({ default: m.DashboardView })),
);
const DeliveryTracePage = lazy(() =>
  import('@/features/troubleshoot/DeliveryTracePage').then((m) => ({ default: m.DeliveryTracePage })),
);
const LiveTracingPage = lazy(() =>
  import('@/features/tracing/components/LiveTracingPage').then((m) => ({ default: m.LiveTracingPage })),
);
const TraceDetailView = lazy(() =>
  import('@/features/tracing/components/TraceDetailView').then((m) => ({ default: m.TraceDetailView })),
);
const ActionPage = lazy(() => import('@/features/actions/ActionPage').then((m) => ({ default: m.ActionPage })));

interface MainContentProps {
  viewName?: string;
  id?: string;
  section?: string;
}

export function MainContent({ viewName, id, section }: MainContentProps) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <MainContentView viewName={viewName} id={id} section={section} />
    </Suspense>
  );
}

function MainContentView({ viewName, id, section }: MainContentProps) {
  const schema = useSchemaStore((s) => s.schema);
  const invalidateAllObjectLists = useCacheStore((s) => s.invalidateAllObjectLists);

  useEffect(() => {
    invalidateAllObjectLists();
  }, [viewName, invalidateAllObjectLists]);

  if (!viewName) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">Select a view from the sidebar.</div>
    );
  }

  if (viewName.startsWith('Dashboard/')) {
    const dashboardId = viewName.slice('Dashboard/'.length);
    return <DashboardView dashboardId={dashboardId} section={section ?? ''} />;
  }

  if (viewName.startsWith('CustomComponent/')) {
    const componentName = viewName.slice('CustomComponent/'.length);
    if (componentName === 'Dashboard') {
      const firstId = schema?.dashboards?.[0]?.id ?? 'overview';
      return <DashboardView dashboardId={firstId} section={section ?? ''} />;
    }
    if (componentName === 'LiveDelivery') {
      return <DeliveryTracePage />;
    }
    if (componentName === 'LiveTracing') {
      return <LiveTracingPage />;
    }
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        Unknown component: {componentName}
      </div>
    );
  }

  if (!schema) {
    return <div className="flex items-center justify-center p-8 text-muted-foreground">Loading...</div>;
  }

  const resolved = resolveObject(schema, viewName);
  if (!resolved) {
    return <div className="flex items-center justify-center p-8 text-destructive">Unknown view: {viewName}</div>;
  }

  if (resolved.objectName === 'x:Action') {
    return <ActionPage viewName={viewName} />;
  }

  if (resolved.objectType.type === 'singleton') {
    return <DynamicForm viewName={viewName} objectId="singleton" />;
  }

  if (id === 'new') {
    return <DynamicForm viewName={viewName} objectId={null} />;
  }

  if (id) {
    if (resolved.objectName === 'x:Trace' && id !== 'new') {
      return <TraceDetailView viewName={viewName} objectId={id} />;
    }
    const canUpdate = useAccountStore.getState().hasObjectPermission(resolved.permissionPrefix, 'Update');
    if (!canUpdate) {
      return <DynamicViewPage viewName={viewName} objectId={id} />;
    }
    return <DynamicForm viewName={viewName} objectId={id} />;
  }

  return <DynamicList viewName={viewName} />;
}
