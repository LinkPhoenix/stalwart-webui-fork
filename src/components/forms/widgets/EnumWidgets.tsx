/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HelpTooltip } from '@/components/common/HelpTooltip';
import { usePermissionCheckers } from '@/hooks/usePermissions';
import { getEnum } from '@/lib/schemaResolver';
import { useFormContext } from '@/components/forms/formContext';
import { RemovablePill } from '@/components/forms/widgets/RemovablePill';
import type { ControlProps, WidgetProps } from '@/components/forms/widgets/types';
import type { EnumVariant, FieldTypeEnum } from '@/types/schema';

function ColorDot({ color, size = 'h-2.5 w-2.5' }: { color?: string; size?: string }) {
  if (!color) return null;
  return (
    <span
      className={`inline-block shrink-0 rounded-full ${size}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

function useEnumVariants(enumName: string): readonly EnumVariant[] {
  const { schema } = useFormContext();
  const { hasPermission } = usePermissionCheckers();
  const variants = getEnum(schema, enumName);
  return enumName === 'Permission' ? variants.filter((v) => hasPermission(v.name)) : variants;
}

export function EnumWidget({ type, value, onChange, readOnly, control }: WidgetProps<FieldTypeEnum>) {
  const { t } = useTranslation();
  const variants = useEnumVariants(type.enumName);
  const options: ComboboxOption[] = variants.map((v) => ({
    value: v.name,
    label: v.label,
    description: v.explanation || undefined,
    keywords: [v.name],
    marker: v.color ? <ColorDot color={v.color} /> : undefined,
  }));

  return (
    <Combobox
      {...control}
      options={options}
      value={typeof value === 'string' ? value : ''}
      onValueChange={(v) => onChange(v === '' ? null : v)}
      placeholder={t('field.selectEllipsis', 'Select...')}
      searchPlaceholder={t('common.searchPlaceholder', 'Search...')}
      emptyText={t('field.noMatches', 'No matches')}
      nullLabel={t('field.none', 'None')}
      nullable={type.nullable}
      disabled={readOnly}
    />
  );
}

interface EnumMultiSelectProps {
  enumName: string;
  items: string[];
  onChange: (items: string[]) => void;
  readOnly: boolean;
  minItems?: number;
  control: ControlProps;
}

const SEARCHABLE_THRESHOLD = 10;
const GRID_THRESHOLD = 3;

export function EnumMultiSelect({ enumName, items, onChange, readOnly, minItems, control }: EnumMultiSelectProps) {
  const { t } = useTranslation();
  const variants = useEnumVariants(enumName);
  const baseId = control.id ?? `enum-${enumName}`;
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);
  const atMinimum = minItems != null && items.length <= minItems;

  const toggle = (name: string) => {
    if (items.includes(name)) {
      if (atMinimum) return;
      onChange(items.filter((i) => i !== name));
    } else {
      onChange([...items, name]);
    }
  };

  const checkboxItem = (v: EnumVariant, idPrefix: string) => {
    const id = `${idPrefix}-${v.name.replace(/[^A-Za-z0-9_-]/g, '_')}`;
    return (
      <div key={v.name} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted">
        <Checkbox
          id={id}
          checked={items.includes(v.name)}
          onCheckedChange={() => toggle(v.name)}
          disabled={readOnly || (items.includes(v.name) && atMinimum)}
        />
        <Label htmlFor={id} className="flex flex-1 cursor-pointer items-center gap-2 text-sm font-normal">
          <ColorDot color={v.color} />
          {v.label}
        </Label>
        {v.explanation && <HelpTooltip content={v.explanation} label={v.label} />}
      </div>
    );
  };

  if (variants.length <= SEARCHABLE_THRESHOLD) {
    return (
      <div
        className={
          variants.length > GRID_THRESHOLD ? '-mx-2 grid gap-x-2 gap-y-0.5 sm:grid-cols-2' : '-mx-2 space-y-0.5'
        }
      >
        {variants.map((v) => checkboxItem(v, baseId))}
      </div>
    );
  }

  const query = searchQuery.toLowerCase();
  const filtered = query
    ? variants.filter((v) => v.label.toLowerCase().includes(query) || v.name.toLowerCase().includes(query))
    : variants;

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((name) => {
            const variant = variants.find((v) => v.name === name);
            const label = variant?.label ?? name;
            return (
              <RemovablePill
                key={name}
                label={label}
                onRemove={readOnly ? undefined : () => toggle(name)}
                removeDisabled={atMinimum}
              >
                <ColorDot color={variant?.color} size="h-2 w-2" />
                {label}
              </RemovablePill>
            );
          })}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button {...control} type="button" variant="secondary" size="sm" disabled={readOnly}>
            <Search aria-hidden="true" />
            {t('field.selectOptions', 'Select options...')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 overflow-hidden p-0" align="start">
          <div className="p-2 pb-1">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('common.searchPlaceholder', 'Search...')}
              aria-label={t('common.search', 'Search')}
              variant="pill"
              className="h-8 px-3.5"
            />
          </div>
          <div className="max-h-60 space-y-0.5 overflow-y-auto p-1.5">
            {filtered.length === 0 && (
              <p className="py-2 text-center text-sm text-muted-foreground">{t('field.noMatches', 'No matches')}</p>
            )}
            {filtered.map((v) => checkboxItem(v, `${baseId}-dd`))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
