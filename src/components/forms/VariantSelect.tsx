/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldLabel } from '@/components/forms/FieldRow';
import { fieldIds, useFieldScope, useFormContext, useInPanel } from '@/components/forms/formContext';
import { VARIANT_FIELD } from '@/components/forms/formLogic';
import type { EmbeddedVariant } from '@/lib/embeddedSchema';
import { cn } from '@/lib/utils';

const SEGMENTED_MAX_VARIANTS = 4;
const SEGMENTED_MAX_LABEL_CHARS = 44;

interface VariantSelectProps {
  label?: string;
  labelledBy?: string;
  ariaLabel?: string;
  variants: readonly EmbeddedVariant[];
  value: string;
  onChange: (variant: string) => void;
  readOnly: boolean;
}

function isSegmented(variants: readonly EmbeddedVariant[]): boolean {
  return (
    variants.length > 1 &&
    variants.length <= SEGMENTED_MAX_VARIANTS &&
    variants.reduce((sum, v) => sum + v.label.length, 0) <= SEGMENTED_MAX_LABEL_CHARS
  );
}

interface VariantControlProps {
  id: string;
  labelledBy?: string;
  ariaLabel?: string;
  variants: readonly EmbeddedVariant[];
  value: string;
  onChange: (variant: string) => void;
  readOnly: boolean;
}

const ROVING_KEYS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

function moveRadioFocus(e: KeyboardEvent<HTMLDivElement>) {
  const step = Object.hasOwn(ROVING_KEYS, e.key) ? ROVING_KEYS[e.key] : 0;
  if (!step && e.key !== 'Home' && e.key !== 'End') return;
  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
  if (radios.length === 0) return;
  e.preventDefault();
  const current = radios.indexOf(document.activeElement as HTMLButtonElement);
  const next =
    e.key === 'Home'
      ? 0
      : e.key === 'End'
        ? radios.length - 1
        : (Math.max(current, 0) + step + radios.length) % radios.length;
  radios[next].focus();
}

function SegmentedVariants({ id, labelledBy, ariaLabel, variants, value, onChange, readOnly }: VariantControlProps) {
  const inPanel = useInPanel();
  const hasChecked = variants.some((v) => v.name === value);
  return (
    <div
      role="radiogroup"
      id={id}
      aria-labelledby={labelledBy}
      aria-label={ariaLabel}
      aria-disabled={readOnly || undefined}
      onKeyDown={moveRadioFocus}
      className={cn(
        'inline-flex max-w-full flex-wrap gap-0.5 rounded-full p-1',
        inPanel ? 'bg-muted-strong' : 'bg-muted',
      )}
    >
      {variants.map((v, i) => {
        const checked = v.name === value;
        return (
          <button
            key={v.name}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (!hasChecked && i === 0) ? 0 : -1}
            disabled={readOnly}
            onClick={() => {
              if (!checked) onChange(v.name);
            }}
            className={cn(
              'inline-flex h-7 items-center rounded-full px-3 text-[13px] font-semibold text-muted-foreground outline-none transition-[color,background-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
              checked ? 'bg-card text-foreground shadow-tile' : 'hover:text-foreground',
            )}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

function DropdownVariants({ id, labelledBy, ariaLabel, variants, value, onChange, readOnly }: VariantControlProps) {
  const { t } = useTranslation();
  return (
    <Select value={value} onValueChange={onChange} disabled={readOnly}>
      <SelectTrigger id={id} className="w-full" aria-labelledby={labelledBy} aria-label={ariaLabel}>
        <SelectValue placeholder={t('form.selectType', 'Select type...')} />
      </SelectTrigger>
      <SelectContent>
        {variants.map((v) => (
          <SelectItem key={v.name} value={v.name}>
            {v.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function VariantSelect({
  label,
  labelledBy,
  ariaLabel,
  variants,
  value,
  onChange,
  readOnly,
}: VariantSelectProps) {
  const { t } = useTranslation();
  const ctx = useFormContext();
  const scope = useFieldScope();
  const ids = fieldIds(ctx.idPrefix, [...scope.path, VARIANT_FIELD]);
  const external = !!labelledBy || !!ariaLabel;
  const segmented = isSegmented(variants);
  const Control = segmented ? SegmentedVariants : DropdownVariants;
  const controlProps = {
    id: ids.inputId,
    variants,
    value,
    onChange,
    readOnly,
  };

  if (external) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-dim" aria-hidden="true">
          {t('field.type', 'Type')}
        </span>
        <div className={cn('min-w-0', !segmented && 'w-full max-w-sm')}>
          <Control {...controlProps} labelledBy={labelledBy} ariaLabel={ariaLabel} />
        </div>
      </div>
    );
  }

  return (
    <div data-slot="field-row" className="field-grid py-4">
      <div className="@xl:pt-2">
        <FieldLabel
          id={ids.labelId}
          htmlFor={segmented ? undefined : ids.inputId}
          label={label || t('field.type', 'Type')}
          marker={null}
          locked={false}
        />
      </div>
      <div className="min-w-0">
        <Control {...controlProps} labelledBy={segmented ? ids.labelId : undefined} />
      </div>
    </div>
  );
}
