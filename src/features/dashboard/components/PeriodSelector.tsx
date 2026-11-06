/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, CalendarClock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useDashboardStore } from '../stores/dashboardStore';
import type { PresetKey } from '../types/metrics';
import { presetLabel, PRESET_KEYS } from '../types/metrics';

interface PeriodSelectorProps {
  onRefresh: () => void;
  loading?: boolean;
}

export function PeriodSelector({ onRefresh, loading }: PeriodSelectorProps) {
  const { t } = useTranslation();
  const period = useDashboardStore((s) => s.period);
  const setPreset = useDashboardStore((s) => s.setPreset);
  const setPeriod = useDashboardStore((s) => s.setPeriod);
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const currentValue = period.kind === 'preset' ? period.preset : 'custom';

  const handleSelectChange = (value: string) => {
    if (value === 'custom') {
      setCustomOpen(true);
    } else {
      setPreset(value as PresetKey);
    }
  };

  const customValid = !!customFrom && !!customTo && new Date(customFrom) < new Date(customTo);

  const handleApplyCustom = () => {
    if (customValid) {
      setPeriod({
        kind: 'custom',
        from: new Date(customFrom),
        to: new Date(customTo),
      });
      setCustomOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverAnchor>
          <Select value={currentValue} onValueChange={handleSelectChange}>
            <SelectTrigger variant="pill" aria-label={t('dashboard.period', 'Period')}>
              <CalendarClock aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESET_KEYS.map((key) => (
                <SelectItem key={key} value={key}>
                  {presetLabel(t, key)}
                </SelectItem>
              ))}
              <SelectItem value="custom">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  {t('dashboard.customEllipsis', 'Custom...')}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </PopoverAnchor>

        <PopoverContent className="w-72 p-4" align="end">
          <div className="space-y-3">
            <h4 className="section-title text-sm">{t('dashboard.customRange', 'Custom range')}</h4>
            <div className="space-y-2">
              <Label htmlFor="custom-from" className="text-xs">
                {t('dashboard.from', 'From')}
              </Label>
              <Input
                id="custom-from"
                type="datetime-local"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-to" className="text-xs">
                {t('dashboard.to', 'To')}
              </Label>
              <Input
                id="custom-to"
                type="datetime-local"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
            <Button size="sm" className="w-full" onClick={handleApplyCustom} disabled={!customValid}>
              {t('common.apply', 'Apply')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="icon"
        onClick={onRefresh}
        disabled={loading}
        className="size-8"
        aria-label={t('dashboard.refresh', 'Refresh')}
      >
        <RefreshCw aria-hidden="true" className={cn('size-4', loading && 'animate-spin')} />
      </Button>
    </div>
  );
}
