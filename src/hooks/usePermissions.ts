/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useAccountStore, selectIsCommunity } from '@/stores/accountStore';
import { useSchemaStore } from '@/stores/schemaStore';
import { canAccessView, createPermissionCheckers, type ObjectAction, type PermissionCheckers } from '@/lib/permissions';

export function usePermissionCheckers(): PermissionCheckers {
  const permissions = useAccountStore((s) => s.permissions);
  return createPermissionCheckers(permissions);
}

export function useHasObjectPermission(permissionPrefix: string | null | undefined, action: ObjectAction): boolean {
  return useAccountStore((s) => !!permissionPrefix && s.permissions.includes(`${permissionPrefix}${action}`));
}

export function useCanAccess(viewName: string | null | undefined, action: ObjectAction = 'Get'): boolean {
  const schema = useSchemaStore((s) => s.schema);
  const checkers = usePermissionCheckers();
  return !!viewName && canAccessView(schema, viewName, action, checkers);
}

export function useIsCommunity(): boolean {
  return useAccountStore(selectIsCommunity);
}
