/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { ExpressionEditor, type ExpressionValue } from '@/components/expression/ExpressionEditor';
import { isRecord } from '@/lib/embeddedSchema';
import type { WidgetProps } from '@/components/forms/widgets/types';
import type { FieldTypeObject } from '@/types/schema';

function toExpression(value: unknown): ExpressionValue {
  const obj = isRecord(value) ? value : {};
  return {
    match: isRecord(obj.match) ? (obj.match as ExpressionValue['match']) : {},
    else: typeof obj.else === 'string' ? obj.else : '',
  };
}

export function ExpressionWidget({ formField, value, onChange, readOnly, control }: WidgetProps<FieldTypeObject>) {
  return (
    <ExpressionEditor
      value={toExpression(value)}
      onChange={onChange}
      readOnly={readOnly}
      label={formField.label}
      control={control}
    />
  );
}
