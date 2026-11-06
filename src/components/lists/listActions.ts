/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { resolveObject } from '@/lib/schemaResolver';
import type { ObjectAction } from '@/lib/permissions';
import type { ItemAction, MassAction, Schema } from '@/types/schema';
import { filteredListSearch } from './listUrlState';

export interface ActionPermissions {
  hasObjectPermission: (permissionPrefix: string, action: ObjectAction) => boolean;
  isCommunity: boolean;
}

export type ResolvedItemAction =
  | { key: string; kind: 'separator' }
  | { key: string; kind: 'navigate'; label: string; objectName: string; fieldName?: string; locked: boolean }
  | { key: string; kind: 'mutation'; action: Extract<ItemAction, { type: 'delete' | 'setProperty' }> };

function actionIdentity(action: ItemAction | MassAction): string {
  switch (action.type) {
    case 'separator':
      return 'separator';
    case 'view':
      return `view:${action.objectName}:${action.label}`;
    case 'query':
      return `query:${action.objectName}:${action.fieldName}:${action.label}`;
    default:
      return `${action.type}:${action.label}`;
  }
}

export function withStableKeys<T extends ItemAction | MassAction>(actions: readonly T[]): { key: string; action: T }[] {
  const seen = new Map<string, number>();
  return actions.map((action) => {
    const base = actionIdentity(action);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return { key: count === 0 ? base : `${base}#${count}`, action };
  });
}

export function trimSeparators<T>(entries: T[], isSep: (entry: T) => boolean): T[] {
  const out: T[] = [];
  for (const entry of entries) {
    if (isSep(entry) && (out.length === 0 || isSep(out[out.length - 1]))) continue;
    out.push(entry);
  }
  while (out.length > 0 && isSep(out[out.length - 1])) out.pop();
  return out;
}

export function resolveItemActions(
  schema: Schema,
  actions: readonly ItemAction[] | undefined,
  permissionPrefix: string,
  perms: ActionPermissions,
): ResolvedItemAction[] {
  if (!actions || actions.length === 0) return [];
  const out: ResolvedItemAction[] = [];
  for (const { key, action } of withStableKeys(actions)) {
    switch (action.type) {
      case 'separator':
        out.push({ key, kind: 'separator' });
        break;
      case 'delete':
        if (perms.hasObjectPermission(permissionPrefix, 'Destroy')) out.push({ key, kind: 'mutation', action });
        break;
      case 'setProperty':
        if (perms.hasObjectPermission(permissionPrefix, 'Update')) out.push({ key, kind: 'mutation', action });
        break;
      case 'view':
      case 'query': {
        const target = resolveObject(schema, action.objectName);
        if (!target) break;
        const locked = !!target.enterprise && perms.isCommunity;
        if (!locked && !perms.hasObjectPermission(target.permissionPrefix, 'Get')) break;
        out.push({
          key,
          kind: 'navigate',
          label: action.label,
          objectName: action.objectName,
          fieldName: action.type === 'query' ? action.fieldName : undefined,
          locked,
        });
        break;
      }
    }
  }
  return trimSeparators(out, (entry) => entry.kind === 'separator');
}

export function itemActionHref(
  action: Extract<ResolvedItemAction, { kind: 'navigate' }>,
  itemId: string,
  sectionFor: (viewName: string) => string | undefined,
  fallbackSection: string | undefined,
  viewFor: (objectName: string) => string | null = () => null,
): string | null {
  const target = viewFor(action.objectName) ?? action.objectName;
  const section = sectionFor(target) ?? fallbackSection;
  if (!section) return null;
  if (action.fieldName === undefined) return `/${section}/${target}/${itemId}`;
  return `/${section}/${target}?${filteredListSearch(action.fieldName, itemId)}`;
}

export interface ObjectKindInfo {
  isObject: boolean;
  permissionPrefix: string;
}

export function resolveMassActions(
  actions: readonly MassAction[] | undefined,
  info: ObjectKindInfo,
  perms: Pick<ActionPermissions, 'hasObjectPermission'>,
  defaultDeleteLabel: string,
): { key: string; action: MassAction }[] {
  const canDestroy = info.isObject && perms.hasObjectPermission(info.permissionPrefix, 'Destroy');
  const canUpdate = perms.hasObjectPermission(info.permissionPrefix, 'Update');
  const base = [...(actions ?? [])];
  if (canDestroy && !base.some((a) => a.type === 'delete')) {
    base.push({ type: 'delete', label: defaultDeleteLabel });
  }
  const allowed = withStableKeys(base).filter(({ action }) => {
    if (action.type === 'delete') return canDestroy;
    if (action.type === 'setProperty') return canUpdate;
    return true;
  });
  return trimSeparators(allowed, (entry) => entry.action.type === 'separator');
}
