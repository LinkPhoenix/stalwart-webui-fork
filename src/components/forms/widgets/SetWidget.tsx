/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EnumMultiSelect } from '@/components/forms/widgets/EnumWidgets';
import { ObjectIdMultiSelect } from '@/components/forms/widgets/ObjectIdWidgets';
import { RemovablePill } from '@/components/forms/widgets/RemovablePill';
import { formatPlaceholder } from '@/components/forms/widgets/placeholders';
import { isRecord } from '@/lib/embeddedSchema';
import type { ControlProps, WidgetProps } from '@/components/forms/widgets/types';
import type { FieldTypeSet } from '@/types/schema';

function toSetObject(items: string[]): Record<string, true> {
  const obj: Record<string, true> = {};
  for (const item of items) obj[item] = true;
  return obj;
}

export function SetWidget({ type, formField, value, onChange, readOnly, control }: WidgetProps<FieldTypeSet>) {
  const items = isRecord(value) ? Object.keys(value) : [];
  const commit = (next: string[]) => onChange(toSetObject(next));
  const scalar = type.class;

  switch (scalar.type) {
    case 'string':
      return (
        <TagInput
          label={formField.label}
          items={items}
          onChange={commit}
          readOnly={readOnly}
          minItems={type.minItems}
          maxItems={type.maxItems}
          placeholder={formField.placeholder ?? formatPlaceholder(scalar.format)}
          control={control}
        />
      );
    case 'enum':
      return (
        <EnumMultiSelect
          enumName={scalar.enumName}
          items={items}
          onChange={commit}
          readOnly={readOnly}
          minItems={type.minItems}
          control={control}
        />
      );
    case 'objectId':
      return (
        <ObjectIdMultiSelect
          objectName={scalar.objectName}
          label={formField.label}
          items={items}
          onChange={commit}
          readOnly={readOnly}
          minItems={type.minItems}
          control={control}
        />
      );
    default: {
      const unknownScalar: never = scalar;
      void unknownScalar;
      return null;
    }
  }
}

interface TagInputProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  readOnly: boolean;
  minItems?: number;
  maxItems?: number;
  placeholder?: string;
  control: ControlProps;
}

function TagInput({ label, items, onChange, readOnly, minItems, maxItems, placeholder, control }: TagInputProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const full = maxItems != null && items.length >= maxItems;

  const addTag = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || items.includes(trimmed) || full) return;
    onChange([...items, trimmed]);
    setInputValue('');
  };

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <RemovablePill
              key={item}
              label={item}
              onRemove={readOnly ? undefined : () => onChange(items.filter((i) => i !== item))}
              removeDisabled={minItems != null && items.length <= minItems}
            />
          ))}
        </div>
      )}
      {!readOnly && (
        <div className="flex items-center gap-2">
          <Input
            {...control}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
            disabled={full}
            placeholder={placeholder ?? t('field.typeAndPressEnter', 'Type and press Enter...')}
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="shrink-0"
            onClick={addTag}
            disabled={!inputValue.trim() || full}
            aria-label={t('field.addValue', 'Add {{name}}', { name: label })}
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}
