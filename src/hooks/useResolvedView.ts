/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useSchemaStore } from '@/stores/schemaStore';
import { resolveView, type ResolvedView } from '@/lib/schemaResolver';

export function useResolvedView(viewName: string | null | undefined): ResolvedView | null {
  const schema = useSchemaStore((s) => s.schema);
  return schema && viewName ? resolveView(schema, viewName) : null;
}
