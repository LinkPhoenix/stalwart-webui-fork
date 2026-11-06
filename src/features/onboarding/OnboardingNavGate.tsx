/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAccountStore } from '@/stores/accountStore';
import { useSchemaStore } from '@/stores/schemaStore';
import { useUIStore } from '@/stores/uiStore';
import {
  findFirstAccessibleLinkInLayout,
  findFirstVisibleLinkInLayout,
  visibleLayouts,
} from '@/lib/layout';
import { isOnboardingComplete, ONBOARDING_VIEW_NAME } from '@/features/onboarding/checklist';

/**
 * SCHEMA-DEVIATION: onboarding-checklist-nav-entry (see SCHEMA_DEVIATIONS.md)
 *
 * Getting Started stays out of the nav until we know the checklist is still
 * useful. If every required step is done, keep it hidden (and leave the page
 * if the user is still on it). If anything remains, splice the nav entry in.
 * That avoids the flash of "appear then disappear" on completed installs.
 */
export function OnboardingNavGate() {
  const navigate = useNavigate();
  const { section, '*': splat } = useParams<{ section?: string; '*': string }>();
  const hasObjectPermission = useAccountStore((s) => s.hasObjectPermission);
  const permissions = useAccountStore((s) => s.permissions);
  const edition = useAccountStore((s) => s.edition);
  const showOnboardingNav = useSchemaStore((s) => s.showOnboardingNav);
  const hideOnboardingNav = useSchemaStore((s) => s.hideOnboardingNav);
  const isSchemaLoaded = useSchemaStore((s) => s.isLoaded);
  const setActiveSection = useUIStore((s) => s.setActiveSection);

  const onOnboardingPage =
    splat === ONBOARDING_VIEW_NAME || splat?.startsWith(`${ONBOARDING_VIEW_NAME}/`) === true;

  useEffect(() => {
    if (!isSchemaLoaded) return;

    let cancelled = false;

    void isOnboardingComplete((prefix) => hasObjectPermission(prefix, 'Query')).then((complete) => {
      if (cancelled) return;

      if (!complete) {
        showOnboardingNav();
        return;
      }

      hideOnboardingNav();

      if (!onOnboardingPage) return;

      const schema = useSchemaStore.getState().schema;
      if (!schema) return;

      const canGet = (prefix: string) => permissions.includes(`${prefix}Get`);
      const hasPerm = (perm: string) => permissions.includes(perm);
      const layouts = visibleLayouts(schema, canGet, hasPerm);

      for (const layout of layouts) {
        const link =
          findFirstAccessibleLinkInLayout(schema, layout, edition, canGet, hasPerm) ??
          findFirstVisibleLinkInLayout(schema, layout, canGet, hasPerm);
        if (!link || link === ONBOARDING_VIEW_NAME) continue;
        setActiveSection(layout.name);
        navigate(`/${layout.name}/${link}`, { replace: true });
        return;
      }

      if (section) {
        navigate(`/${section}`, { replace: true });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    isSchemaLoaded,
    hasObjectPermission,
    showOnboardingNav,
    hideOnboardingNav,
    onOnboardingPage,
    permissions,
    edition,
    setActiveSection,
    navigate,
    section,
  ]);

  return null;
}
