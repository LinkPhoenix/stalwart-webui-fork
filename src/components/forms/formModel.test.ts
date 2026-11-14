import { describe, expect, it } from 'vitest';

import type { ResolvedView } from '@/lib/schemaResolver';
import type { Fields, Schema } from '@/types/schema';

import {
  computeLoadState,
  computeRecordLabel,
  extractCreatedExtras,
  initialCreateVariant,
  initialState,
  loadedVariant,
  resolveFormParts,
} from './formModel';
import { VARIANT_FIELD } from './formLogic';

const fields = {
  properties: {

    name: { description: 'Name', type: { type: 'string', format: 'string' }, update: 'mutable' },
    owner: {
      description: 'Owner',
      type: { type: 'objectId', objectName: 'x:Other' },
      update: 'mutable',
    },
  },
} as unknown as Fields;

const schema = {
  objects: {
    'x:Test': { type: 'object', description: 'Test', permissionPrefix: 'test' },
    'x:Other': { type: 'object', description: 'Other', permissionPrefix: 'other' },
  },
  schemas: { 'x:Test': { type: 'single', schemaName: 'TestFields' } },
  fields: { TestFields: fields },
  lists: {},
  layouts: [],
  forms: {},
  enums: {},
  dashboards: [],
} as unknown as Schema;

const object = {
  viewName: 'x:Test',
  objectName: 'x:Test',
  objectType: schema.objects['x:Test'],
  permissionPrefix: 'test',
  enterprise: false,
} as unknown as ResolvedView['object'];

const singleView: ResolvedView = {
  object,
  resolvedSchema: { type: 'single', schemaName: 'TestFields', fields },
  list: null,
};

const multiView: ResolvedView = {
  object,
  resolvedSchema: {
    type: 'multiple',
    variants: [
      { name: 'user', label: 'User', schemaName: 'UserFields', fields: null },
      { name: 'group', label: 'Group', schemaName: 'GroupFields', fields: null },
    ],
  },
  list: null,
};

const t = (_key: string, fallback: string) => fallback;

describe('extractCreatedExtras', () => {
  it('strips id and blobId but keeps the other server-returned fields', () => {
    expect(extractCreatedExtras({ id: 'a1', blobId: 'b1', name: 'Alice', quota: 10 })).toEqual({
      name: 'Alice',
      quota: 10,
    });
  });

  it('returns an empty object when only noisy keys are present', () => {
    expect(extractCreatedExtras({ id: 'a1', blobId: 'b1' })).toEqual({});
  });
});

describe('initialCreateVariant / loadedVariant', () => {
  it('returns undefined for a single-schema view', () => {
    expect(initialCreateVariant(singleView)).toBeUndefined();
    expect(loadedVariant(singleView, {})).toBe('');
  });

  it('prefers the static variant filter, then the first variant', () => {
    const withFilter: ResolvedView = { ...multiView, list: { filtersStatic: { [VARIANT_FIELD]: 'group' } } as never };
    expect(initialCreateVariant(withFilter)).toBe('group');
    expect(initialCreateVariant(multiView)).toBe('user');
  });

  it('reads the variant from loaded data, falling back to the first variant', () => {
    expect(loadedVariant(multiView, { [VARIANT_FIELD]: 'group' })).toBe('group');
    expect(loadedVariant(multiView, {})).toBe('user');
    expect(loadedVariant(multiView, { [VARIANT_FIELD]: 42 })).toBe('user');
  });
});

describe('initialState', () => {
  it('returns an empty state in edit mode or without schema/view', () => {
    expect(initialState(schema, singleView, 'edit').data).toEqual({});
    expect(initialState(null, singleView, 'create').data).toEqual({});
    expect(initialState(schema, null, 'create').data).toEqual({});
  });

  it('seeds create mode with the variant defaults', () => {
    const state = initialState(schema, multiView, 'create');
    expect(state.variant).toBe('user');
    expect(state.data[VARIANT_FIELD]).toBe('user');
    expect(state.source).toBe(multiView);
  });
});

describe('resolveFormParts', () => {
  it('resolves fields and auto-built sections for a single-schema view without form', () => {
    const parts = resolveFormParts(schema, singleView, 'x:Test', '', 'create', () => true);
    expect(Object.keys(parts.fields?.properties ?? {}).sort()).toEqual(['name', 'owner']);
    expect(parts.form).toBeNull();
    expect(parts.sections.flatMap((s) => s.fields.map((f) => f.formField.name)).sort()).toEqual([
      'name',
      'owner',
    ]);
  });

  it('drops fields referencing objects the user cannot read', () => {
    const parts = resolveFormParts(schema, singleView, 'x:Test', '', 'create', (prefix) => prefix !== 'other');
    expect(Object.keys(parts.fields?.properties ?? {})).toEqual(['name']);
  });

  it('handles a missing view', () => {
    const parts = resolveFormParts(schema, null, 'x:Test', '', 'edit', () => true);
    expect(parts.fields).toBeNull();
    expect(parts.form).toBeNull();
    expect(parts.sections).toEqual([]);
  });
});

describe('computeLoadState', () => {
  const base = {
    mode: 'edit' as const,
    fetchStatus: 'fetching',
    isFetchedAfterMount: false,
    isError: false,
    error: null,
    isSuccess: false,
    hasData: false,
  };

  it('is loading while the first edit fetch is in flight', () => {
    expect(computeLoadState(base, t).loading).toBe(true);
    expect(computeLoadState({ ...base, isFetchedAfterMount: true }, t).loading).toBe(false);
  });

  it('never reports an error in create mode', () => {
    const state = computeLoadState({ ...base, mode: 'create', isError: true, error: new Error('x') }, t);
    expect(state.loadError).toBeNull();
    expect(state.loadFailed).toBe(false);
  });

  it('maps a query error to loadError and loadFailed without data', () => {
    const state = computeLoadState({ ...base, fetchStatus: 'idle', isError: true, error: new Error('boom') }, t);
    expect(state.loadError).toBe('boom');
    expect(state.loadFailed).toBe(true);
  });

  it('reports objectNotFound on success without data, but not loadFailed when data exists', () => {
    const missing = computeLoadState({ ...base, fetchStatus: 'idle', isSuccess: true }, t);
    expect(missing.loadError).toBe('Object not found.');
    expect(missing.loadFailed).toBe(true);
    const withData = computeLoadState({ ...base, fetchStatus: 'idle', isSuccess: true, hasData: true }, t);
    expect(withData.loadError).toBeNull();
    expect(withData.loadFailed).toBe(false);
  });
});

describe('computeRecordLabel', () => {
  it('uses the list label property when present', () => {
    const view: ResolvedView = { ...singleView, list: { labelProperty: 'name' } as never };
    expect(computeRecordLabel(schema, 'x:Test', view, { name: 'Alice' })).toBe('Alice');
  });

  it('falls back to the schema display property, and to empty without schema', () => {
    expect(computeRecordLabel(schema, 'x:Test', singleView, { name: 'Alice' })).toBe('Alice');
    expect(computeRecordLabel(null, 'x:Test', singleView, { name: 'Alice' })).toBe('');
    expect(computeRecordLabel(schema, 'x:Test', null, { name: 'Alice' })).toBe('Alice');
  });
});
