/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { describe, it, expect } from 'vitest';
import type { Schema } from '@/types/schema';
import {
  resolveObject,
  resolveSchema,
  resolveList,
  resolveForm,
  resolveVariantForm,
  deepMerge,
  buildCreateDefaults,
  buildEmbeddedDefaults,
  buildNewObjectValue,
} from './schemaResolver';
import { getDisplayProperty } from './schemaResolver';

const schema: Schema = {
  objects: {
    'x:Domain': {
      type: 'object',
      description: 'Mail domain',
      permissionPrefix: 'sysDomain',
    },
    'x:Auth': {
      type: 'singleton',
      description: 'Authentication settings',
      permissionPrefix: 'sysAuth',
    },
    'x:Account': {
      type: 'object',
      description: 'Account',
      permissionPrefix: 'sysAccount',
    },
    'x:Account/User': {
      type: 'view',
      objectName: 'x:Account',
    },
    'x:Account/Group': {
      type: 'view',
      objectName: 'x:Account',
    },
    'x:Credential': {
      type: 'object',
      description: 'Credential',
      permissionPrefix: 'sysCredential',
    },
    'x:Credential/ApiKey': {
      type: 'view',
      objectName: 'x:Credential',
    },
    'x:Tenant': {
      type: 'object',
      description: 'Tenant',
      permissionPrefix: 'sysTenant',
      enterprise: true,
    },
    'x:Bad/ViewOfView': {
      type: 'view',
      objectName: 'x:Account/User',
    },
  },

  schemas: {
    'x:Domain': {
      type: 'single',
      schemaName: 'DomainFields',
    },
    'x:Auth': {
      type: 'single',
      schemaName: 'AuthFields',
    },
    'x:Account': {
      type: 'multiple',
      variants: [
        { name: 'User', label: 'User Account', schemaName: 'UserFields' },
        { name: 'Group', label: 'Group Account', schemaName: 'GroupFields' },
        { name: 'External', label: 'External Account' },
      ],
    },
    'x:Credential': {
      type: 'single',
      schemaName: 'CredentialFields',
    },
    'x:Tenant': {
      type: 'single',
      schemaName: 'TenantFields',
    },
    'x:Orphan': {
      type: 'single',
      schemaName: 'MissingFields',
    },
  },

  fields: {
    DomainFields: {
      properties: {
        domainName: {
          description: 'Domain name',
          type: { type: 'string', format: 'string' },
          update: 'immutable',
        },
      },
      defaults: { domainName: 'example.com', active: true },
    },
    AuthFields: {
      properties: {
        method: {
          description: 'Auth method',
          type: { type: 'string', format: 'string' },
          update: 'mutable',
        },
      },
      defaults: { method: 'password' },
    },
    UserFields: {
      properties: {
        email: {
          description: 'Email',
          type: { type: 'string', format: 'emailAddress' },
          update: 'mutable',
        },
        role: {
          description: 'Role',
          type: { type: 'string', format: 'string' },
          update: 'mutable',
        },
        settings: {
          description: 'Settings',
          type: { type: 'object', objectName: 'x:UserSettings' },
          update: 'mutable',
        },
      },
      defaults: { email: '', quota: 1000, settings: { lang: 'en' } },
    },
    GroupFields: {
      properties: {
        groupName: {
          description: 'Group name',
          type: { type: 'string', format: 'string' },
          update: 'mutable',
        },
      },
      defaults: { groupName: '' },
    },
    CredentialFields: {
      properties: {
        token: {
          description: 'Token',
          type: { type: 'string', format: 'secret' },
          update: 'serverSet',
        },
      },
      defaults: { expiresIn: 3600 },
    },
    TenantFields: {
      properties: {
        tenantName: {
          description: 'Tenant name',
          type: { type: 'string', format: 'string' },
          update: 'mutable',
        },
      },
    },
    AccountBaseFields: {
      properties: {},
    },
  },

  forms: {
    'x:Domain': {
      title: 'Domain Form',
      sections: [{ fields: [{ name: 'domainName', label: 'Domain' }] }],
    },
    'x:Account/User': {
      title: 'User Form',
      sections: [{ fields: [{ name: 'email', label: 'Email' }] }],
    },
    'x:Account': {
      title: 'Account Form',
      sections: [{ fields: [{ name: 'name', label: 'Name' }] }],
    },
    UserFields: {
      title: 'User Schema Form',
      sections: [{ fields: [{ name: 'email', label: 'Email' }] }],
    },
    GroupFields: {
      title: 'Group Schema Form',
      sections: [{ fields: [{ name: 'name', label: 'Name' }] }],
    },
    CredentialFields: {
      title: 'Credential Schema Form',
      sections: [{ fields: [{ name: 'token', label: 'Token' }] }],
    },
  },

  lists: {
    'x:Domain': {
      title: 'Domains',
      subtitle: 'All domains',
      labelProperty: 'domainName',
      singularName: 'domain',
      pluralName: 'domains',
      columns: [
        { name: 'domainName', label: 'Domain' },
        { name: 'active', label: 'Active' },
      ],
    },
    'x:Account/User': {
      title: 'Users',
      subtitle: 'User accounts',
      singularName: 'user',
      pluralName: 'users',
      columns: [{ name: 'email', label: 'Email' }],
      filtersStatic: { role: 'user', settings: { theme: 'dark', notifications: true } },
    },
    'x:Account': {
      title: 'Accounts',
      subtitle: 'All accounts',
      singularName: 'account',
      pluralName: 'accounts',
      columns: [{ name: 'name', label: 'Name' }],
    },
    'x:Credential': {
      title: 'Credentials',
      subtitle: 'All credentials',
      singularName: 'credential',
      pluralName: 'credentials',
      columns: [{ name: 'token', label: 'Token' }],
    },
    'x:NoLabel': {
      title: 'No Label',
      subtitle: '',
      singularName: 'item',
      pluralName: 'items',
      columns: [{ name: 'title', label: 'Title' }],
    },
    'x:Empty': {
      title: 'Empty',
      subtitle: '',
      singularName: 'thing',
      pluralName: 'things',
      columns: [],
    },
  },

  enums: {},
  dashboards: [],
  layouts: [],
};

describe('resolveObject', () => {
  it('resolves a regular object', () => {
    const result = resolveObject(schema, 'x:Domain');
    expect(result).not.toBeNull();
    expect(result!.viewName).toBe('x:Domain');
    expect(result!.objectName).toBe('x:Domain');
    expect(result!.objectType.type).toBe('object');
    expect(result!.permissionPrefix).toBe('sysDomain');
    expect(result!.enterprise).toBe(false);
  });

  it('resolves a singleton', () => {
    const result = resolveObject(schema, 'x:Auth');
    expect(result).not.toBeNull();
    expect(result!.viewName).toBe('x:Auth');
    expect(result!.objectName).toBe('x:Auth');
    expect(result!.objectType.type).toBe('singleton');
    expect(result!.permissionPrefix).toBe('sysAuth');
    expect(result!.enterprise).toBe(false);
  });

  it('resolves a view pointing to a parent object', () => {
    const result = resolveObject(schema, 'x:Account/User');
    expect(result).not.toBeNull();
    expect(result!.viewName).toBe('x:Account/User');
    expect(result!.objectName).toBe('x:Account');
    expect(result!.objectType.type).toBe('object');
    expect(result!.permissionPrefix).toBe('sysAccount');
    expect(result!.enterprise).toBe(false);
  });

  it('returns null for unknown viewName', () => {
    expect(resolveObject(schema, 'x:NonExistent')).toBeNull();
  });

  it('returns true for enterprise flag', () => {
    const result = resolveObject(schema, 'x:Tenant');
    expect(result!.enterprise).toBe(true);
  });

  it('returns null when a view points to another view', () => {
    const result = resolveObject(schema, 'x:Bad/ViewOfView');
    expect(result).toBeNull();
  });

  it('returns null when a view points to a missing parent', () => {
    const badSchema: Schema = {
      ...schema,
      objects: {
        'x:Dangling': { type: 'view', objectName: 'x:Gone' },
      },
    };
    expect(resolveObject(badSchema, 'x:Dangling')).toBeNull();
  });
});

describe('resolveSchema', () => {
  it('resolves a single schema', () => {
    const result = resolveSchema(schema, 'x:Domain')!;
    expect(result).not.toBeNull();
    expect(result.type).toBe('single');
    if (result.type === 'single') {
      expect(result.schemaName).toBe('DomainFields');
      expect(result.fields.properties).toHaveProperty('domainName');
    }
  });

  it('resolves a multiple schema with variants', () => {
    const result = resolveSchema(schema, 'x:Account')!;
    expect(result).not.toBeNull();
    expect(result.type).toBe('multiple');
    if (result.type === 'multiple') {
      expect(result.variants).toHaveLength(3);
      expect(result.variants[0].name).toBe('User');
      expect(result.variants[0].label).toBe('User Account');
      expect(result.variants[0].fields).not.toBeNull();
      expect(result.variants[0].fields!.properties).toHaveProperty('email');
    }
  });

  it('sets fields to null for variant without schemaName', () => {
    const result = resolveSchema(schema, 'x:Account')!;
    if (result.type === 'multiple') {
      const ext = result.variants.find((v) => v.name === 'External');
      expect(ext).toBeDefined();
      expect(ext!.fields).toBeNull();
      expect(ext!.schemaName).toBeUndefined();
    }
  });

  it('returns null for unknown objectName', () => {
    expect(resolveSchema(schema, 'x:Unknown')).toBeNull();
  });

  it('returns null when single schema references missing fields', () => {
    expect(resolveSchema(schema, 'x:Orphan')).toBeNull();
  });

  it('returns fields with defaults for single schema', () => {
    const result = resolveSchema(schema, 'x:Domain')!;
    if (result.type === 'single') {
      expect(result.fields.defaults).toEqual({ domainName: 'example.com', active: true });
    }
  });

  it('preserves schemaName on variant entries', () => {
    const result = resolveSchema(schema, 'x:Account')!;
    if (result.type === 'multiple') {
      expect(result.variants[0].schemaName).toBe('UserFields');
      expect(result.variants[1].schemaName).toBe('GroupFields');
    }
  });
});

describe('resolveList', () => {
  it('returns view-specific list when it exists', () => {
    const list = resolveList(schema, 'x:Account/User', 'x:Account');
    expect(list).not.toBeNull();
    expect(list!.title).toBe('Users');
  });

  it('falls back to parent objectName list', () => {
    const list = resolveList(schema, 'x:Account/Group', 'x:Account');
    expect(list).not.toBeNull();
    expect(list!.title).toBe('Accounts');
  });

  it('returns null when neither view nor object list exists', () => {
    const list = resolveList(schema, 'x:NoView', 'x:NoObject');
    expect(list).toBeNull();
  });

  it('returns the list for a direct object', () => {
    const list = resolveList(schema, 'x:Domain', 'x:Domain');
    expect(list).not.toBeNull();
    expect(list!.title).toBe('Domains');
  });

  it('prefers viewName over objectName', () => {
    const list = resolveList(schema, 'x:Account/User', 'x:Account');
    expect(list!.singularName).toBe('user');
  });
});

describe('resolveForm', () => {
  it('returns view-specific form', () => {
    const form = resolveForm(schema, 'x:Account/User', 'x:Account', 'UserFields');
    expect(form).not.toBeNull();
    expect(form!.title).toBe('User Form');
  });

  it('falls back to objectName form', () => {
    const form = resolveForm(schema, 'x:Account/Group', 'x:Account', 'GroupFields');
    expect(form).not.toBeNull();
    expect(form!.title).toBe('Account Form');
  });

  it('falls back to schemaName form', () => {
    const smallSchema: Schema = {
      ...schema,
      forms: {
        CredentialFields: schema.forms['CredentialFields'],
      },
    };
    const form = resolveForm(smallSchema, 'x:Credential/ApiKey', 'x:Credential', 'CredentialFields');
    expect(form).not.toBeNull();
    expect(form!.title).toBe('Credential Schema Form');
  });

  it('returns null when no form found at any level', () => {
    const form = resolveForm(schema, 'x:NoView', 'x:NoObject', 'NoSchema');
    expect(form).toBeNull();
  });

  it('uses viewName form even when objectName and schemaName also exist', () => {
    const form = resolveForm(schema, 'x:Account/User', 'x:Account', 'UserFields');
    expect(form!.title).toBe('User Form');
  });

  it('returns domain form for direct object', () => {
    const form = resolveForm(schema, 'x:Domain', 'x:Domain', 'DomainFields');
    expect(form!.title).toBe('Domain Form');
  });
});

describe('resolveVariantForm', () => {
  it('returns the variant-specific form by schemaName', () => {
    const form = resolveVariantForm(schema, 'x:Account/User', 'x:Account', 'UserFields');
    expect(form).not.toBeNull();
    expect(form!.title).toBe('User Schema Form');
  });

  it('does not fall back to the parent form even if it exists', () => {
    const form = resolveVariantForm(schema, 'x:Account/Group', 'x:Account', 'GroupFields');
    expect(form).not.toBeNull();
    expect(form!.title).toBe('Group Schema Form');
  });

  it('returns null when variantSchemaName is undefined', () => {
    const form = resolveVariantForm(schema, 'x:NoView', 'x:NoObject');
    expect(form).toBeNull();
  });

  it('returns null when variantSchemaName is provided but has no form', () => {
    const form = resolveVariantForm(schema, 'x:NoView', 'x:NoObject', 'NonExistentSchema');
    expect(form).toBeNull();
  });
});

describe('deepMerge', () => {
  it('merges flat objects', () => {
    expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it('source overrides target for same key', () => {
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it('deeply merges nested objects', () => {
    const target = { x: { a: 1, b: 2 } };
    const source = { x: { b: 3, c: 4 } };
    expect(deepMerge(target, source)).toEqual({ x: { a: 1, b: 3, c: 4 } });
  });

  it('replaces arrays instead of merging them', () => {
    const target = { arr: [1, 2, 3] };
    const source = { arr: [4, 5] };
    expect(deepMerge(target, source)).toEqual({ arr: [4, 5] });
  });

  it('handles null source values (replaces target)', () => {
    const target: Record<string, unknown> = { a: { nested: 1 } };
    const source: Record<string, unknown> = { a: null };
    expect(deepMerge(target, source)).toEqual({ a: null });
  });

  it('handles null target values (replaced by source object)', () => {
    const target: Record<string, unknown> = { a: null };
    const source: Record<string, unknown> = { a: { nested: 1 } };
    expect(deepMerge(target, source)).toEqual({ a: { nested: 1 } });
  });

  it('handles empty source object', () => {
    expect(deepMerge({ a: 1 }, {})).toEqual({ a: 1 });
  });

  it('handles empty target object', () => {
    expect(deepMerge({}, { a: 1 })).toEqual({ a: 1 });
  });

  it('handles both empty', () => {
    expect(deepMerge({}, {})).toEqual({});
  });

  it('deeply merges 3 levels', () => {
    const target = { l1: { l2: { l3: 'original', keep: true } } };
    const source = { l1: { l2: { l3: 'updated', added: 42 } } };
    expect(deepMerge(target, source)).toEqual({
      l1: { l2: { l3: 'updated', keep: true, added: 42 } },
    });
  });

  it('does not mutate target', () => {
    const target = { a: 1, nested: { b: 2 } };
    const original = { ...target, nested: { ...target.nested } };
    deepMerge(target, { a: 99, nested: { c: 3 } });
    expect(target).toEqual(original);
  });

  it('does not mutate source', () => {
    const source = { a: 1 };
    const copy = { ...source };
    deepMerge({}, source);
    expect(source).toEqual(copy);
  });

  it('replaces string with object', () => {
    const target: Record<string, unknown> = { a: 'hello' };
    const source: Record<string, unknown> = { a: { nested: 1 } };
    expect(deepMerge(target, source)).toEqual({ a: { nested: 1 } });
  });

  it('replaces object with string', () => {
    const target: Record<string, unknown> = { a: { nested: 1 } };
    const source: Record<string, unknown> = { a: 'hello' };
    expect(deepMerge(target, source)).toEqual({ a: 'hello' });
  });
});

const embeddedSchema: Schema = {
  objects: {
    'x:SpamClassifier': {
      type: 'singleton',
      description: 'Spam classifier',
      permissionPrefix: 'sysSpam',
    },
  },
  schemas: {
    'x:Model': {
      type: 'multiple',
      variants: [
        { name: 'FtrlFh', label: 'FTRL FH', schemaName: 'x:FtrlFh' },
        { name: 'FtrlCcfh', label: 'FTRL CCFH', schemaName: 'x:FtrlCcfh' },
      ],
    },
    'x:FtrlParameters': {
      type: 'single',
      schemaName: 'x:FtrlParameters',
    },
    'x:CertManagement': {
      type: 'multiple',
      variants: [
        { name: 'Manual', label: 'Manual' },
        { name: 'Automatic', label: 'Automatic', schemaName: 'x:CertAuto' },
      ],
    },
  },
  fields: {
    'x:FtrlFh': {
      properties: {
        learningRate: {
          description: '',
          type: { type: 'number', format: 'float' },
          update: 'mutable',
        },
      },
      defaults: {
        learningRate: 0.01,
      },
    },
    'x:FtrlCcfh': {
      properties: {
        featureL2Normalize: {
          description: '',
          type: { type: 'boolean' },
          update: 'mutable',
        },
        parameters: {
          description: '',
          type: { type: 'object', objectName: 'x:FtrlParameters' },
          update: 'mutable',
        },
        indicatorParameters: {
          description: '',
          type: { type: 'object', objectName: 'x:FtrlParameters' },
          update: 'mutable',
        },
      },
      defaults: {
        featureL2Normalize: true,
        parameters: { numFeatures: '20' },
        indicatorParameters: { numFeatures: '18' },
      },
    },
    'x:FtrlParameters': {
      properties: {
        alpha: { description: '', type: { type: 'number', format: 'float' }, update: 'mutable' },
        beta: { description: '', type: { type: 'number', format: 'float' }, update: 'mutable' },
        l1Ratio: { description: '', type: { type: 'number', format: 'float' }, update: 'mutable' },
        l2Ratio: { description: '', type: { type: 'number', format: 'float' }, update: 'mutable' },
        numFeatures: { description: '', type: { type: 'string', format: 'string' }, update: 'mutable' },
      },
      defaults: {
        alpha: 2,
        beta: 1,
        l1Ratio: 0.001,
        l2Ratio: 0.0001,
        numFeatures: '50',
      },
    },
    'x:CertAuto': {
      properties: {
        acmeProviderId: { description: '', type: { type: 'string', format: 'string' }, update: 'mutable' },
      },
      defaults: {},
    },
  },
  forms: {},
  lists: {},
  enums: {},
  dashboards: [],
  layouts: [],
};

describe('buildEmbeddedDefaults', () => {
  it('returns child schema defaults for a single object', () => {
    const result = buildEmbeddedDefaults(embeddedSchema, 'x:FtrlParameters');
    expect(result).toEqual({
      alpha: 2,
      beta: 1,
      l1Ratio: 0.001,
      l2Ratio: 0.0001,
      numFeatures: '50',
    });
  });

  it('returns variant defaults with @type for a multi-variant object', () => {
    const result = buildEmbeddedDefaults(embeddedSchema, 'x:Model', {}, 'FtrlFh');
    expect(result).toEqual({
      '@type': 'FtrlFh',
      learningRate: 0.01,
    });
  });

  it('recursively merges parent overrides into child defaults for embedded fields', () => {
    const result = buildEmbeddedDefaults(embeddedSchema, 'x:Model', {}, 'FtrlCcfh');
    expect(result).toEqual({
      '@type': 'FtrlCcfh',
      featureL2Normalize: true,
      parameters: {
        alpha: 2,
        beta: 1,
        l1Ratio: 0.001,
        l2Ratio: 0.0001,
        numFeatures: '20',
      },
      indicatorParameters: {
        alpha: 2,
        beta: 1,
        l1Ratio: 0.001,
        l2Ratio: 0.0001,
        numFeatures: '18',
      },
    });
  });

  it('applies caller-supplied parent overrides on top of everything', () => {
    const result = buildEmbeddedDefaults(embeddedSchema, 'x:Model', { featureL2Normalize: false }, 'FtrlCcfh');
    expect(result.featureL2Normalize).toBe(false);
    expect(result.parameters).toMatchObject({ alpha: 2, numFeatures: '20' });
  });

  it('handles a variant with no schemaName', () => {
    const result = buildEmbeddedDefaults(embeddedSchema, 'x:CertManagement', {}, 'Manual');
    expect(result).toEqual({ '@type': 'Manual' });
  });

  it('handles a variant with empty defaults', () => {
    const result = buildEmbeddedDefaults(embeddedSchema, 'x:CertManagement', {}, 'Automatic');
    expect(result).toEqual({ '@type': 'Automatic' });
  });

  it('returns parentOverrides when objectName is not in schema', () => {
    const result = buildEmbeddedDefaults(embeddedSchema, 'x:Unknown', { foo: 'bar' });
    expect(result).toEqual({ foo: 'bar' });
  });

  it('falls back to first variant when variantName is not provided', () => {
    const result = buildEmbeddedDefaults(embeddedSchema, 'x:Model');
    expect(result['@type']).toBe('FtrlFh');
    expect(result.learningRate).toBe(0.01);
  });

  it('parent override only mentions some keys -- others come from child', () => {
    const result = buildEmbeddedDefaults(embeddedSchema, 'x:Model', {}, 'FtrlCcfh');
    const params = result.parameters as Record<string, unknown>;
    expect(Object.keys(params).sort()).toEqual(['alpha', 'beta', 'l1Ratio', 'l2Ratio', 'numFeatures']);
  });

  it('parent overrides take precedence for matching nested keys', () => {
    const result = buildEmbeddedDefaults(embeddedSchema, 'x:Model', {}, 'FtrlCcfh');
    expect((result.parameters as Record<string, unknown>).numFeatures).toBe('20');
    expect((result.indicatorParameters as Record<string, unknown>).numFeatures).toBe('18');
  });
});

describe('buildCreateDefaults', () => {
  it('returns single schema defaults', () => {
    const ro = resolveObject(schema, 'x:Domain')!;
    const rs = resolveSchema(schema, 'x:Domain')!;
    const defaults = buildCreateDefaults(schema, ro, rs);
    expect(defaults).toEqual({ domainName: 'example.com', active: true });
  });

  it('returns multi-variant defaults with @type', () => {
    const ro = resolveObject(schema, 'x:Account/User')!;
    const rs = resolveSchema(schema, 'x:Account')!;
    const defaults = buildCreateDefaults(schema, ro, rs, 'User');
    expect(defaults['@type']).toBe('User');
  });

  it('includes variant field defaults for multi-variant', () => {
    const ro = resolveObject(schema, 'x:Account/User')!;
    const rs = resolveSchema(schema, 'x:Account')!;
    const defaults = buildCreateDefaults(schema, ro, rs, 'User');
    expect(defaults).toHaveProperty('email', '');
    expect(defaults).toHaveProperty('quota', 1000);
  });

  it('sets @type even when variant has no fields defaults', () => {
    const ro = resolveObject(schema, 'x:Account/Group')!;
    const rs = resolveSchema(schema, 'x:Account')!;
    const defaults = buildCreateDefaults(schema, ro, rs, 'External');
    expect(defaults['@type']).toBe('External');
  });

  it('applies parent schema defaults on top of variant defaults', () => {
    const ro = resolveObject(schema, 'x:Credential/ApiKey')!;
    const rs = resolveSchema(schema, 'x:Credential')!;
    const defaults = buildCreateDefaults(schema, ro, rs);
    expect(defaults).toHaveProperty('expiresIn', 3600);
  });

  it('applies filtersStatic field values on top of everything', () => {
    const ro = resolveObject(schema, 'x:Account/User')!;
    const rs = resolveSchema(schema, 'x:Account')!;
    const list = resolveList(schema, 'x:Account/User', 'x:Account');
    const defaults = buildCreateDefaults(schema, ro, rs, 'User', list?.filtersStatic);
    expect(defaults).toHaveProperty('role', 'user');
  });

  it('deep-merges nested filtersStatic values with variant defaults', () => {
    const ro = resolveObject(schema, 'x:Account/User')!;
    const rs = resolveSchema(schema, 'x:Account')!;
    const list = resolveList(schema, 'x:Account/User', 'x:Account');
    const defaults = buildCreateDefaults(schema, ro, rs, 'User', list?.filtersStatic);
    expect(defaults.settings).toEqual({
      lang: 'en',
      theme: 'dark',
      notifications: true,
    });
  });

  it('returns empty object when schema has no defaults', () => {
    const ro = resolveObject(schema, 'x:Tenant')!;
    const rs = resolveSchema(schema, 'x:Tenant')!;
    const defaults = buildCreateDefaults(schema, ro, rs);
    expect(defaults).toEqual({});
  });

  it('does not set @type for single schema', () => {
    const ro = resolveObject(schema, 'x:Domain')!;
    const rs = resolveSchema(schema, 'x:Domain')!;
    const defaults = buildCreateDefaults(schema, ro, rs);
    expect(defaults).not.toHaveProperty('@type');
  });

  it('does not set @type for multiple schema when variantName is not provided', () => {
    const ro = resolveObject(schema, 'x:Account/User')!;
    const rs = resolveSchema(schema, 'x:Account')!;
    const defaults = buildCreateDefaults(schema, ro, rs);
    expect(defaults).not.toHaveProperty('@type');
  });

  it('merge order: child defaults < parent defaults < filtersStatic', () => {
    const custom: Schema = {
      ...schema,
      objects: {
        'x:Parent': {
          type: 'object',
          description: 'Parent',
          permissionPrefix: 'p',
        },
        'x:Parent/Child': {
          type: 'view',
          objectName: 'x:Parent',
        },
      },
      schemas: {
        'x:Parent': {
          type: 'single',
          schemaName: 'ParentFields',
        },
      },
      fields: {
        ParentFields: {
          properties: {
            priority: { description: '', type: { type: 'string', format: 'string' }, update: 'mutable' },
            fromParent: { description: '', type: { type: 'boolean' }, update: 'mutable' },
          },
          defaults: { priority: 'parent', fromParent: true },
        },
      },
      lists: {
        'x:Parent/Child': {
          title: 'Children',
          subtitle: '',
          singularName: 'child',
          pluralName: 'children',
          columns: [],
          filtersStatic: { priority: 'filter' },
        },
      },
    };
    const ro = resolveObject(custom, 'x:Parent/Child')!;
    const rs = resolveSchema(custom, 'x:Parent')!;
    const defaults = buildCreateDefaults(custom, ro, rs, undefined, custom.lists['x:Parent/Child'].filtersStatic);
    expect(defaults.priority).toBe('filter');
    expect(defaults.fromParent).toBe(true);
  });
});

describe('getDisplayProperty', () => {
  it('returns labelProperty when defined', () => {
    expect(getDisplayProperty(schema, 'x:Domain')).toBe('domainName');
  });

  it('returns first column name when no labelProperty', () => {
    expect(getDisplayProperty(schema, 'x:Account/User')).toBe('email');
  });

  it('falls back to "name" when no list exists', () => {
    expect(getDisplayProperty(schema, 'x:NonExistent')).toBe('name');
  });

  it('falls back to "name" when columns are empty', () => {
    expect(getDisplayProperty(schema, 'x:Empty')).toBe('name');
  });

  it('returns first column when labelProperty is absent but columns exist', () => {
    expect(getDisplayProperty(schema, 'x:NoLabel')).toBe('title');
  });
});

const structSchema: Schema = {
  objects: {},
  schemas: {
    'x:Service': { type: 'single', schemaName: 'x:Service' },
    'x:Listener': { type: 'single', schemaName: 'x:Listener' },
    'x:Tls': { type: 'single', schemaName: 'x:Tls' },
    'x:Store': {
      type: 'multiple',
      variants: [
        { name: 'S3', label: 'S3', schemaName: 'x:S3Store' },
        { name: 'Manual', label: 'Manual' },
      ],
    },
  },
  fields: {
    'x:Service': {
      properties: {
        hostname: {
          description: '',
          type: { type: 'string', format: 'string', nullable: true },
          update: 'mutable',
        },
        cleartext: { description: '', type: { type: 'boolean' }, update: 'mutable' },
      },
    },
    'x:Listener': {
      properties: {
        enabled: { description: '', type: { type: 'boolean' }, update: 'mutable' },
        proxied: { description: '', type: { type: 'boolean' }, update: 'mutable' },
        readOnly: { description: '', type: { type: 'boolean' }, update: 'serverSet' },
        tls: { description: '', type: { type: 'object', objectName: 'x:Tls' }, update: 'mutable' },
        fallback: {
          description: '',
          type: { type: 'object', objectName: 'x:Tls', nullable: true },
          update: 'mutable',
        },
      },
      defaults: {
        enabled: true,
      },
    },
    'x:Tls': {
      properties: {
        implicit: { description: '', type: { type: 'boolean' }, update: 'mutable' },
        certificateId: {
          description: '',
          type: { type: 'string', format: 'string', nullable: true },
          update: 'mutable',
        },
      },
    },
    'x:S3Store': {
      properties: {
        bucket: { description: '', type: { type: 'string', format: 'string' }, update: 'mutable' },
        allowInvalidCerts: { description: '', type: { type: 'boolean' }, update: 'mutable' },
      },
      defaults: {
        bucket: 'stalwart',
      },
    },
  },
  forms: {},
  lists: {},
  enums: {},
  dashboards: [],
  layouts: [],
};

describe('buildNewObjectValue', () => {
  it('seeds non-nullable booleans a struct has no defaults for', () => {
    expect(buildNewObjectValue(structSchema, 'x:Service')).toEqual({ cleartext: false });
  });

  it('keeps schema defaults and only fills the missing booleans', () => {
    const result = buildNewObjectValue(structSchema, 'x:Listener');
    expect(result.enabled).toBe(true);
    expect(result.proxied).toBe(false);
  });

  it('skips serverSet properties', () => {
    expect(buildNewObjectValue(structSchema, 'x:Listener')).not.toHaveProperty('readOnly');
  });

  it('recurses into non-nullable embedded objects and skips nullable ones', () => {
    const result = buildNewObjectValue(structSchema, 'x:Listener');
    expect(result.tls).toEqual({ implicit: false });
    expect(result).not.toHaveProperty('fallback');
  });

  it('seeds the first variant with its @type, defaults and booleans', () => {
    expect(buildNewObjectValue(structSchema, 'x:Store')).toEqual({
      '@type': 'S3',
      bucket: 'stalwart',
      allowInvalidCerts: false,
    });
  });

  it('honours an explicit variant name', () => {
    expect(buildNewObjectValue(structSchema, 'x:Store', 'Manual')).toEqual({ '@type': 'Manual' });
  });

  it('returns an empty object for an unknown object name', () => {
    expect(buildNewObjectValue(structSchema, 'x:Unknown')).toEqual({});
  });

  it('still merges parent defaults into embedded children', () => {
    const result = buildNewObjectValue(embeddedSchema, 'x:Model', 'FtrlCcfh');
    expect(result.featureL2Normalize).toBe(true);
    expect((result.parameters as Record<string, unknown>).numFeatures).toBe('20');
  });
});
