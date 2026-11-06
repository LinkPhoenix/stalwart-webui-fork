/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { lazy, Suspense, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useSchemaStore } from '@/stores/schemaStore';
import { useAccountStore } from '@/stores/accountStore';
import { useUIStore } from '@/stores/uiStore';
import { useSessionInit } from '@/data/session';
import { errorMessage } from '@/lib/jmapErrors';
import { TopBar } from '@/components/layout/TopBar';
import { Sidebar } from '@/components/layout/Sidebar';
import { MainContent } from '@/components/layout/MainContent';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { LoadingFallback } from '@/components/common/LoadingFallback';
import {
  findFirstVisibleLinkInLayout,
  findPreferredDefaultLinkInLayout,
  isLinkAccessible,
  layoutContainsLink,
  visibleLayouts,
} from '@/lib/layout';
import { useCanAccess, usePermissionCheckers } from '@/hooks/usePermissions';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { friendlyName } from '@/hooks/useGlobalSearch';
import { rememberLastVisited, sectionLandingLink } from '@/lib/lastVisited';
import { parseAdminRoute } from '@/lib/adminRoute';
import { resolveObject } from '@/lib/schemaResolver';
import { Button } from '@/components/ui/button';
import { OVERVIEW_VIEW_NAME } from '@/features/overview/constants';
import { OnboardingNavGate } from '@/features/onboarding/OnboardingNavGate';
import { AppearancePage } from '@/features/appearance/AppearancePage';
import { ChangelogPage } from '@/features/changelog/ChangelogPage';

const BootstrapWizard = lazy(() =>
  import('@/components/bootstrap/BootstrapWizard').then((m) => ({ default: m.BootstrapWizard })),
);

export default function AdminPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { section, '*': splat } = useParams<{
    section?: string;
    '*'?: string;
  }>();

  const schema = useSchemaStore((s) => s.schema);

  const { viewName, id } = parseAdminRoute(splat, (name) => !!schema && resolveObject(schema, name) !== null);

  const edition = useAccountStore((s) => s.edition);
  const activeAccountId = useAuthStore((s) => s.activeAccountId);
  const setActiveSection = useUIStore((s) => s.setActiveSection);
  const activeSection = useUIStore((s) => s.activeSection);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const canViewBootstrap = useCanAccess('x:Bootstrap');
  const { canGet, hasPermission: hasPerm } = usePermissionCheckers();

  const init = useSessionInit();

  const searchIndex = useSchemaStore((s) => s.searchIndex);
  const pageTitle = useMemo(() => {
    if (section === 'Appearance') return t('appearance.label', 'Appearance');
    if (section === 'Changelog') return t('changelog.label', 'Changelog');
    if (!section) return t('dashboard.title', 'Dashboard');
    if (!viewName) return section;
    let label: string | undefined;
    // SPDX-SnippetBegin
    // SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
    // SPDX-License-Identifier: LicenseRef-SEL
    if (viewName.startsWith('Dashboard/')) {
      const dashboardId = viewName.slice('Dashboard/'.length);
      label = schema?.dashboards?.find((dashboard) => dashboard.id === dashboardId)?.label;
    }
    // SPDX-SnippetEnd
    if (label === undefined) {
      for (const entry of searchIndex) {
        if (entry.type !== 'link' || entry.viewName !== viewName) continue;
        if (entry.section === section) {
          label = entry.text;
          break;
        }
        label ??= entry.text;
      }
    }
    const name = label ?? friendlyName(viewName);
    const title = id === 'new' ? t('form.createTitle', 'Create {{name}}', { name }) : name;
    return `${title} · ${section}`;
  }, [section, viewName, id, searchIndex, schema, t]);

  useDocumentTitle(pageTitle);

  const isBootstrapMode = useMemo(() => {
    if (!schema) return false;
    if (!canViewBootstrap) return false;
    return visibleLayouts(schema, canGet, hasPerm).length === 0;
  }, [schema, canViewBootstrap, canGet, hasPerm]);

  useEffect(() => {
    if (!init.isSuccess || !schema) return;
    if (isBootstrapMode) return;
    const layouts = visibleLayouts(schema, canGet, hasPerm);
    const pickDefault = (): { layoutName: string; link: string | null } | null => {
      for (const layout of layouts) {
        const link = findPreferredDefaultLinkInLayout(schema, layout, edition, canGet, hasPerm, OVERVIEW_VIEW_NAME);
        if (link) return { layoutName: layout.name, link };
      }
      if (layouts[0]) {
        return {
          layoutName: layouts[0].name,
          link: findFirstVisibleLinkInLayout(schema, layouts[0], canGet, hasPerm),
        };
      }
      return null;
    };

    const redirectTo = (layoutName: string, link: string | null) => {
      setActiveSection(layoutName);
      if (link) navigate(`/${layoutName}/${link}`, { replace: true });
    };

    if (section === 'Appearance' || section === 'Changelog') {
      // Client-side pages outside the schema layouts: keep the sidebar bound to a real section.
      if (!layouts.some((l) => l.name === activeSection)) setActiveSection(layouts[0]?.name ?? '');
      return;
    }

    if (section && viewName && !isLinkAccessible(schema, viewName, edition, canGet, hasPerm)) {
      const fallback = pickDefault();
      if (fallback && (fallback.layoutName !== section || fallback.link !== viewName)) {
        redirectTo(fallback.layoutName, fallback.link);
        return;
      }
    }

    if (section && viewName) {
      const ownLayout = layouts.find((l) => l.name.toLowerCase() === section.toLowerCase());
      setActiveSection(ownLayout?.name ?? layouts[0]?.name ?? section);
      if (ownLayout && layoutContainsLink(ownLayout, viewName)) rememberLastVisited(ownLayout.name, viewName);
      return;
    }

    if (section) {
      const ownLayout = layouts.find((l) => l.name.toLowerCase() === section.toLowerCase());
      const ownLink = ownLayout ? sectionLandingLink(schema, ownLayout, edition, canGet, hasPerm) : null;
      if (ownLayout && ownLink) {
        redirectTo(ownLayout.name, ownLink);
      } else {
        const target = pickDefault();
        if (target) redirectTo(target.layoutName, target.link);
      }
      return;
    }

    const target = pickDefault();
    if (target) redirectTo(target.layoutName, target.link);
  }, [
    init.isSuccess,
    section,
    viewName,
    schema,
    setActiveSection,
    navigate,
    edition,
    canGet,
    hasPerm,
    isBootstrapMode,
    activeSection,
  ]);

  if (init.isPending) {
    return <LoadingFallback fullScreen />;
  }

  if (init.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div role="alert" className="text-center">
          <h1 className="page-title text-destructive">{t('errors.loadSchemaFailed')}</h1>
          <p className="mt-2 text-muted-foreground">{errorMessage(init.error)}</p>
          <Button className="mt-4" onClick={() => void init.refetch()} disabled={init.isFetching}>
            {t('common.retry', 'Retry')}
          </Button>
        </div>
      </div>
    );
  }

  if (!schema) return null;

  if (isBootstrapMode) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback fullScreen />}>
          <BootstrapWizard />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <OnboardingNavGate />
      <TopBar />
      <div className="flex flex-1">
        <Sidebar />
        <main
          className={`min-w-0 flex-1 px-3 pb-28 pt-2 transition-[margin] sm:px-5 ${sidebarOpen ? 'md:ml-[252px]' : ''}`}
        >
          <ErrorBoundary key={activeAccountId ?? 'none'}>
            {section === 'Appearance' ? (
              <AppearancePage />
            ) : section === 'Changelog' ? (
              <ChangelogPage />
            ) : (
              <MainContent viewName={viewName} id={id} section={section} />
            )}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
