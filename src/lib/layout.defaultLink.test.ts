/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { describe, expect, it } from 'vitest';
import type { Layout, Schema } from '@/types/schema';
import { findPreferredDefaultLinkInLayout } from '@/lib/layout';

function schemaWithLinks(): Schema {
  return {
    // The Dashboard link is only visible when its backing object exists in the schema.
    objects: { 'x:Metric': { type: 'object', description: 'Metric', permissionPrefix: 'Metric' } },
    schemas: {},
    fields: {},
    forms: {},
    lists: {},
    enums: {},
    dashboards: [{ id: 'overview', name: 'Overview', cards: [], charts: [] } as never],
    layouts: [],
  };
}

describe('findPreferredDefaultLinkInLayout', () => {
  const layout: Layout = {
    name: 'Management',
    icon: 'home',
    items: [
      { link: { name: 'Dashboard', icon: 'gauge', viewName: 'CustomComponent/Dashboard' } },
      { link: { name: 'Getting Started', icon: 'rocket', viewName: 'CustomComponent/Onboarding' } },
      { link: { name: 'Overview', icon: 'panels-top-left', viewName: 'CustomComponent/Overview' } },
      { link: { name: 'Domains', icon: 'globe', viewName: 'x:Domain' } },
    ],
  };

  it('prefers Overview when Dashboard is not accessible (community)', () => {
    const schema = schemaWithLinks();
    // CustomComponent/* is visible; Dashboard is enterprise → inaccessible on community
    const link = findPreferredDefaultLinkInLayout(
      schema,
      layout,
      'community',
      () => true,
      () => false,
    );
    expect(link).toBe('CustomComponent/Overview');
  });

  it('keeps first accessible link when Dashboard is usable (enterprise + perms)', () => {
    const schema = schemaWithLinks();
    const link = findPreferredDefaultLinkInLayout(
      schema,
      layout,
      'enterprise',
      () => true,
      (perm) => perm === 'liveMetrics',
    );
    expect(link).toBe('CustomComponent/Dashboard');
  });
});
