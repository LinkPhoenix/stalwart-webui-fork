/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { create } from 'zustand';
import { layoutViewFor } from '@/lib/layout';
import type { Schema, LayoutSubItem, LayoutItem } from '@/types/schema';

import { ONBOARDING_VIEW_NAME } from '@/features/onboarding/checklist';
import { OVERVIEW_VIEW_NAME } from '@/features/overview/constants';

// SCHEMA-DEVIATION: onboarding-checklist-nav-entry (see SCHEMA_DEVIATIONS.md)
//
// The sidebar is entirely server-driven (schema.layouts) — there's no
// mechanism for the schema to describe a client-only page like this one, so
// the link is spliced into the first layout's items right after Dashboard
// (the single place layout mutations enter app state) rather than in every
// consumer. Getting Started is *not* inserted in setSchema: it stays hidden
// until OnboardingNavGate confirms the checklist is still useful, so
// completed installs never flash the item then remove it.
function withOnboardingNavEntry(schema: Schema): Schema {
  const first = schema.layouts[0];
  if (!first) return schema;

  const alreadyPresent = first.items.some(
    (item) => 'link' in item && item.link.viewName === ONBOARDING_VIEW_NAME,
  );
  if (alreadyPresent) return schema;

  const onboardingLink: LayoutItem = {
    link: { name: 'Getting Started', icon: 'rocket', viewName: ONBOARDING_VIEW_NAME },
  };
  const dashboardIdx = first.items.findIndex(
    (item) => 'link' in item && item.link.viewName === 'CustomComponent/Dashboard',
  );
  // Prefer sitting above Overview when that fork entry is already present.
  const overviewIdx = first.items.findIndex(
    (item) => 'link' in item && item.link.viewName === OVERVIEW_VIEW_NAME,
  );
  const insertAt =
    overviewIdx !== -1 ? overviewIdx : dashboardIdx === -1 ? 0 : dashboardIdx + 1;
  const items = [...first.items.slice(0, insertAt), onboardingLink, ...first.items.slice(insertAt)];

  return {
    ...schema,
    layouts: [{ ...first, items }, ...schema.layouts.slice(1)],
  };
}

// SCHEMA-DEVIATION: community-overview-nav-entry (see SCHEMA_DEVIATIONS.md)
//
// Inventory page for Community (and all editions). Inserted under Getting
// Started when present, otherwise under Dashboard. Survives hideOnboardingNav.
function withOverviewNavEntry(schema: Schema): Schema {
  const first = schema.layouts[0];
  if (!first) return schema;

  const alreadyPresent = first.items.some(
    (item) => 'link' in item && item.link.viewName === OVERVIEW_VIEW_NAME,
  );
  if (alreadyPresent) return schema;

  const overviewLink: LayoutItem = {
    link: { name: 'Overview', icon: 'panels-top-left', viewName: OVERVIEW_VIEW_NAME },
  };

  const onboardingIdx = first.items.findIndex(
    (item) => 'link' in item && item.link.viewName === ONBOARDING_VIEW_NAME,
  );
  const dashboardIdx = first.items.findIndex(
    (item) => 'link' in item && item.link.viewName === 'CustomComponent/Dashboard',
  );
  const insertAt =
    onboardingIdx !== -1 ? onboardingIdx + 1 : dashboardIdx !== -1 ? dashboardIdx + 1 : 0;
  const items = [...first.items.slice(0, insertAt), overviewLink, ...first.items.slice(insertAt)];

  return {
    ...schema,
    layouts: [{ ...first, items }, ...schema.layouts.slice(1)],
  };
}

function withoutOnboardingNavEntry(schema: Schema): Schema {
  let changed = false;
  const layouts = schema.layouts.map((layout) => {
    const items = layout.items.filter(
      (item) => !('link' in item && item.link.viewName === ONBOARDING_VIEW_NAME),
    );
    if (items.length !== layout.items.length) {
      changed = true;
      return { ...layout, items };
    }
    return layout;
  });
  return changed ? { ...schema, layouts } : schema;
}

export interface SearchIndexEntry {
  text: string;
  type: 'link' | 'field' | 'form';
  viewName: string;
  section: string;
  breadcrumb: string;
  icon?: string;
  objectType?: 'object' | 'singleton' | 'view';
  keywords?: string[];
}

interface SchemaState {
  schema: Schema | null;
  isLoaded: boolean;
  viewToSection: Record<string, string>;
  searchIndex: SearchIndexEntry[];

  setSchema: (schema: Schema) => void;
  /** SCHEMA-DEVIATION: onboarding-checklist-nav-entry — show Getting Started only while useful. */
  showOnboardingNav: () => void;
  /** SCHEMA-DEVIATION: onboarding-checklist-nav-entry — drop Getting Started once complete. */
  hideOnboardingNav: () => void;
}

function walkLayouts(schema: Schema): { viewToSection: Record<string, string>; linkEntries: SearchIndexEntry[] } {
  const viewToSection: Record<string, string> = {};
  const linkEntries: SearchIndexEntry[] = [];

  function visit(items: LayoutSubItem[], sectionName: string, parentPath: string): void {
    for (const sub of items) {
      if (sub.type === 'link') {
        if (!(sub.viewName in viewToSection)) {
          viewToSection[sub.viewName] = sectionName;
        }
        linkEntries.push({
          text: sub.name,
          type: 'link',
          viewName: sub.viewName,
          section: sectionName,
          breadcrumb: `${parentPath} > ${sub.name}`,
        });
      } else if (sub.type === 'container') {
        visit(sub.items, sectionName, `${parentPath} > ${sub.name}`);
      }
    }
  }

  for (const layout of schema.layouts) {
    const sectionName = layout.name;
    for (const item of layout.items) {
      if ('link' in item) {
        if (!(item.link.viewName in viewToSection)) {
          viewToSection[item.link.viewName] = sectionName;
        }
        linkEntries.push({
          text: item.link.name,
          type: 'link',
          viewName: item.link.viewName,
          section: sectionName,
          breadcrumb: `${sectionName} > ${item.link.name}`,
          icon: item.link.icon,
        });
      } else if ('container' in item) {
        visit(item.container.items, sectionName, `${sectionName} > ${item.container.name}`);
      }
    }
  }

  return { viewToSection, linkEntries };
}

/** Extra keywords so Overview / Getting Started / Appearance stay findable. */
const FORK_VIEW_KEYWORDS: Record<string, string[]> = {
  [OVERVIEW_VIEW_NAME]: ['overview', 'queue', 'dkim', 'inventory', 'home', 'community'],
  [ONBOARDING_VIEW_NAME]: ['getting started', 'setup', 'onboarding', 'spf', 'dmarc', 'checklist'],
  'CustomComponent/Dashboard': ['dashboard', 'metrics', 'charts'],
  'CustomComponent/LiveDelivery': ['delivery', 'trace', 'troubleshoot', 'smtp'],
  'CustomComponent/LiveTracing': ['tracing', 'live', 'debug'],
};

const CLIENT_PAGE_SEARCH_ENTRIES: SearchIndexEntry[] = [
  {
    text: 'Appearance',
    type: 'link',
    viewName: 'Appearance',
    section: 'Appearance',
    breadcrumb: 'Appearance',
    keywords: ['theme', 'dark', 'light', 'color', 'appearance', 'corners'],
  },
  {
    text: 'Changelog',
    type: 'link',
    viewName: 'Changelog',
    section: 'Changelog',
    breadcrumb: 'Changelog',
    keywords: ['changelog', 'release', 'version', "what's new"],
  },
];

function withForkKeywords(entries: SearchIndexEntry[]): SearchIndexEntry[] {
  return entries.map((entry) => {
    const extra = FORK_VIEW_KEYWORDS[entry.viewName];
    if (!extra) return entry;
    return { ...entry, keywords: [...(entry.keywords ?? []), ...extra] };
  });
}

function buildSearchIndex(
  schema: Schema,
  viewToSection: Record<string, string>,
  linkEntries: SearchIndexEntry[],
): SearchIndexEntry[] {
  const entries: SearchIndexEntry[] = [...withForkKeywords(linkEntries), ...CLIENT_PAGE_SEARCH_ENTRIES];

  function displayNameFor(viewName: string): string {
    const obj = schema.objects[viewName];
    if (!obj) return viewName.replace(/^x:/, '');
    let resolvedName = viewName;
    let resolvedObj = obj;
    if (obj.type === 'view') {
      const parent = schema.objects[obj.objectName];
      if (parent && parent.type !== 'view') {
        resolvedName = obj.objectName;
        resolvedObj = parent;
      }
    }
    if (resolvedObj.type === 'singleton') {
      const form = schema.forms[viewName] ?? schema.forms[resolvedName];
      if (form?.title) return form.title;
    }
    if (resolvedObj.type === 'object') {
      const list = schema.lists[viewName] ?? schema.lists[resolvedName];
      if (list?.singularName) {
        return list.singularName.charAt(0).toUpperCase() + list.singularName.slice(1);
      }
    }
    return viewName.replace(/^x:/, '');
  }

  for (const [name, obj] of Object.entries(schema.objects)) {
    if (obj.type !== 'view' && obj.description) {
      const viewName = layoutViewFor(schema, viewToSection, name);
      if (!viewName) continue;
      const section = viewToSection[viewName];
      const display = displayNameFor(viewName);
      entries.push({
        text: obj.description,
        type: 'link',
        viewName,
        section,
        breadcrumb: `${section} > ${display}`,
        objectType: obj.type,
      });
    }
  }

  for (const [formKey, form] of Object.entries(schema.forms)) {
    const mapped = schema.objects[formKey] ? layoutViewFor(schema, viewToSection, formKey) : formKey;
    if (!mapped) continue;
    const viewName = mapped;
    const section = viewToSection[viewName] ?? '';
    const display = displayNameFor(viewName);

    for (const formSection of form.sections) {
      if (formSection.title) {
        entries.push({
          text: formSection.title,
          type: 'form',
          viewName,
          section,
          breadcrumb: section ? `${section} > ${display} > ${formSection.title}` : `${display} > ${formSection.title}`,
        });
      }

      for (const field of formSection.fields) {
        const keywords: string[] = [];
        if (field.name && field.name !== '@type') {
          keywords.push(field.name);
        }
        entries.push({
          text: field.label,
          type: 'field',
          viewName,
          section,
          breadcrumb: section ? `${section} > ${display} > ${field.label}` : `${display} > ${field.label}`,
          keywords,
        });
      }
    }
  }

  return entries;
}

export const useSchemaStore = create<SchemaState>()((set) => ({
  schema: null,
  isLoaded: false,
  viewToSection: {},
  searchIndex: [],

  setSchema: (rawSchema) => {
    // Overview only — Getting Started is added later via showOnboardingNav when
    // the checklist still has required steps pending (avoids nav flash).
    const schema = withOverviewNavEntry(rawSchema);
    const { viewToSection, linkEntries } = walkLayouts(schema);
    const searchIndex = buildSearchIndex(schema, viewToSection, linkEntries);
    set({
      schema,
      isLoaded: true,
      viewToSection,
      searchIndex,
    });
  },

  showOnboardingNav: () => {
    set((state) => {
      if (!state.schema) return state;
      const schema = withOnboardingNavEntry(state.schema);
      if (schema === state.schema) return state;
      const { viewToSection, linkEntries } = walkLayouts(schema);
      const searchIndex = buildSearchIndex(schema, viewToSection, linkEntries);
      return { schema, viewToSection, searchIndex };
    });
  },

  hideOnboardingNav: () => {
    set((state) => {
      if (!state.schema) return state;
      // Overview stays; only Getting Started is removed.
      const schema = withoutOnboardingNavEntry(state.schema);
      if (schema === state.schema) return state;
      const { viewToSection, linkEntries } = walkLayouts(schema);
      const searchIndex = buildSearchIndex(schema, viewToSection, linkEntries);
      return { schema, viewToSection, searchIndex };
    });
  },
}));
