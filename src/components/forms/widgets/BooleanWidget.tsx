/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { Switch } from '@/components/ui/switch';
import type { WidgetProps } from '@/components/forms/widgets/types';
import type { FieldTypeBoolean } from '@/types/schema';

export function BooleanWidget({ value, onChange, readOnly, control }: WidgetProps<FieldTypeBoolean>) {
  return (
    <Switch
      {...control}
      checked={value === true}
      disabled={readOnly}
      onCheckedChange={(checked) => onChange(checked)}
    />
  );
}
