/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';

import { resolveObject, resolveList } from '@/lib/schemaResolver';
import { usePermissionCheckers } from '@/hooks/usePermissions';
import type { Schema } from '@/types/schema';

export function coerceLabel(value: unknown, fallback: string): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value))
    return value.length > 0
      ? value
          .map((v) => coerceLabel(v, ''))
          .filter(Boolean)
          .join(', ')
      : fallback;
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    return keys.length > 0 ? keys.join(', ') : fallback;
  }
  return fallback;
}

export function useNoPermissionMessage(schema: Schema, viewOrObjectName: string): string | null {
  const { t } = useTranslation();
  const { hasObjectPermission } = usePermissionCheckers();
  const resolved = resolveObject(schema, viewOrObjectName);
  if (!resolved) return null;
  const prefix = resolved.permissionPrefix;
  if (hasObjectPermission(prefix, 'Get') && hasObjectPermission(prefix, 'Query')) return null;
  const list = resolveList(schema, viewOrObjectName, resolved.objectName);
  const name = list?.pluralName ?? resolved.objectName;
  return t('field.noPermissionToView', 'You do not have permission to view {{name}}', { name });
}
