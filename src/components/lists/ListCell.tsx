/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { FieldValue, VariantValue } from '@/components/values/FieldValue';
import { EmptyValue } from '@/components/values/ScalarValues';
import { SizeDisplay } from '@/components/common/SizeDisplay';
import { effectiveNumberFormat } from '@/lib/byteSizeFormat';
import type { Field, Schema } from '@/types/schema';
import { scalarText } from './listQuery';
import { hasSyntheticCell } from '@/lib/syntheticColumns';
import { SyntheticCell } from './SyntheticCell';

interface ListCellProps {
  schema: Schema;
  objectName: string;
  column: string;
  field: Field | undefined;
  value: unknown;
  item: Record<string, unknown>;
}

export function ListCell({ schema, objectName, column, field, value, item }: ListCellProps) {
  if (hasSyntheticCell(column, objectName)) {
    return <SyntheticCell column={column} objectName={objectName} item={item} schema={schema} />;
  }
  // SCHEMA-DEVIATION: byte-size-number-format
  if (
    field?.type.type === 'number' &&
    typeof value === 'number' &&
    effectiveNumberFormat(column, field.type.format) === 'size'
  ) {
    return <SizeDisplay bytes={value} />;
  }
  if (field) return <FieldValue schema={schema} type={field.type} value={value} variant="compact" />;
  if (column === '@type' && typeof value === 'string' && value) {
    return <VariantValue schema={schema} objectName={objectName} value={value} />;
  }
  const text = scalarText(value);
  return text ? <>{text}</> : <EmptyValue variant="compact" />;
}
