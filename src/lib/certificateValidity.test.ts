/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { describe, expect, it } from 'vitest';

import { CERT_EXPIRING_SOON_MS, certificateExpiryMs, certificateValidity } from '@/lib/certificateValidity';
import { withCertificateColumns } from '@/lib/certificateColumns';
import {
  CERTIFICATE_STATUS_COLUMN,
  expandListProperties,
  getClientSortValue,
  hasSyntheticCell,
  isSyntheticColumn,
} from '@/lib/syntheticColumns';
import type { Schema } from '@/types/schema';

const NOW = Date.parse('2026-11-15T12:00:00Z');

describe('certificateValidity', () => {
  it('treats a missing or unparseable notValidAfter as expired', () => {
    expect(certificateValidity(undefined, NOW)).toBe('expired');
    expect(certificateValidity(null, NOW)).toBe('expired');
    expect(certificateValidity(42, NOW)).toBe('expired');
    expect(certificateValidity('not-a-date', NOW)).toBe('expired');
  });

  it('treats a past expiry as expired', () => {
    expect(certificateValidity('2026-11-15T11:59:59Z', NOW)).toBe('expired');
    expect(certificateValidity('2026-11-15T12:00:00Z', NOW)).toBe('expired');
  });

  it('treats an expiry within 30 days as expiring soon', () => {
    expect(certificateValidity('2026-11-15T12:00:01Z', NOW)).toBe('expiringSoon');
    expect(certificateValidity(new Date(NOW + CERT_EXPIRING_SOON_MS).toISOString(), NOW)).toBe('expiringSoon');
  });

  it('treats a later expiry as valid', () => {
    expect(certificateValidity(new Date(NOW + CERT_EXPIRING_SOON_MS + 1000).toISOString(), NOW)).toBe('valid');
    expect(certificateValidity('2999-01-01T00:00:00Z', NOW)).toBe('valid');
  });
});

describe('certificateExpiryMs', () => {
  it('returns the expiry timestamp, or -1 for missing/invalid dates', () => {
    expect(certificateExpiryMs('2027-01-01T00:00:00Z')).toBe(Date.parse('2027-01-01T00:00:00Z'));
    expect(certificateExpiryMs(undefined)).toBe(-1);
    expect(certificateExpiryMs('nope')).toBe(-1);
  });
});

function schemaWithCertList(): Schema {
  return {
    objects: {},
    schemas: {},
    fields: {},
    forms: {},
    lists: {
      'x:Certificate': {
        title: 'TLS certificates',
        subtitle: 'Manage TLS certificates',
        labelProperty: 'subjectAlternativeNames',
        singularName: 'certificate',
        pluralName: 'certificates',
        columns: [{ name: 'subjectAlternativeNames', label: 'Subject Alternative Names' }],
        filters: [],
      },
    },
    enums: {},
    dashboards: [],
    layouts: [],
  } as unknown as Schema;
}

describe('withCertificateColumns', () => {
  it('appends a clientSortable validityStatus column', () => {
    const schema = withCertificateColumns(schemaWithCertList());
    const columns = schema.lists['x:Certificate'].columns;
    expect(columns.map((c) => c.name)).toEqual(['subjectAlternativeNames', 'validityStatus']);
    expect((columns[1] as { clientSortable?: boolean }).clientSortable).toBe(true);
  });

  it('leaves schemas without an x:Certificate list untouched', () => {
    const schema = schemaWithCertList();
    delete schema.lists['x:Certificate'];
    expect(withCertificateColumns(schema)).toBe(schema);
  });
});

describe('synthetic column wiring for validityStatus', () => {
  it('is recognized as synthetic and gets a SyntheticCell', () => {
    expect(isSyntheticColumn(CERTIFICATE_STATUS_COLUMN)).toBe(true);
    expect(hasSyntheticCell(CERTIFICATE_STATUS_COLUMN, 'x:Certificate')).toBe(true);
  });

  it('requests notValidAfter when the column is present', () => {
    const props = expandListProperties(
      [{ name: 'subjectAlternativeNames' }, { name: CERTIFICATE_STATUS_COLUMN }],
      'x:Certificate',
    );
    expect(props).toContain('subjectAlternativeNames');
    expect(props).toContain('notValidAfter');
  });

  it('sorts by expiry timestamp, expired first', () => {
    const expired = getClientSortValue(CERTIFICATE_STATUS_COLUMN, { notValidAfter: '2020-01-01T00:00:00Z' });
    const soon = getClientSortValue(CERTIFICATE_STATUS_COLUMN, {
      notValidAfter: new Date(NOW + 86_400_000).toISOString(),
    });
    const valid = getClientSortValue(CERTIFICATE_STATUS_COLUMN, { notValidAfter: '2999-01-01T00:00:00Z' });
    expect(expired).toBeLessThan(soon as number);
    expect(soon).toBeLessThan(valid as number);
    expect(getClientSortValue(CERTIFICATE_STATUS_COLUMN, {})).toBe(-1);
  });
});
