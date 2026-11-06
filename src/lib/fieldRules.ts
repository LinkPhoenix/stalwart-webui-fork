/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { SECRET_MASK } from '@/lib/jmapUtils';
import type { Field } from '@/types/schema';

const REQUIRABLE_TYPES = new Set(['string', 'number', 'utcDateTime', 'enum', 'blobId', 'objectId']);

export function isRequiredField(field: Field, mode: 'create' | 'edit' = 'create'): boolean {
  const type = field.type;
  if (!REQUIRABLE_TYPES.has(type.type)) return false;
  if ('nullable' in type && type.nullable) return false;
  if (field.update === 'serverSet') return false;
  if (mode === 'edit' && field.update === 'immutable') return false;
  return true;
}

export function isMissingValue(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

export function isSecretField(field: Field): boolean {
  return field.type.type === 'string' && (field.type.format === 'secret' || field.type.format === 'secretText');
}

export function isUnchangedSecret(field: Field, value: unknown): boolean {
  return isSecretField(field) && value === SECRET_MASK;
}
