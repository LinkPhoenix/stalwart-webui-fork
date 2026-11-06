/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useBufferedValue } from '@/hooks/useBufferedValue';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { NumberFormat } from '@/types/schema';

interface BufferedInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onCommit: (v: string) => void;
}

export function BufferedInput({ value, onCommit, onBlur, onKeyDown, ...rest }: BufferedInputProps) {
  const [local, setLocal] = useBufferedValue(value);

  const commit = () => {
    if (local !== value) onCommit(local);
  };

  return (
    <Input
      {...rest}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={(e) => {
        commit();
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        onKeyDown?.(e);
      }}
    />
  );
}

interface BufferedTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  variant?: 'field' | 'bare';
  value: string;
  onCommit: (v: string) => void;
}

export function BufferedTextarea({ value, onCommit, onBlur, ...rest }: BufferedTextareaProps) {
  const [local, setLocal] = useBufferedValue(value);

  return (
    <Textarea
      {...rest}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={(e) => {
        if (local !== value) onCommit(local);
        onBlur?.(e);
      }}
    />
  );
}

interface BufferedNumberInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value' | 'type' | 'min' | 'max' | 'step'
> {
  value: number | null;
  format: NumberFormat;
  min?: number;
  max?: number;
  nullable?: boolean;
  onCommit: (value: number | null | undefined) => void;
}

export function BufferedNumberInput({
  value,
  format,
  min,
  max,
  nullable,
  onCommit,
  ...rest
}: BufferedNumberInputProps) {
  const [local, setLocal] = useBufferedValue(value, (v) => (v != null ? String(v) : ''));

  const commit = () => {
    if (local === '') {
      const next = nullable ? null : undefined;
      if (next !== value) onCommit(next);
      return;
    }
    const n = format === 'float' ? parseFloat(local) : parseInt(local, 10);
    if (!Number.isNaN(n) && n !== value) onCommit(n);
  };

  return (
    <Input
      {...rest}
      type="number"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
      step={format === 'float' ? 0.01 : 1}
      min={format === 'unsignedInteger' ? Math.max(min ?? 0, 0) : min}
      max={max}
    />
  );
}
