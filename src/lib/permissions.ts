/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { Schema } from '@/types/schema';
import { resolveObject } from '@/lib/schemaResolver';

export type ObjectAction = 'Get' | 'Query' | 'Create' | 'Update' | 'Destroy';

export interface PermissionCheckers {
  hasPermission: (permission: string) => boolean;
  hasObjectPermission: (permissionPrefix: string, action: ObjectAction) => boolean;
  canGet: (permissionPrefix: string) => boolean;
}

const checkersCache = new WeakMap<readonly string[], PermissionCheckers>();

export function createPermissionCheckers(permissions: readonly string[]): PermissionCheckers {
  const cached = checkersCache.get(permissions);
  if (cached) return cached;
  const granted = new Set(permissions);
  const checkers: PermissionCheckers = {
    hasPermission: (permission) => granted.has(permission),
    hasObjectPermission: (permissionPrefix, action) => granted.has(`${permissionPrefix}${action}`),
    canGet: (permissionPrefix) => granted.has(`${permissionPrefix}Get`),
  };
  checkersCache.set(permissions, checkers);
  return checkers;
}

const definedPermissionsCache = new WeakMap<Schema, ReadonlySet<string>>();

function definedPermissions(schema: Schema): ReadonlySet<string> {
  let defined = definedPermissionsCache.get(schema);
  if (!defined) {
    defined = new Set((schema.enums['Permission'] ?? []).map((v) => v.name));
    definedPermissionsCache.set(schema, defined);
  }
  return defined;
}

export function isCreateOnly(schema: Schema, permissionPrefix: string): boolean {
  const defined = definedPermissions(schema);
  return defined.has(`${permissionPrefix}Create`) && !defined.has(`${permissionPrefix}Get`);
}

export function canAccessView(
  schema: Schema | null | undefined,
  viewName: string,
  action: ObjectAction,
  checkers: PermissionCheckers,
): boolean {
  if (!schema) return false;
  const resolved = resolveObject(schema, viewName);
  if (!resolved) return false;
  if ((action === 'Create' || action === 'Destroy') && resolved.objectType.type === 'singleton') return false;
  return checkers.hasObjectPermission(resolved.permissionPrefix, action);
}

export function isCommunityEdition(edition: string): boolean {
  return edition === 'community';
}
