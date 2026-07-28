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
import { Separator } from '@/components/ui/separator';

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

interface ExpressionEditorProps {
  value: {
    match: Record<string, { if: string; then: string }>;
    else: string;
  };
  onChange: (value: { match: Record<string, { if: string; then: string }>; else: string }) => void;
  readOnly?: boolean;
}

export function ExpressionEditor({ value, onChange, readOnly = false }: ExpressionEditorProps) {
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
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {matchEntries.map(([key, entry], index) => (
        <div key={key}>
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-12 shrink-0">
                {t('expression.if', 'IF')}
              </span>
              <BufferedExprInput
                value={entry.if}
                onCommit={(v) => handleConditionChange(key, 'if', v)}
                disabled={readOnly}
                placeholder={t('expression.condition', 'Condition')}
                className="flex-1"
              />
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(key)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-12 shrink-0">
                {t('expression.then', 'THEN')}
              </span>
              <BufferedExprInput
                value={entry.then}
                onCommit={(v) => handleConditionChange(key, 'then', v)}
                disabled={readOnly}
                placeholder={t('expression.result', 'Result')}
                className="flex-1"
              />
              {!readOnly && <div className="w-8 shrink-0" />}
            </div>
          </div>
          {index < matchEntries.length - 1 && <Separator className="my-3" />}
        </div>
      ))}

      {!readOnly && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAdd}
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            {t('expression.addCondition', 'Add condition')}
          </Button>
        </div>
      )}

      {matchEntries.length > 0 && <Separator />}
      <div className="flex items-center gap-2">
        {matchEntries.length > 0 && (
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-12 shrink-0">
            {t('expression.else', 'ELSE')}
          </span>
        )}
        <BufferedExprInput
          value={value.else}
          onCommit={handleElseChange}
          disabled={readOnly}
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
