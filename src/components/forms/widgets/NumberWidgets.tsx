/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useResetOnChange } from '@/hooks/useBufferedValue';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { bytesToHuman, humanToBytes, msToHuman, humanToMs, SIZE_UNITS, DURATION_UNITS } from '@/lib/durationFormat';
import { BufferedNumberInput } from '@/components/forms/widgets/BufferedInputs';
import { useDurationUnitLabel } from '@/components/forms/widgets/useDurationUnitLabel';
import type { WidgetProps } from '@/components/forms/widgets/types';
import type { FieldTypeNumber } from '@/types/schema';

export function NumberWidget({ type, value, onChange, readOnly, control }: WidgetProps<FieldTypeNumber>) {
  return (
    <BufferedNumberInput
      {...control}
      value={typeof value === 'number' ? value : null}
      format={type.format}
      min={type.min}
      max={type.max}
      nullable={type.nullable}
      disabled={readOnly}
      onCommit={(v) => onChange(v)}
    />
  );
}

interface UnitConversion {
  units: readonly string[];
  toHuman: (raw: number) => { value: number; unit: string };
  fromHuman: (value: number, unit: string) => number;
  triggerClass: string;
}

const SIZE_CONVERSION: UnitConversion = {
  units: SIZE_UNITS,
  toHuman: bytesToHuman,
  fromHuman: humanToBytes,
  triggerClass: 'w-24',
};

const DURATION_CONVERSION: UnitConversion = {
  units: DURATION_UNITS,
  toHuman: msToHuman,
  fromHuman: humanToMs,
  triggerClass: 'w-32',
};

export function SizeWidget(props: WidgetProps<FieldTypeNumber>) {
  return <UnitNumberWidget {...props} conversion={SIZE_CONVERSION} />;
}

export function DurationWidget(props: WidgetProps<FieldTypeNumber>) {
  return <UnitNumberWidget {...props} conversion={DURATION_CONVERSION} />;
}

function UnitNumberWidget({
  type,
  value,
  onChange,
  readOnly,
  control,
  conversion,
}: WidgetProps<FieldTypeNumber> & { conversion: UnitConversion }) {
  const { t } = useTranslation();
  const durationLabel = useDurationUnitLabel();
  const isDuration = conversion === DURATION_CONVERSION;
  const unitLabel = (u: string) => (isDuration ? durationLabel(u) : u);
  const isNull = value == null;
  const initial = conversion.toHuman(typeof value === 'number' ? value : 0);
  const [unit, setUnit] = useState(initial.unit);
  const [localStr, setLocalStr] = useState<string>(isNull ? '' : String(initial.value));

  useResetOnChange(value, () => {
    const h = conversion.toHuman(typeof value === 'number' ? value : 0);
    setUnit(h.unit);
    setLocalStr(value == null ? '' : String(h.value));
  });

  const commit = () => {
    if (localStr === '') {
      onChange(type.nullable ? null : 0);
      return;
    }
    const n = parseFloat(localStr);
    if (Number.isNaN(n)) return;
    const next = conversion.fromHuman(n, unit);
    if (next !== value) onChange(next);
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        {...control}
        type="number"
        value={localStr}
        placeholder={type.nullable ? t('field.notSet', 'Not set') : '0'}
        onChange={(e) => setLocalStr(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
        disabled={readOnly}
        min={0}
        step={1}
        className="flex-1"
      />
      <Select
        value={unit}
        disabled={readOnly}
        onValueChange={(u) => {
          setUnit(u);
          if (localStr !== '') {
            const n = parseFloat(localStr);
            if (!Number.isNaN(n)) onChange(conversion.fromHuman(n, u));
          }
        }}
      >
        <SelectTrigger className={conversion.triggerClass} aria-label={t('field.unit', 'Unit')}>
          <SelectValue>{unitLabel(unit)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {conversion.units.map((u) => (
            <SelectItem key={u} value={u}>
              {unitLabel(u)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {type.nullable && !isNull && !readOnly && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onChange(null)}
          aria-label={t('common.clear', 'Clear')}
        >
          <X aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
