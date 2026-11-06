/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { Check, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useDisplayName } from '@/data/objectOptions';
import { formatDuration, formatNumber, formatSize } from '@/lib/format';
import { getEnumVariant } from '@/lib/schemaResolver';
import { SECRET_MASK } from '@/lib/jmapUtils';
import { cn } from '@/lib/utils';
import { isMultilineFormat } from '@/lib/embeddedSchema';
import type { ScalarType, Schema, StringFormat } from '@/types/schema';

export type ValueVariant = 'full' | 'compact';

export function EmptyValue({ variant = 'full' }: { variant?: ValueVariant }) {
  const { t } = useTranslation();
  if (variant === 'compact') return <span className="text-dim">-</span>;
  return <span className="text-sm italic text-dim">{t('field.notSet', 'Not set')}</span>;
}

export function StringValue({
  value,
  format,
  variant,
}: {
  value: unknown;
  format: StringFormat;
  variant: ValueVariant;
}) {
  const str = typeof value === 'string' ? value : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (format === 'secret' || format === 'secretText') {
    return <span className="text-sm text-muted-foreground">{SECRET_MASK}</span>;
  }
  if (format === 'color') {
    return (
      <span className="inline-flex items-center gap-2 text-sm">
        <span
          className="inline-block h-3.5 w-3.5 shrink-0 rounded-full shadow-[inset_0_0_0_1px_var(--input)]"
          style={{ backgroundColor: str }}
        />
        <span className="font-mono">{str}</span>
      </span>
    );
  }
  if (isMultilineFormat(format) || str.includes('\n')) {
    return (
      <pre
        className={cn(
          'whitespace-pre-wrap break-words bg-muted font-mono text-xs',
          variant === 'compact' ? 'max-w-md rounded-lg px-2 py-1' : 'rounded-xl p-3',
          format === 'text' && 'font-sans',
        )}
      >
        {str}
      </pre>
    );
  }
  return <span className="text-sm break-words">{str}</span>;
}

export function NumberValue({ value, format }: { value: unknown; format: string }) {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (Number.isNaN(num)) {
    return <span className="text-sm">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>;
  }
  const text = format === 'size' ? formatSize(num) : format === 'duration' ? formatDuration(num) : formatNumber(num);
  return <span className="text-sm">{text}</span>;
}

export function BooleanValue({ value }: { value: unknown }) {
  const { t } = useTranslation();
  return value === true ? (
    <Check className="h-4 w-4 text-success" role="img" aria-label={t('common.yes', 'Yes')} />
  ) : (
    <X className="h-4 w-4 text-destructive" role="img" aria-label={t('common.no', 'No')} />
  );
}

export function EnumValue({ schema, enumName, value }: { schema: Schema; enumName: string; value: unknown }) {
  const name = String(value);
  const variant = getEnumVariant(schema, enumName, name);
  if (!variant) return <span className="text-sm">{name}</span>;
  return (
    <Badge
      variant="secondary"
      className={cn('h-6', variant.color && 'text-primary-foreground')}
      style={variant.color ? { backgroundColor: variant.color } : undefined}
    >
      {variant.label}
    </Badge>
  );
}

export function ObjectIdValue({
  schema,
  objectName,
  id,
  variant = 'full',
}: {
  schema: Schema;
  objectName: string;
  id: string;
  variant?: ValueVariant;
}) {
  const { label, loading } = useDisplayName(objectName, id || null, schema);
  const content = loading && !label ? <Loader2 className="h-3 w-3 animate-spin" /> : (label ?? id);
  if (variant === 'compact') return <span>{content}</span>;
  return (
    <Badge variant="secondary" className="h-6 font-medium">
      {content}
    </Badge>
  );
}

export function ScalarLabel({ schema, type, value }: { schema: Schema; type: ScalarType; value: string }) {
  if (type.type === 'enum') return <>{getEnumVariant(schema, type.enumName, value)?.label ?? value}</>;
  if (type.type === 'objectId')
    return <ObjectIdValue schema={schema} objectName={type.objectName} id={value} variant="compact" />;
  return <>{value}</>;
}
