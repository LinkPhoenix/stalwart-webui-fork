/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBufferedValue } from '@/hooks/useBufferedValue';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { X, Plus } from 'lucide-react';

function BufferedExprInput({
  value,
  onCommit,
  ...rest
}: { value: string; onCommit: (v: string) => void } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value'
>) {
  const [local, setLocal] = useBufferedValue(value);

  const commit = () => {
    if (local !== value) onCommit(local);
  };

  return (
    <Input
      {...rest}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
    />
  );
}

export interface ExpressionValue {
  match: Record<string, { if: string; then: string }>;
  else: string;
}

interface ExpressionEditorProps {
  value: ExpressionValue;
  onChange: (value: ExpressionValue) => void;
  readOnly?: boolean;
  label?: string;
  control?: {
    id?: string;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
    'aria-labelledby'?: string;
  };
}

export function ExpressionEditor({ value, onChange, readOnly = false, label, control }: ExpressionEditorProps) {
  const { t } = useTranslation();
  const [nextIndex, setNextIndex] = useState(() => {
    const keys = Object.keys(value.match).map(Number).filter(Number.isFinite);
    return keys.length > 0 ? Math.max(...keys) + 1 : 0;
  });

  const matchEntries = Object.entries(value.match);

  const handleConditionChange = (key: string, field: 'if' | 'then', fieldValue: string) => {
    onChange({
      ...value,
      match: {
        ...value.match,
        [key]: { ...value.match[key], [field]: fieldValue },
      },
    });
  };

  const handleElseChange = (elseValue: string) => {
    onChange({ ...value, else: elseValue });
  };

  const handleAdd = () => {
    const key = String(nextIndex);
    setNextIndex(nextIndex + 1);
    onChange({
      ...value,
      match: { ...value.match, [key]: { if: '', then: '' } },
    });
  };

  const handleRemove = (key: string) => {
    const { [key]: _removed, ...rest } = value.match;
    void _removed;
    onChange({ ...value, match: rest });
  };

  return (
    <div className="space-y-2.5 rounded-xl bg-muted p-3">
      {matchEntries.map(([key, entry], index) => (
        <div key={key}>
          <div className="space-y-2 rounded-lg bg-card p-3">
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-dim">
                {t('expression.if', 'IF')}
              </span>
              <BufferedExprInput
                value={entry.if}
                onCommit={(v) => handleConditionChange(key, 'if', v)}
                disabled={readOnly}
                aria-label={t('expression.conditionN', 'Condition {{n}}', { n: index + 1 })}
                placeholder={t('expression.condition', 'Condition')}
                className="flex-1"
              />
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost-danger"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={() => handleRemove(key)}
                  aria-label={t('expression.removeCondition', 'Remove condition {{n}}', { n: index + 1 })}
                >
                  <X aria-hidden="true" />
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-dim">
                {t('expression.then', 'THEN')}
              </span>
              <BufferedExprInput
                value={entry.then}
                onCommit={(v) => handleConditionChange(key, 'then', v)}
                disabled={readOnly}
                aria-label={t('expression.resultN', 'Result {{n}}', { n: index + 1 })}
                placeholder={t('expression.result', 'Result')}
                className="flex-1"
              />
              {!readOnly && <div className="w-8 shrink-0" />}
            </div>
          </div>
        </div>
      ))}

      {!readOnly && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAdd}
            className="h-7 gap-1 px-3 text-xs hover:bg-card"
          >
            <Plus className="!size-3.5" aria-hidden="true" />
            {t('expression.addCondition', 'Add condition')}
          </Button>
        </div>
      )}

      <div className={cn('flex items-center gap-2', matchEntries.length > 0 && 'border-t border-border pt-2.5')}>
        {matchEntries.length > 0 && (
          <span className="w-12 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-dim">
            {t('expression.else', 'ELSE')}
          </span>
        )}
        <BufferedExprInput
          value={value.else}
          onCommit={handleElseChange}
          disabled={readOnly}
          id={control?.id}
          aria-invalid={control?.['aria-invalid']}
          aria-label={
            matchEntries.length > 0
              ? t('expression.defaultValue', 'Default value')
              : (label ?? t('expression.value', 'Value'))
          }
          placeholder={
            matchEntries.length > 0 ? t('expression.defaultValue', 'Default value') : t('expression.value', 'Value')
          }
          className="flex-1"
        />
        {!readOnly && matchEntries.length > 0 && <div className="w-8 shrink-0" />}
      </div>
    </div>
  );
}
