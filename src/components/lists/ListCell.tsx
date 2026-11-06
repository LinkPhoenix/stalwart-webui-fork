/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { FieldValue, VariantValue } from '@/components/values/FieldValue';
import { EmptyValue } from '@/components/values/ScalarValues';
import type { Field, Schema } from '@/types/schema';
import { scalarText } from './listQuery';

interface ListCellProps {
  schema: Schema;
  objectName: string;
  column: string;
  field: Field | undefined;
  value: unknown;
}

export function ListCell({ schema, objectName, column, field, value }: ListCellProps) {
  if (field) return <FieldValue schema={schema} type={field.type} value={value} variant="compact" />;
  if (column === '@type' && typeof value === 'string' && value) {
    return <VariantValue schema={schema} objectName={objectName} value={value} />;
  }
  const text = scalarText(value);
  return text ? <>{text}</> : <EmptyValue variant="compact" />;
}
