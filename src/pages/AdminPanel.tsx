/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useSchemaStore } from '@/stores/schemaStore';
import { useAccountStore } from '@/stores/accountStore';
import { useUIStore } from '@/stores/uiStore';
import { fetchSession, fetchSchema, fetchAccountInfo } from '@/services/jmap/client';
import { withClientLogFilters } from '@/lib/logFilters';
import { setLocale } from '@/i18n';
import { TopBar } from '@/components/layout/TopBar';
import { Sidebar } from '@/components/layout/Sidebar';
import { MainContent } from '@/components/layout/MainContent';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { LoadingFallback } from '@/components/common/LoadingFallback';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { friendlyName } from '@/hooks/useGlobalSearch';
import { AppearancePage } from '@/features/appearance/AppearancePage';
import {
  findFirstAccessibleLinkInLayout,
  findFirstVisibleLinkInLayout,
  isLinkAccessible,
  visibleLayouts,
} from '@/lib/layout';
import { usePermissions } from '@/hooks/usePermissions';
import { Loader2 } from 'lucide-react';

// Bootstrap mode is a rare first-run flow; keep it out of the main chunk.
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

  let viewName: string | undefined;
  let id: string | undefined;
  if (splat) {
    const parts = splat.split('/');
    if (parts[parts.length - 1] === 'new') {
      id = 'new';
      viewName = parts.slice(0, -1).join('/');
    } else if (parts[parts.length - 1] === 'singleton') {
      id = 'singleton';
      viewName = parts.slice(0, -1).join('/');
    } else {
      const schemaStore = useSchemaStore.getState();
      const fullAsView = parts.join('/');
      if (schemaStore.schema?.objects[fullAsView]) {
        viewName = fullAsView;
      } else if (parts.length > 1) {
        const candidateView = parts.slice(0, -1).join('/');
        if (schemaStore.schema?.objects[candidateView]) {
          viewName = candidateView;
          id = parts[parts.length - 1];
        } else {
          viewName = fullAsView;
        }
      } else {
        viewName = fullAsView;
      }
    }
  }

  const isSchemaLoaded = useSchemaStore((s) => s.isLoaded);
  const schema = useSchemaStore((s) => s.schema);
  const setSchema = useSchemaStore((s) => s.setSchema);
  const setAccountInfo = useAccountStore((s) => s.setAccountInfo);
  const edition = useAccountStore((s) => s.edition);
  const permissions = useAccountStore((s) => s.permissions);
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setActiveSection = useUIStore((s) => s.setActiveSection);
  const activeSection = useUIStore((s) => s.activeSection);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const { canViewObject } = usePermissions();

  const [initError, setInitError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(!isSchemaLoaded);

  const searchIndex = useSchemaStore((s) => s.searchIndex);

  // Tab title mirrors the sidebar label (search index) so it always matches
  // what the user sees in the navigation, e.g. "MTA-STS · Settings".
  const pageTitle = useMemo(() => {
    if (section === 'Appearance') return t('appearance.label', 'Appearance');
    if (!section) return t('dashboard.title', 'Dashboard');
    if (!viewName) return section;
    const entry =
      searchIndex.find((e) => e.type === 'link' && e.viewName === viewName && e.section === section) ??
      searchIndex.find((e) => e.type === 'link' && e.viewName === viewName);
    const base = entry?.text ?? friendlyName(viewName);
    if (id === 'new') return `${t('form.createTitle', 'Create {{name}}', { name: base })} · ${section}`;
    return `${base} · ${section}`;
  }, [section, viewName, id, searchIndex, t]);

  useDocumentTitle(pageTitle);

  useEffect(() => {
    const bypassToken = import.meta.env.VITE_ACCESS_TOKEN;
    if (bypassToken && !accessToken) {
      useAuthStore.getState().setTokens(bypassToken, '', 86400, '');
    }
  }, [accessToken]);

  useEffect(() => {
    if (isSchemaLoaded) return;

    let cancelled = false;

    async function init() {
      try {
        const session = await fetchSession();
        const accounts: Record<string, { name: string; isPersonal: boolean }> = {};
        for (const [accountId, info] of Object.entries(
          session.accounts as Record<string, { name: string; isPersonal: boolean }>,
        )) {
          accounts[accountId] = { name: info.name, isPersonal: info.isPersonal };
        }
        const primaryAccounts = session.primaryAccounts as Record<string, string>;
        const primaryAccountId =
          primaryAccounts['urn:ietf:params:jmap:core'] ?? Object.values(primaryAccounts)[0] ?? Object.keys(accounts)[0];
        const apiUrl = (session.apiUrl as string) || '/jmap';

        const capabilities = session.capabilities as Record<string, Record<string, unknown>> | undefined;
        const coreCapability = capabilities?.['urn:ietf:params:jmap:core'];
        const maxObjectsInGet =
          typeof coreCapability?.maxObjectsInGet === 'number' ? coreCapability.maxObjectsInGet : undefined;
        const maxObjectsInSet =
          typeof coreCapability?.maxObjectsInSet === 'number' ? coreCapability.maxObjectsInSet : undefined;

        if (cancelled) return;
        setSession(accounts, primaryAccountId, apiUrl, maxObjectsInGet, maxObjectsInSet);

        const [schemaData, accountData] = await Promise.all([fetchSchema(), fetchAccountInfo()]);

        if (cancelled) return;

        setSchema(withClientLogFilters(schemaData));

        setAccountInfo(accountData.permissions, accountData.edition, accountData.locale);
        setLocale(accountData.locale);

        setInitializing(false);
      } catch (err) {
        if (!cancelled) {
          console.error('Initialization failed:', err);
          setInitError(err instanceof Error ? err.message : t('errors.unexpectedError'));
          setInitializing(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [isSchemaLoaded, setSession, setSchema, setAccountInfo, t]);

  const isBootstrapMode = useMemo(() => {
    if (!schema) return false;
    if (!canViewObject('x:Bootstrap')) return false;
    // Read the permissions array directly: the store accessors are stable
    // refs, so depending on them alone would keep stale results after access
    // data finishes loading.
    const canGet = (prefix: string) => permissions.includes(`${prefix}Get`);
    const hasPerm = (perm: string) => permissions.includes(perm);
    return visibleLayouts(schema, edition, canGet, hasPerm).length === 0;
  }, [schema, canViewObject, edition, permissions]);

  useEffect(() => {
    if (!schema) return;
    if (isBootstrapMode) return;
    const canGet = (prefix: string) => permissions.includes(`${prefix}Get`);
    const hasPerm = (perm: string) => permissions.includes(perm);
    const layouts = visibleLayouts(schema, edition, canGet, hasPerm);
    const pickDefault = (): { layoutName: string; link: string | null } | null => {
      for (const layout of layouts) {
        const link = findFirstAccessibleLinkInLayout(schema, layout, edition, canGet, hasPerm);
        if (link) return { layoutName: layout.name, link };
      }
      if (layouts[0]) {
        return {
          layoutName: layouts[0].name,
          link: findFirstVisibleLinkInLayout(schema, layouts[0], edition, canGet, hasPerm),
        };
      }
      return null;
    };

    if (section && viewName && !isLinkAccessible(schema, viewName, edition, canGet, hasPerm)) {
      const fallback = pickDefault();
      if (fallback && (fallback.layoutName !== section || fallback.link !== viewName)) {
        setActiveSection(fallback.layoutName);
        if (fallback.link) {
          navigate(`/${fallback.layoutName}/${fallback.link}`, { replace: true });
        }
        return;
      }
    }

    if (section === 'Appearance') {
      // Appearance is a client-side page outside the schema layouts: keep the
      // sidebar bound to a real section while it is open.
      if (!layouts.some((l) => l.name === activeSection)) {
        setActiveSection(layouts[0]?.name ?? '');
      }
      return;
    }

    if (section) {
      if (!viewName) {
        // A section URL without a view (e.g. /Settings alone, or an unknown
        // section like /admin) should land on a real page instead of the
        // dead-end "Select a view" empty state.
        const ownLayout = layouts.find((l) => l.name.toLowerCase() === section.toLowerCase());
        if (ownLayout) {
          const link =
            findFirstAccessibleLinkInLayout(schema, ownLayout, edition, canGet, hasPerm) ??
            findFirstVisibleLinkInLayout(schema, ownLayout, edition, canGet, hasPerm);
          if (link) {
            setActiveSection(ownLayout.name);
            navigate(`/${ownLayout.name}/${link}`, { replace: true });
            return;
          }
        }
        const target = pickDefault();
        if (target) {
          setActiveSection(target.layoutName);
          if (target.link) {
            navigate(`/${target.layoutName}/${target.link}`, { replace: true });
          }
        }
        return;
      }
      setActiveSection(section);
      return;
    }

    const target = pickDefault();
    if (target) {
      setActiveSection(target.layoutName);
      if (target.link) {
        navigate(`/${target.layoutName}/${target.link}`, { replace: true });
      }
    }
  }, [
    section,
    viewName,
    activeSection,
    schema,
    setActiveSection,
    navigate,
    edition,
    permissions,
    isBootstrapMode,
  ]);

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-destructive">{t('errors.loadSchemaFailed')}</h2>
          <p className="mt-2 text-muted-foreground">{initError}</p>
          <button
            className="mt-4 rounded bg-primary px-4 py-2 text-primary-foreground hover:opacity-90"
            onClick={() => window.location.reload()}
          >
            {t('common.continue')}
          </button>
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

  // The shell is viewport-height so the main area scrolls internally through
  // the shared ScrollArea instead of scrolling the whole window.
  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <ScrollArea
          role="main"
          className={`flex-1 bg-content-background transition-[margin] ${sidebarOpen ? 'md:ml-64' : ''}`}
        >
          <div className="p-6">
            <div className="mx-auto w-full max-w-7xl">
              <ErrorBoundary>
                {section === 'Appearance' ? (
                  <AppearancePage />
                ) : (
                  <MainContent viewName={viewName} id={id} section={section} />
                )}
              </ErrorBoundary>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
