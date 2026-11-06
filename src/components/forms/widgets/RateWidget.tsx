/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { useResetOnChange } from '@/hooks/useBufferedValue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DURATION_UNITS, humanToMs, msToHuman } from '@/lib/durationFormat';
import { formatDuration, formatNumber } from '@/lib/format';
import { useDurationUnitLabel } from '@/components/forms/widgets/useDurationUnitLabel';
import type { WidgetProps } from '@/components/forms/widgets/types';
import type { FieldTypeObject } from '@/types/schema';

interface RateValue {
  count?: number;
  period?: number;
}

export function RateWidget({ type, value, onChange, readOnly, control }: WidgetProps<FieldTypeObject>) {
  const { t } = useTranslation();
  const durationLabel = useDurationUnitLabel();
  const rate = value as RateValue | null | undefined;
  const isNull = rate == null;
  const count = typeof rate?.count === 'number' ? rate.count : 0;
  const periodMs = typeof rate?.period === 'number' ? rate.period : 0;
  const human = msToHuman(periodMs);

  const [localCount, setLocalCount] = useState(String(count));
  const [localPeriod, setLocalPeriod] = useState(String(human.value));
  useResetOnChange(count, () => setLocalCount(String(count)));
  useResetOnChange(human.value, () => setLocalPeriod(String(human.value)));

  const commitCount = () => {
    const n = parseInt(localCount, 10);
    const next = !localCount || Number.isNaN(n) ? 0 : n;
    if (next !== count) onChange({ count: next, period: periodMs });
  };
  const commitPeriod = () => {
    const n = parseFloat(localPeriod);
    const next = !localPeriod || Number.isNaN(n) ? 0 : n;
    if (next !== human.value) onChange({ count, period: humanToMs(next, human.unit) });
  };

  if (readOnly) {
    if (isNull) return <span className="text-sm italic text-dim">{t('field.notSet', 'Not set')}</span>;
    return (
      <span className="text-sm">
        {t('rate.summary', '{{amount}} per {{period}}', {
          amount: formatNumber(count),
          period: formatDuration(periodMs),
        })}
      </span>
    );
  }

  if (isNull) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm italic text-dim">{t('field.notSet', 'Not set')}</span>
        <Button
          {...control}
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange({ count: 1, period: 1000 })}
        >
          <Plus aria-hidden="true" />
          {t('field.enable', 'Enable')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        {...control}
        type="number"
        min={1}
        step={1}
        value={localCount}
        className="w-24"
        aria-label={t('rate.count', 'Count')}
        onChange={(e) => setLocalCount(e.target.value)}
        onBlur={commitCount}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitCount();
        }}
      />
      <span className="shrink-0 text-sm text-muted-foreground">{t('rate.per', 'per')}</span>
      <Input
        type="number"
        min={0}
        step={1}
        value={localPeriod}
        className="w-24"
        aria-label={t('rate.periodValue', 'Period value')}
        onChange={(e) => setLocalPeriod(e.target.value)}
        onBlur={commitPeriod}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitPeriod();
        }}
      />
      <Select value={human.unit} onValueChange={(u) => onChange({ count, period: humanToMs(human.value, u) })}>
        <SelectTrigger className="w-32" aria-label={t('field.unit', 'Unit')}>
          <SelectValue>{durationLabel(human.unit)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {DURATION_UNITS.map((u) => (
            <SelectItem key={u} value={u}>
              {durationLabel(u)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {type.nullable && (
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
