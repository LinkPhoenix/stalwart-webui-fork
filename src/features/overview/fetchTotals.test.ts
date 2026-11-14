/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { describe, expect, it } from 'vitest';
import type { Schema } from '@/types/schema';
import { OVERVIEW_CARDS } from '@/features/overview/cards';
import { deriveAttention, resolveQueryableCards } from '@/features/overview/fetchTotals';

function minimalSchema(): Schema {
  return {
    objects: {
      'x:Account': {
        type: 'object',
        description: 'Account',
        permissionPrefix: 'sysAccount',
      },
      'x:Account/User': {
        type: 'view',
        objectName: 'x:Account',
      },
      'x:Domain': {
        type: 'object',
        description: 'Domain',
        permissionPrefix: 'sysDomain',
      },
      'x:Metric': {
        type: 'object',
        description: 'Metric',
        permissionPrefix: 'sysMetric',
        enterprise: true,
      },
    },
    schemas: {},
    fields: {},
    forms: {},
    lists: {},
    enums: {},
    dashboards: [],
    layouts: [],
  };
}

describe('resolveQueryableCards', () => {
  it('keeps only cards whose views exist and are queryable', () => {
    const schema = minimalSchema();
    const viewToSection = {
      'x:Account/User': 'Management',
      'x:Domain': 'Management',
    };

    const cards = resolveQueryableCards(schema, OVERVIEW_CARDS, viewToSection, (prefix) =>
      ['sysAccount', 'sysDomain'].includes(prefix),
    );

    expect(cards.map((c) => c.id).sort()).toEqual(['domains', 'users']);
    expect(cards.find((c) => c.id === 'users')?.href).toBe('/Management/x:Account/User');
    expect(cards.find((c) => c.id === 'users')?.objectType).toBe('x:Account');
  });

  it('skips cards when Query permission is missing', () => {
    const schema = minimalSchema();
    const cards = resolveQueryableCards(schema, OVERVIEW_CARDS, {}, () => false);
    expect(cards).toEqual([]);
  });
});

describe('deriveAttention', () => {
  it('flags queue backlog, cert expiry, and report problems', () => {
    expect(deriveAttention({ enrich: 'queueAttention' } as never, { status: 'ok', total: 3 })).toBe('warn');
    expect(deriveAttention({ enrich: 'certificateValidity' } as never, { status: 'ok', total: 2, expired: 1 })).toBe(
      'danger',
    );
    expect(
      deriveAttention({ enrich: 'certificateValidity' } as never, {
        status: 'ok',
        total: 2,
        expired: 0,
        expiringSoon: 1,
      }),
    ).toBe('warn');
    expect(deriveAttention({ enrich: 'reportProblems' } as never, { status: 'ok', total: 10, problemCount: 2 })).toBe(
      'danger',
    );
    expect(deriveAttention({ enrich: 'queueAttention' } as never, { status: 'ok', total: 0 })).toBe('none');
  });
});
