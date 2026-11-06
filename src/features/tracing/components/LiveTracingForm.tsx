/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, Play, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSchemaStore } from '@/stores/schemaStore';
import { getEnum } from '@/lib/schemaResolver';
import { upsertFilter, type KeyValueFilter } from '../liveTracing';

interface LiveTracingFormProps {
  keywords: string;
  onKeywordsChange: (keywords: string) => void;
  filters: KeyValueFilter[];
  onFiltersChange: (filters: KeyValueFilter[]) => void;
  starting: boolean;
  onStart: () => void;
}

export function LiveTracingForm({
  keywords,
  onKeywordsChange,
  filters,
  onFiltersChange,
  starting,
  onStart,
}: LiveTracingFormProps) {
  const { t } = useTranslation();
  const keywordsId = useId();
  const [addingFilter, setAddingFilter] = useState(false);

  return (
    <div className="mx-auto max-w-2xl space-y-3.5 pt-6">
      <div className="space-y-1 px-1 pb-1 pt-3">
        <h1 className="page-title">{t('tracing.liveTitle', 'Live Tracing')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('tracing.liveSubtitle', 'Stream server events in real time.')}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="space-y-2">
            <Label htmlFor={keywordsId}>{t('tracing.keywordsLabel', 'Keywords (optional)')}</Label>
            <Input
              id={keywordsId}
              placeholder={t('tracing.keywordsPlaceholder', 'Enter keywords to filter events...')}
              value={keywords}
              onChange={(e) => onKeywordsChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !starting) onStart();
              }}
            />
          </div>

          {filters.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label={t('tracing.activeFilters', 'Active filters')}>
              {filters.map((f) => (
                <li key={f.key}>
                  <Badge className="h-7 gap-1 pl-3 pr-1.5 text-[12.5px] font-medium">
                    {f.label} = {f.value}
                    <button
                      type="button"
                      onClick={() => onFiltersChange(filters.filter((other) => other.key !== f.key))}
                      className="ml-0.5 grid size-5 place-items-center rounded-full hover:bg-card hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={t('tracing.removeFilter', 'Remove filter {{label}}', { label: f.label })}
                    >
                      <X aria-hidden="true" className="h-3 w-3" />
                    </button>
                  </Badge>
                </li>
              ))}
            </ul>
          )}

          {addingFilter ? (
            <FilterEditor
              onAdd={(filter) => {
                onFiltersChange(upsertFilter(filters, filter));
                setAddingFilter(false);
              }}
              onCancel={() => setAddingFilter(false)}
            />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAddingFilter(true)}>
              <Plus aria-hidden="true" />
              {t('tracing.addFilter', 'Add filter')}
            </Button>
          )}

          <Button className="w-full" onClick={onStart} disabled={starting}>
            {starting ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Play aria-hidden="true" />}
            {starting ? t('tracing.connecting', 'Connecting...') : t('tracing.startTracing', 'Start tracing')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function FilterEditor({ onAdd, onCancel }: { onAdd: (filter: KeyValueFilter) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const schema = useSchemaStore((s) => s.schema);
  const keyEnum = getEnum(schema, 'Key');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');

  const add = () => {
    const trimmed = value.trim();
    if (!key || !trimmed) return;
    const label = keyEnum.find((e) => e.name === key)?.label ?? key;
    onAdd({ key, label, value: trimmed });
  };

  return (
    <div className="flex items-center gap-2 rounded-xl bg-muted p-2">
      <Select value={key} onValueChange={setKey}>
        <SelectTrigger className="w-48" aria-label={t('tracing.filterKey', 'Filter key')}>
          <SelectValue placeholder={t('field.selectKey', 'Select key...')} />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {keyEnum.map((entry) => (
            <SelectItem key={entry.name} value={entry.name}>
              {entry.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        placeholder={t('tracing.valuePlaceholder', 'Value...')}
        aria-label={t('tracing.filterValue', 'Filter value')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1"
        onKeyDown={(e) => {
          if (e.key === 'Enter') add();
        }}
      />
      <Button size="icon" variant="ghost" onClick={add} aria-label={t('tracing.confirmFilter', 'Add this filter')}>
        <Check aria-hidden="true" className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" onClick={onCancel} aria-label={t('common.cancel', 'Cancel')}>
        <X aria-hidden="true" className="h-4 w-4" />
      </Button>
    </div>
  );
}
