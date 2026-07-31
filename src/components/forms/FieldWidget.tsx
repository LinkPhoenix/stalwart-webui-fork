/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState, useEffect, useMemo, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useBufferedValue, useResetOnChange } from '@/hooks/useBufferedValue';
import ReactMarkdown from 'react-markdown';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Calendar } from '@/components/ui/calendar';

import { Plus, X, Eye, EyeOff, Loader2, Search, Check, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import { ExpressionEditor } from '@/components/expression/ExpressionEditor';
import { OtpAuthField } from '@/components/forms/OtpAuthField';

import {
  bytesToHuman,
  humanToBytes,
  msToHuman,
  humanToMs,
  formatSize,
  formatDuration,
  SIZE_UNITS,
  DURATION_UNITS,
} from '@/lib/durationFormat';
import { resolveSchema, resolveVariantForm, resolveObject, buildEmbeddedDefaults } from '@/lib/schemaResolver';
import { cn } from '@/lib/utils';
import { useAccountStore } from '@/stores/accountStore';
import { useEffectiveEdition } from '@/components/forms/FormEditionContext';
import { useObjectList, useObjectLabel, useNoPermissionMessage, type ObjectOption } from '@/lib/objectOptions';
import { SECRET_MASK } from '@/lib/jmapUtils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { jmapGet, getAccountId } from '@/services/jmap/client';

import type { Field, FormField, Schema, ScalarType, MapValueType, StringFormat, NumberFormat } from '@/types/schema';

export interface FieldWidgetProps {
  field: Field;
  formField: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
  error?: string;
  schema: Schema;
}

function getRequiredMarker(field: Field, readOnly: boolean): 'required' | 'optional' | null {
  if (readOnly) return null;
  if (field.update === 'serverSet') return null;
  const t = field.type;
  const eligible =
    t.type === 'string' ||
    t.type === 'number' ||
    t.type === 'utcDateTime' ||
    t.type === 'enum' ||
    t.type === 'blobId' ||
    t.type === 'objectId';
  if (!eligible) return null;
  if ('nullable' in t && t.nullable) return 'optional';
  return 'required';
}

export function FieldWidget(props: FieldWidgetProps) {
  const { t } = useTranslation();
  const { field, formField, value, onChange, readOnly, error, schema } = props;
  const ft = field.type;
  const edition = useEffectiveEdition();

  if (field.enterprise && edition === 'oss') return null;

  const marker = getRequiredMarker(field, readOnly);

  const isSelfContained = ft.type === 'object' && ft.objectName === 'x:OtpAuth';

  const widget = (() => {
    switch (ft.type) {
      case 'string':
        return (
          <StringField
            format={ft.format}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            placeholder={formField.placeholder}
            minLength={ft.minLength}
            maxLength={ft.maxLength}
            nullable={ft.nullable}
          />
        );
      case 'number':
        return (
          <NumberField
            format={ft.format}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            min={ft.min}
            max={ft.max}
            nullable={ft.nullable}
          />
        );
      case 'utcDateTime':
        return <DateTimeField value={value} onChange={onChange} readOnly={readOnly} nullable={ft.nullable} />;
      case 'boolean':
        return <BooleanField value={value} onChange={onChange} readOnly={readOnly} />;
      case 'enum':
        return (
          <EnumField
            enumName={ft.enumName}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            schema={schema}
            nullable={ft.nullable}
          />
        );
      case 'blobId':
        return <BlobField value={value} onChange={onChange} readOnly={readOnly} />;
      case 'objectId':
        return (
          <ObjectIdField
            objectName={ft.objectName}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            schema={schema}
            nullable={ft.nullable}
            formField={formField}
          />
        );
      case 'object':
        return (
          <EmbeddedObjectField
            objectName={ft.objectName}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            schema={schema}
            formField={formField}
            nullable={ft.nullable}
          />
        );
      case 'objectList':
        return (
          <ObjectListField
            objectName={ft.objectName}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            schema={schema}
            formField={formField}
            minItems={ft.minItems}
            maxItems={ft.maxItems}
          />
        );
      case 'set':
        return (
          <SetField
            scalarType={ft.class}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            schema={schema}
            minItems={ft.minItems}
            maxItems={ft.maxItems}
          />
        );
      case 'map':
        return (
          <MapField
            keyClass={ft.keyClass}
            valueClass={ft.valueClass}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            schema={schema}
            formField={formField}
            minItems={ft.minItems}
            maxItems={ft.maxItems}
          />
        );
      default: {
        const _: never = ft;
        void _;
        return <p className="text-sm text-muted-foreground">Unsupported field type</p>;
      }
    }
  })();

  if (isSelfContained) {
    return (
      <div className="space-y-1.5">
        {widget}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">
          {formField.label}
          {marker === 'required' && (
            <span className="ml-0.5 text-destructive" aria-label={t('field.required', 'required')}>
              *
            </span>
          )}
          {marker === 'optional' && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              {t('field.optional', '(optional)')}
            </span>
          )}
        </Label>
      </div>
      {field.description && (
        <div className="text-xs text-muted-foreground prose prose-sm max-w-none [&_p]:m-0">
          <ReactMarkdown>{field.description.replace(/\\n/g, '\n')}</ReactMarkdown>
        </div>
      )}
      {widget}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface BufferedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onCommit: (v: string) => void;
}

function BufferedInput({ value, onCommit, onBlur, onKeyDown, ...rest }: BufferedInputProps) {
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
        if (e.key === 'Enter' && (rest.type ?? 'text') !== 'textarea') {
          commit();
        }
        onKeyDown?.(e);
      }}
    />
  );
}

interface BufferedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string;
  onCommit: (v: string) => void;
}

function BufferedTextarea({ value, onCommit, onBlur, ...rest }: BufferedTextareaProps) {
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

interface StringFieldProps {
  format: StringFormat;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  nullable?: boolean;
}

function StringField({
  format,
  value,
  onChange,
  readOnly,
  placeholder,
  minLength,
  maxLength,
  nullable,
}: StringFieldProps) {
  const strValue = (value as string) ?? '';

  const handleCommit = (v: string) => {
    if (nullable && v === '') {
      onChange(null);
    } else {
      onChange(v);
    }
  };

  if (readOnly && format !== 'secret' && format !== 'secretText' && format !== 'color') {
    if (!strValue) {
      return <span className="text-sm text-muted-foreground italic">Not set</span>;
    }
    if (format === 'text' || format === 'html') {
      return (
        <pre className={`text-sm ${format === 'html' ? 'font-mono' : ''} whitespace-pre-wrap break-words`}>
          {strValue}
        </pre>
      );
    }
    return <span className="text-sm break-words">{strValue}</span>;
  }

  switch (format) {
    case 'secret':
      return (
        <SecretInput
          value={strValue}
          onChange={handleCommit}
          readOnly={readOnly}
          placeholder={placeholder}
          minLength={minLength}
          maxLength={maxLength}
          multiline={false}
        />
      );
    case 'secretText':
      return (
        <SecretInput
          value={strValue}
          onChange={handleCommit}
          readOnly={readOnly}
          placeholder={placeholder}
          minLength={minLength}
          maxLength={maxLength}
          multiline={true}
        />
      );
    case 'text':
      return (
        <BufferedTextarea
          value={strValue}
          onCommit={handleCommit}
          disabled={readOnly}
          placeholder={placeholder}
          minLength={minLength}
          maxLength={maxLength}
          rows={4}
        />
      );
    case 'html':
      return (
        <div className="rounded-md border bg-muted/30">
          <div className="flex items-center gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground">
            <span className="font-mono">HTML</span>
          </div>
          <BufferedTextarea
            value={strValue}
            onCommit={handleCommit}
            disabled={readOnly}
            placeholder={placeholder}
            minLength={minLength}
            maxLength={maxLength}
            rows={10}
            className="font-mono text-xs border-0 rounded-none rounded-b-md bg-transparent focus-visible:ring-0 resize-y"
          />
        </div>
      );
    case 'color':
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={strValue || '#000000'}
            onChange={(e) => handleCommit(e.target.value)}
            disabled={readOnly}
            className="h-9 w-14 cursor-pointer rounded-md border border-input bg-transparent p-1"
          />
          <BufferedInput
            value={strValue}
            onCommit={handleCommit}
            disabled={readOnly}
            placeholder="#000000"
            className="max-w-[10rem]"
          />
        </div>
      );
    default:
      return (
        <BufferedInput
          type={format === 'emailAddress' ? 'email' : format === 'uri' ? 'url' : 'text'}
          value={strValue}
          onCommit={handleCommit}
          disabled={readOnly}
          placeholder={placeholder ?? formatPlaceholder(format)}
          minLength={minLength}
          maxLength={maxLength}
        />
      );
  }
}

function formatPlaceholder(format: StringFormat): string | undefined {
  switch (format) {
    case 'ipAddress':
      return '192.168.1.1';
    case 'ipNetwork':
      return '192.168.1.0/24';
    case 'socketAddress':
      return '127.0.0.1:8080';
    case 'emailAddress':
      return 'user@example.com';
    case 'uri':
      return 'https://example.com';
    default:
      return undefined;
  }
}

interface SecretInputProps {
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  multiline: boolean;
}

function SecretInput({ value, onChange, readOnly, placeholder, minLength, maxLength, multiline }: SecretInputProps) {
  const [visible, setVisible] = useState(false);
  const [localValue, setLocalValue] = useState(() => (value === SECRET_MASK || value === '' ? '' : value));
  const [isMasked, setIsMasked] = useState(() => value === SECRET_MASK);

  useResetOnChange(value, () => {
    if (value === SECRET_MASK || value === '') {
      setLocalValue('');
      setIsMasked(value === SECRET_MASK);
    } else {
      setLocalValue(value);
      setIsMasked(false);
    }
  });

  const handleLocalChange = (v: string) => {
    setLocalValue(v);
    setIsMasked(false);
  };

  const commit = () => {
    if (isMasked && localValue === '') return;
    if (localValue !== value) onChange(localValue);
  };

  const displayValue = isMasked && !visible ? '' : localValue;
  const displayPlaceholder = isMasked ? SECRET_MASK : placeholder;

  const toggleBtn = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0"
      onClick={() => setVisible((p) => !p)}
      tabIndex={-1}
    >
      {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </Button>
  );

  if (multiline) {
    return (
      <div className="relative">
        <Textarea
          value={displayValue}
          onChange={(e) => handleLocalChange(e.target.value)}
          onBlur={commit}
          disabled={readOnly}
          placeholder={displayPlaceholder}
          minLength={minLength}
          maxLength={maxLength}
          rows={4}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-bwignore
          className={visible ? '' : 'tracking-widest'}
          style={visible ? undefined : ({ WebkitTextSecurity: 'disc' } as React.CSSProperties)}
        />
        <div className="absolute right-1 top-1">{toggleBtn}</div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type={visible ? 'text' : 'password'}
        value={displayValue}
        onChange={(e) => handleLocalChange(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
        disabled={readOnly}
        placeholder={displayPlaceholder}
        minLength={minLength}
        maxLength={maxLength}
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        data-bwignore
        className="flex-1"
      />
      {toggleBtn}
    </div>
  );
}

interface NumberFieldProps {
  format: NumberFormat;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
  min?: number;
  max?: number;
  nullable?: boolean;
}

function NumberField({ format, value, onChange, readOnly, min, max, nullable }: NumberFieldProps) {
  if (readOnly && format !== 'size' && format !== 'duration') {
    const numValue = value as number | null | undefined;
    if (numValue == null) {
      return <span className="text-sm text-muted-foreground italic">Not set</span>;
    }
    return <span className="text-sm">{numValue.toLocaleString()}</span>;
  }

  switch (format) {
    case 'size':
      return <SizeInput value={value} onChange={onChange} readOnly={readOnly} nullable={nullable} />;
    case 'duration':
      return <DurationInput value={value} onChange={onChange} readOnly={readOnly} nullable={nullable} />;
    default: {
      const numValue = value as number | null | undefined;
      const step = format === 'float' ? 0.01 : 1;
      const minVal = format === 'unsignedInteger' ? Math.max(min ?? 0, 0) : min;

      return (
        <BufferedNumberInput
          value={numValue ?? null}
          format={format}
          step={step}
          min={minVal}
          max={max}
          nullable={nullable}
          onCommit={(v) => onChange(v)}
        />
      );
    }
  }
}

interface BufferedNumberInputProps {
  value: number | null;
  format: NumberFormat;
  step: number;
  min?: number;
  max?: number;
  nullable?: boolean;
  disabled?: boolean;
  onCommit: (value: number | null | undefined) => void;
}

function BufferedNumberInput({
  value,
  format,
  step,
  min,
  max,
  nullable,
  disabled,
  onCommit,
}: BufferedNumberInputProps) {
  const [local, setLocal] = useBufferedValue(value, (v) => (v != null ? String(v) : ''));

  const commit = () => {
    if (local === '') {
      const next = nullable ? null : undefined;
      if (next !== value) onCommit(next);
      return;
    }
    const n = format === 'float' ? parseFloat(local) : parseInt(local, 10);
    if (!isNaN(n) && n !== value) onCommit(n);
  };

  return (
    <Input
      type="number"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
      disabled={disabled}
      step={step}
      min={min}
      max={max}
    />
  );
}

interface SizeInputProps {
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
  nullable?: boolean;
}

function SizeInput({ value, onChange, readOnly, nullable }: SizeInputProps) {
  const { t } = useTranslation();
  if (readOnly) {
    if (value == null)
      return <span className="text-sm text-muted-foreground italic">{t('field.notSet', 'Not set')}</span>;
    return <span className="text-sm">{formatSize(value as number)}</span>;
  }
  return <SizeInputEditable value={value} onChange={onChange} nullable={nullable} />;
}

function SizeInputEditable({ value, onChange, nullable }: Omit<SizeInputProps, 'readOnly'>) {
  const { t } = useTranslation();
  const isNull = value == null;
  const initHuman = bytesToHuman(typeof value === 'number' ? value : 0);
  const [unit, setUnit] = useState(initHuman.unit);
  const [localStr, setLocalStr] = useState<string>(isNull ? '' : String(initHuman.value));

  useResetOnChange(value, () => {
    const h = bytesToHuman(typeof value === 'number' ? value : 0);
    setUnit(h.unit);
    setLocalStr(value == null ? '' : String(h.value));
  });

  const commit = () => {
    if (localStr === '') {
      onChange(nullable ? null : 0);
      return;
    }
    const n = parseFloat(localStr);
    if (isNaN(n)) return;
    const next = humanToBytes(n, unit);
    if (next !== value) onChange(next);
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={localStr}
        placeholder={nullable ? t('field.notSet', 'Not set') : '0'}
        onChange={(e) => setLocalStr(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
        min={0}
        step={1}
        className="flex-1"
      />
      <Select
        value={unit}
        onValueChange={(u) => {
          setUnit(u);
          if (localStr !== '') {
            const n = parseFloat(localStr);
            if (!isNaN(n)) onChange(humanToBytes(n, u));
          }
        }}
      >
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SIZE_UNITS.map((u) => (
            <SelectItem key={u} value={u}>
              {u}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {nullable && !isNull && (
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => onChange(null)}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

interface DurationInputProps {
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
  nullable?: boolean;
}

function durationLabel(t: (key: string, fallback: string) => string, unit: string): string {
  switch (unit) {
    case 'ms':
      return t('duration.milliseconds', 'Milliseconds');
    case 's':
      return t('duration.seconds', 'Seconds');
    case 'min':
      return t('duration.minutes', 'Minutes');
    case 'h':
      return t('duration.hours', 'Hours');
    case 'd':
      return t('duration.days', 'Days');
    default:
      return unit;
  }
}

function DurationInput({ value, onChange, readOnly, nullable }: DurationInputProps) {
  const { t } = useTranslation();
  if (readOnly) {
    if (value == null)
      return <span className="text-sm text-muted-foreground italic">{t('field.notSet', 'Not set')}</span>;
    return <span className="text-sm">{formatDuration(value as number)}</span>;
  }
  return <DurationInputEditable value={value} onChange={onChange} nullable={nullable} />;
}

function DurationInputEditable({ value, onChange, nullable }: Omit<DurationInputProps, 'readOnly'>) {
  const { t } = useTranslation();
  const isNull = value == null;
  const initHuman = msToHuman(typeof value === 'number' ? value : 0);
  const [unit, setUnit] = useState(initHuman.unit);
  const [localStr, setLocalStr] = useState<string>(isNull ? '' : String(initHuman.value));

  useResetOnChange(value, () => {
    const h = msToHuman(typeof value === 'number' ? value : 0);
    setUnit(h.unit);
    setLocalStr(value == null ? '' : String(h.value));
  });

  const commit = () => {
    if (localStr === '') {
      onChange(nullable ? null : 0);
      return;
    }
    const n = parseFloat(localStr);
    if (isNaN(n)) return;
    const next = humanToMs(n, unit);
    if (next !== value) onChange(next);
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={localStr}
        placeholder={nullable ? t('field.notSet', 'Not set') : '0'}
        onChange={(e) => setLocalStr(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
        min={0}
        step={1}
        className="flex-1"
      />
      <Select
        value={unit}
        onValueChange={(u) => {
          setUnit(u);
          if (localStr !== '') {
            const n = parseFloat(localStr);
            if (!isNaN(n)) onChange(humanToMs(n, u));
          }
        }}
      >
        <SelectTrigger className="w-32">
          <SelectValue>{durationLabel(t, unit)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {DURATION_UNITS.map((u) => (
            <SelectItem key={u} value={u}>
              {durationLabel(t, u)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {nullable && !isNull && (
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => onChange(null)}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

interface DateTimeFieldProps {
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
  nullable?: boolean;
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function DateTimeField({ value, onChange, readOnly, nullable }: DateTimeFieldProps) {
  const { t } = useTranslation();
  const strValue = typeof value === 'string' ? value : '';

  const selected = useMemo(() => {
    const d = strValue ? new Date(strValue) : null;
    return d && !isNaN(d.getTime()) ? d : null;
  }, [strValue]);

  const localTime = (selected ?? new Date()).toTimeString().slice(0, 5);

  const commit = (day: Date, time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const next = new Date(day);
    next.setHours(hours || 0, minutes || 0, 0, 0);
    onChange(next.toISOString());
  };

  if (readOnly) {
    if (!strValue) {
      return <span className="text-sm text-muted-foreground italic">{t('field.notSet', 'Not set')}</span>;
    }
    return <span className="text-sm">{selected ? DATE_TIME_FORMAT.format(selected) : strValue}</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn('flex-1 justify-start text-left font-normal', !selected && 'text-muted-foreground')}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selected ? DATE_TIME_FORMAT.format(selected) : t('field.pickDate', 'Pick a date')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected ?? undefined}
            defaultMonth={selected ?? undefined}
            autoFocus
            onSelect={(day) => {
              if (day) commit(day, localTime);
            }}
          />
          <div className="border-t p-3">
            <Input
              type="time"
              value={localTime}
              disabled={!selected}
              onChange={(e) => {
                if (selected && e.target.value) commit(selected, e.target.value);
              }}
              aria-label={t('field.time', 'Time')}
            />
          </div>
        </PopoverContent>
      </Popover>
      {nullable && strValue && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onChange(null)}
          aria-label={t('common.clear', 'Clear')}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

interface BooleanFieldProps {
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
}

function BooleanField({ value, onChange, readOnly }: BooleanFieldProps) {
  const { t } = useTranslation();
  if (readOnly) {
    return value === true ? (
      <Check className="h-4 w-4 text-green-600" aria-label={t('common.yes', 'Yes')} />
    ) : (
      <X className="h-4 w-4 text-red-500" aria-label={t('common.no', 'No')} />
    );
  }
  return <Switch checked={value === true} onCheckedChange={(checked) => onChange(checked)} />;
}

interface EnumFieldProps {
  enumName: string;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
  schema: Schema;
  nullable?: boolean;
}

function EnumField({ enumName, value, onChange, readOnly, schema, nullable }: EnumFieldProps) {
  const { t } = useTranslation();
  const variants = schema.enums[enumName] ?? [];
  const strValue = (value as string) ?? '';

  const filteredVariants =
    enumName === 'Permission'
      ? variants.filter((v) => useAccountStore.getState().permissions.includes(v.name))
      : variants;

  if (readOnly) {
    if (!strValue) return <span className="text-sm text-muted-foreground italic">{t('field.notSet', 'Not set')}</span>;
    const variant = filteredVariants.find((v) => v.name === strValue);
    if (!variant) return <span className="text-sm">{strValue}</span>;
    return (
      <Badge variant="secondary" style={variant.color ? { backgroundColor: variant.color, color: '#fff' } : undefined}>
        {variant.label}
      </Badge>
    );
  }

  const options: ComboboxOption[] = filteredVariants.map((v) => ({
    value: v.name,
    label: v.label,
    description: v.explanation || undefined,
    keywords: [v.name],
    marker: v.color ? (
      <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
    ) : undefined,
  }));

  return (
    <Combobox
      options={options}
      value={strValue}
      onValueChange={(v) => onChange(v === '' ? null : v)}
      placeholder={t('field.selectEllipsis', 'Select...')}
      nullable={nullable}
    />
  );
}

interface BlobFieldProps {
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
}

function BlobField({ value, onChange, readOnly }: BlobFieldProps) {
  const { t } = useTranslation();
  const blobId = typeof value === 'string' ? value : null;
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [modified, setModified] = useState(false);

  useEffect(() => {
    if (!blobId || loaded) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const accountId = getAccountId('x:Blob');
        const responses = await jmapGet('Blob', accountId, [blobId], ['data:asText']);
        if (cancelled) return;
        const result = responses[0]?.[1];
        const list = result?.list as Array<Record<string, unknown>> | undefined;
        if (list?.[0]) {
          const data = list[0]['data:asText'];
          if (typeof data === 'string') {
            setContent(data);
          }
        }
        // eslint-disable-next-line no-empty
      } catch {
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blobId, loaded]);

  const handleContentChange = (text: string) => {
    setContent(text);
    setModified(true);
    onChange(text);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('field.loadingContent', 'Loading content...')}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <BufferedTextarea
        value={content}
        onCommit={handleContentChange}
        disabled={readOnly}
        rows={8}
        className="font-mono text-xs"
      />
      {modified && (
        <p className="text-xs text-muted-foreground">
          {t('field.contentModified', 'Content modified (will be saved as a new blob)')}
        </p>
      )}
    </div>
  );
}

interface ObjectIdFieldProps {
  objectName: string;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
  schema: Schema;
  nullable?: boolean;
  formField: FormField;
}

function isLinkedObjectEnterpriseGated(schema: Schema, objectName: string): boolean {
  const resolved = resolveObject(schema, objectName);
  if (!resolved) return false;
  if (!resolved.enterprise) return false;
  const edition = useAccountStore.getState().edition;
  return edition === 'community';
}

function ObjectIdField({
  objectName,
  value,
  onChange,
  readOnly,
  schema,
  nullable,
  formField,
}: ObjectIdFieldProps & { formField?: FormField }) {
  const { t } = useTranslation();
  void formField;
  const strValue = (value as string) ?? '';

  const { label: cheapLabel, loading: labelLoading } = useObjectLabel(objectName, strValue || null, schema);

  const list = useObjectList(objectName, schema);
  const noPermissionMessage = useNoPermissionMessage(schema, objectName);

  const enterpriseGated = isLinkedObjectEnterpriseGated(schema, objectName);
  const effectiveReadOnly = readOnly || enterpriseGated;

  const fromList = list.options.find((o) => o.id === strValue)?.label;
  const displayLabel = cheapLabel ?? fromList ?? (strValue || null);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {displayLabel && (
        <Badge variant="secondary" className="gap-1 pr-1.5 text-sm">
          {labelLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : displayLabel}
          {!effectiveReadOnly && nullable && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
              aria-label={t('common.clear', 'Clear')}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      )}
      {!displayLabel && effectiveReadOnly && (
        <span className="text-sm text-muted-foreground">{t('field.none', 'None')}</span>
      )}
      {!effectiveReadOnly && (
        <ObjectIdSearchPopover
          options={list.options}
          loading={list.loading}
          ensureLoaded={list.ensureLoaded}
          onSelect={(id) => onChange(id)}
          disabledMessage={noPermissionMessage}
        />
      )}
    </div>
  );
}

function ObjectIdSearchPopover({
  options,
  loading,
  ensureLoaded,
  onSelect,
  disabledMessage,
}: {
  options: ObjectOption[];
  loading: boolean;
  ensureLoaded: () => void | Promise<void>;
  onSelect: (id: string) => void;
  disabledMessage?: string | null;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      void ensureLoaded();
    }
  };

  if (disabledMessage) {
    return (
      <TooltipProvider>
        <Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 cursor-not-allowed opacity-60"
              aria-label={t('common.search', 'Search')}
              aria-disabled="true"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTooltipOpen(true);
              }}
            >
              <Search className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{disabledMessage}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={t('common.search', 'Search')}>
          <Search className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-72" align="start">
        <Command>
          <CommandInput placeholder={t('common.searchPlaceholder', 'Search...')} />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('common.loading', 'Loading...')}
              </div>
            )}
            {!loading && <CommandEmpty>{t('common.noResultsDot', 'No results.')}</CommandEmpty>}
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={opt.id}
                  keywords={[opt.label]}
                  onSelect={() => {
                    onSelect(opt.id);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface RateFieldProps {
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
  nullable?: boolean;
}

function RateField({ value, onChange, readOnly, nullable }: RateFieldProps) {
  const { t } = useTranslation();
  const rateValue = value as { count?: number; period?: number } | null | undefined;
  const isNull = rateValue == null;

  const count = typeof rateValue?.count === 'number' ? rateValue.count : 0;
  const periodMs = typeof rateValue?.period === 'number' ? rateValue.period : 0;
  const human = msToHuman(periodMs);

  const [localCount, setLocalCount] = useState(String(count));
  const [localPeriod, setLocalPeriod] = useState(String(human.value));

  useResetOnChange(count, () => setLocalCount(String(count)));
  useResetOnChange(human.value, () => setLocalPeriod(String(human.value)));

  const commitCount = () => {
    const n = parseInt(localCount, 10);
    const newCount = !localCount || isNaN(n) ? 0 : n;
    if (newCount !== count) onChange({ count: newCount, period: periodMs });
  };
  const commitPeriod = () => {
    const n = parseFloat(localPeriod);
    const newVal = !localPeriod || isNaN(n) ? 0 : n;
    if (newVal !== human.value) onChange({ count, period: humanToMs(newVal, human.unit) });
  };

  if (isNull && readOnly) {
    return <span className="text-sm text-muted-foreground italic">{t('field.notSet', 'Not set')}</span>;
  }

  if (isNull) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground italic">{t('field.notSet', 'Not set')}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange({ count: 1, period: 1000 })}>
          <Plus className="h-4 w-4 mr-1" />
          {t('field.enable', 'Enable')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Input
        type="number"
        min={1}
        step={1}
        value={localCount}
        disabled={readOnly}
        className="w-24"
        aria-label={t('rate.count', 'Count')}
        onChange={(e) => setLocalCount(e.target.value)}
        onBlur={commitCount}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitCount();
        }}
      />
      <span className="text-sm text-muted-foreground shrink-0">{t('rate.per', 'per')}</span>
      <Input
        type="number"
        min={0}
        step={1}
        value={localPeriod}
        disabled={readOnly}
        className="w-24"
        aria-label={t('rate.periodValue', 'Period value')}
        onChange={(e) => setLocalPeriod(e.target.value)}
        onBlur={commitPeriod}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitPeriod();
        }}
      />
      <Select
        value={human.unit}
        onValueChange={(u) => onChange({ count, period: humanToMs(human.value, u) })}
        disabled={readOnly}
      >
        <SelectTrigger className="w-32">
          <SelectValue>{durationLabel(t, human.unit)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {DURATION_UNITS.map((u) => (
            <SelectItem key={u} value={u}>
              {durationLabel(t, u)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {nullable && !readOnly && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onChange(null)}
          aria-label={t('common.clear', 'Clear')}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

interface EmbeddedObjectFieldProps {
  objectName: string;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
  schema: Schema;
  formField: FormField;
  nullable?: boolean;
}

function EmbeddedObjectField({
  objectName,
  value,
  onChange,
  readOnly,
  schema,
  formField,
  nullable,
}: EmbeddedObjectFieldProps) {
  const { t } = useTranslation();
  const objValue = (value as Record<string, unknown>) ?? {};

  if (objectName === 'x:Expression') {
    return (
      <ExpressionEditor
        value={{
          match: (objValue.match as Record<string, { if: string; then: string }>) ?? {},
          else: (objValue.else as string) ?? '',
        }}
        onChange={(v) => onChange(v)}
        readOnly={readOnly}
      />
    );
  }

  if (objectName === 'x:Rate') {
    return <RateField value={value} onChange={onChange} readOnly={readOnly} nullable={nullable} />;
  }

  if (objectName === 'x:OtpAuth') {
    return <OtpAuthField value={value} onChange={onChange} readOnly={readOnly} />;
  }

  const resolvedSchema = resolveSchema(schema, objectName);

  if (!resolvedSchema) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('field.unknownObjectType', 'Unknown object type: {{name}}', { name: objectName })}
      </p>
    );
  }

  const handleFieldChange = (fieldName: string, fieldValue: unknown) => {
    onChange({ ...objValue, [fieldName]: fieldValue });
  };

  if (resolvedSchema.type === 'single') {
    const fields = resolvedSchema.fields;
    const form = resolveVariantForm(schema, objectName, objectName, resolvedSchema.schemaName);
    const formFields = form?.sections.flatMap((s) => s.fields) ?? [];

    return (
      <div className="rounded-md border p-4 space-y-4">
        {formFields.map((ff) => {
          const fieldDef = fields.properties[ff.name];
          if (!fieldDef) return null;
          if (fieldDef.update === 'serverSet') return null;
          return (
            <FieldWidget
              key={ff.name}
              field={fieldDef}
              formField={ff}
              value={objValue[ff.name]}
              onChange={(v) => handleFieldChange(ff.name, v)}
              readOnly={readOnly}
              schema={schema}
            />
          );
        })}
        {formFields.length === 0 &&
          Object.entries(fields.properties)
            .filter(([, fieldDef]) => fieldDef.update !== 'serverSet')
            .map(([name, fieldDef]) => (
              <FieldWidget
                key={name}
                field={fieldDef}
                formField={{ name, label: name }}
                value={objValue[name]}
                onChange={(v) => handleFieldChange(name, v)}
                readOnly={readOnly}
                schema={schema}
              />
            ))}
      </div>
    );
  }

  const currentType = (objValue['@type'] as string) ?? resolvedSchema.variants[0]?.name ?? '';
  const currentVariant = resolvedSchema.variants.find((v) => v.name === currentType);
  const variantFields = currentVariant?.fields;
  const variantForm = resolveVariantForm(schema, objectName, objectName, currentVariant?.schemaName);
  const variantFormFields = variantForm?.sections.flatMap((s) => s.fields) ?? [];

  const handleVariantChange = (newType: string) => {
    const newObj = buildEmbeddedDefaults(schema, objectName, {}, newType);
    onChange(newObj);
  };

  return (
    <div className="rounded-md border p-4 space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">{formField.label ?? t('field.type', 'Type')}</Label>
        <Select value={currentType} onValueChange={handleVariantChange} disabled={readOnly}>
          <SelectTrigger>
            <SelectValue placeholder={t('form.selectType', 'Select type...')} />
          </SelectTrigger>
          <SelectContent>
            {resolvedSchema.variants.map((v) => (
              <SelectItem key={v.name} value={v.name}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {variantFields &&
        variantFormFields.length > 0 &&
        variantFormFields.map((ff) => {
          const fieldDef = variantFields.properties[ff.name];
          if (!fieldDef) return null;
          if (fieldDef.update === 'serverSet') return null;
          return (
            <FieldWidget
              key={ff.name}
              field={fieldDef}
              formField={ff}
              value={objValue[ff.name]}
              onChange={(v) => handleFieldChange(ff.name, v)}
              readOnly={readOnly}
              schema={schema}
            />
          );
        })}
      {variantFields &&
        variantFormFields.length === 0 &&
        Object.entries(variantFields.properties)
          .filter(([, fieldDef]) => fieldDef.update !== 'serverSet')
          .map(([name, fieldDef]) => (
            <FieldWidget
              key={name}
              field={fieldDef}
              formField={{ name, label: name }}
              value={objValue[name]}
              onChange={(v) => handleFieldChange(name, v)}
              readOnly={readOnly}
              schema={schema}
            />
          ))}
    </div>
  );
}

interface ObjectListFieldProps {
  objectName: string;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
  schema: Schema;
  formField: FormField;
  minItems?: number;
  maxItems?: number;
}

function ObjectListField({
  objectName,
  value,
  onChange,
  readOnly,
  schema,
  formField,
  minItems,
  maxItems,
}: ObjectListFieldProps) {
  const { t } = useTranslation();
  const mapValue = (value as Record<string, Record<string, unknown>>) ?? {};
  const entries = Object.entries(mapValue).sort(([a], [b]) => parseInt(a) - parseInt(b));

  const resolvedSchema = resolveSchema(schema, objectName);
  if (!resolvedSchema) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('field.unknownObjectType', 'Unknown object type: {{name}}', { name: objectName })}
      </p>
    );
  }

  const addItem = () => {
    const nextIndex = entries.length > 0 ? Math.max(...entries.map(([k]) => parseInt(k))) + 1 : 0;
    let defaults: Record<string, unknown> = {};
    if (resolvedSchema.type === 'single' && resolvedSchema.fields.defaults) {
      defaults = { ...resolvedSchema.fields.defaults };
    } else if (resolvedSchema.type === 'multiple' && resolvedSchema.variants[0]) {
      defaults = { '@type': resolvedSchema.variants[0].name };
      if (resolvedSchema.variants[0].fields?.defaults) {
        defaults = { ...defaults, ...resolvedSchema.variants[0].fields.defaults };
      }
    }
    onChange({ ...mapValue, [String(nextIndex)]: defaults });
  };

  const removeItem = (key: string) => {
    const copy = { ...mapValue };
    delete copy[key];
    onChange(copy);
  };

  const updateItem = (key: string, itemValue: Record<string, unknown>) => {
    onChange({ ...mapValue, [key]: itemValue });
  };

  return (
    <div className="space-y-3">
      {entries.map(([key, item]) => (
        <div key={key} className="rounded-md border p-4 space-y-3">
          {!readOnly && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => removeItem(key)}
                disabled={minItems != null && entries.length <= minItems}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <EmbeddedObjectField
            objectName={objectName}
            value={item}
            onChange={(v) => updateItem(key, v as Record<string, unknown>)}
            readOnly={readOnly}
            schema={schema}
            formField={formField}
          />
        </div>
      ))}
      {!readOnly && (maxItems == null || entries.length < maxItems) && (
        <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1">
          <Plus className="h-4 w-4" />
          {t('field.addItem', 'Add item')}
        </Button>
      )}
    </div>
  );
}

function arrayToSetObject(items: string[]): Record<string, true> {
  const obj: Record<string, true> = {};
  for (const i of items) {
    obj[i] = true;
  }
  return obj;
}

interface SetFieldProps {
  scalarType: ScalarType;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
  schema: Schema;
  minItems?: number;
  maxItems?: number;
}

function SetField({ scalarType, value, onChange, readOnly, schema, minItems, maxItems }: SetFieldProps) {
  const setObj = (value as Record<string, true>) ?? {};
  const items = Object.keys(setObj);

  switch (scalarType.type) {
    case 'string':
      return (
        <TagInput
          items={items}
          onChange={(newItems) => onChange(arrayToSetObject(newItems))}
          readOnly={readOnly}
          minItems={minItems}
          maxItems={maxItems}
          placeholder={formatPlaceholder(scalarType.format)}
        />
      );
    case 'enum':
      return (
        <EnumMultiSelect
          enumName={scalarType.enumName}
          items={items}
          onChange={(newItems) => onChange(arrayToSetObject(newItems))}
          readOnly={readOnly}
          schema={schema}
          minItems={minItems}
        />
      );
    case 'objectId':
      return (
        <ObjectIdMultiSelect
          objectName={scalarType.objectName}
          items={items}
          onChange={(newItems) => onChange(arrayToSetObject(newItems))}
          readOnly={readOnly}
          schema={schema}
          minItems={minItems}
        />
      );
    default: {
      const _: never = scalarType;
      void _;
      return null;
    }
  }
}

interface TagInputProps {
  items: string[];
  onChange: (items: string[]) => void;
  readOnly: boolean;
  minItems?: number;
  maxItems?: number;
  placeholder?: string;
}

function TagInput({ items, onChange, readOnly, minItems, maxItems, placeholder }: TagInputProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');

  const addTag = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || items.includes(trimmed)) return;
    if (maxItems != null && items.length >= maxItems) return;
    onChange([...items, trimmed]);
    setInputValue('');
  };

  const removeTag = (tag: string) => {
    onChange(items.filter((i) => i !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant="secondary" className="gap-1 pr-1">
            {item}
            {!readOnly && (
              <button
                type="button"
                onClick={() => removeTag(item)}
                disabled={minItems != null && items.length <= minItems}
                className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>
      {!readOnly && (
        <div className="flex items-center gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? t('field.typeAndPressEnter', 'Type and press Enter...')}
            className="flex-1"
          />
          <Button type="button" variant="outline" size="sm" onClick={addTag} disabled={!inputValue.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

interface EnumMultiSelectProps {
  enumName: string;
  items: string[];
  onChange: (items: string[]) => void;
  readOnly: boolean;
  schema: Schema;
  minItems?: number;
}

function EnumMultiSelect({ enumName, items, onChange, readOnly, schema, minItems }: EnumMultiSelectProps) {
  const { t } = useTranslation();
  const variants = schema.enums[enumName] ?? [];
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const toggle = (name: string) => {
    if (items.includes(name)) {
      if (minItems != null && items.length <= minItems) return;
      onChange(items.filter((i) => i !== name));
    } else {
      onChange([...items, name]);
    }
  };

  const renderCheckboxItem = (v: (typeof variants)[number]) => (
    <div key={v.name} className="flex items-center gap-2">
      <Checkbox
        id={`enum-${enumName}-${v.name}`}
        checked={items.includes(v.name)}
        onCheckedChange={() => toggle(v.name)}
        disabled={readOnly}
      />
      <Label htmlFor={`enum-${enumName}-${v.name}`} className="text-sm font-normal cursor-pointer">
        <div className="flex items-center gap-2">
          {v.color && (
            <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
          )}
          {v.label}
        </div>
      </Label>
      {v.explanation && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-help">(?)</span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-xs">{v.explanation}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );

  if (variants.length > 10) {
    const filtered = searchQuery
      ? variants.filter(
          (v) =>
            v.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            v.name.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : variants;

    return (
      <div className="space-y-2">
        {items.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {items.map((name) => {
              const variant = variants.find((v) => v.name === name);
              return (
                <Badge key={name} variant="secondary" className="gap-1 pr-1">
                  {variant?.color && (
                    <span
                      className="inline-block h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: variant.color }}
                    />
                  )}
                  {variant?.label ?? name}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => toggle(name)}
                      disabled={minItems != null && items.length <= minItems}
                      className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              );
            })}
          </div>
        )}
        <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-1" disabled={readOnly}>
              <Search className="h-4 w-4" />
              {t('field.selectOptions', 'Select options...')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="p-2 border-b">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('common.searchPlaceholder', 'Search...')}
                className="h-8"
              />
            </div>
            <div className="max-h-60 overflow-y-auto p-2 space-y-1">
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">{t('field.noMatches', 'No matches')}</p>
              )}
              {filtered.map((v) => (
                <div key={v.name} className="flex items-center gap-2 py-1">
                  <Checkbox
                    id={`enum-dd-${enumName}-${v.name}`}
                    checked={items.includes(v.name)}
                    onCheckedChange={() => toggle(v.name)}
                    disabled={readOnly}
                  />
                  <Label
                    htmlFor={`enum-dd-${enumName}-${v.name}`}
                    className="text-sm font-normal cursor-pointer flex-1"
                  >
                    <div className="flex items-center gap-2">
                      {v.color && (
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: v.color }}
                        />
                      )}
                      {v.label}
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  if (variants.length > 3) {
    return <div className="grid grid-cols-2 gap-2">{variants.map(renderCheckboxItem)}</div>;
  }

  return <div className="space-y-2">{variants.map(renderCheckboxItem)}</div>;
}

interface ObjectIdMultiSelectProps {
  objectName: string;
  items: string[];
  onChange: (items: string[]) => void;
  readOnly: boolean;
  schema: Schema;
  minItems?: number;
}

function ObjectIdMultiSelect({ objectName, items, onChange, readOnly, schema, minItems }: ObjectIdMultiSelectProps) {
  const { t } = useTranslation();
  const list = useObjectList(objectName, schema);
  const noPermissionMessage = useNoPermissionMessage(schema, objectName);
  const available = list.options.filter((o) => !items.includes(o.id));

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {items.map((id) => (
        <ObjectIdMultiSelectPill
          key={id}
          id={id}
          objectName={objectName}
          schema={schema}
          listOptions={list.options}
          readOnly={readOnly}
          canRemove={minItems == null || items.length > minItems}
          onRemove={() => {
            if (minItems != null && items.length <= minItems) return;
            onChange(items.filter((i) => i !== id));
          }}
        />
      ))}
      {!readOnly && (
        <ObjectIdSearchPopover
          options={available}
          loading={list.loading}
          ensureLoaded={list.ensureLoaded}
          onSelect={(id) => onChange([...items, id])}
          disabledMessage={noPermissionMessage}
        />
      )}
      {items.length === 0 && readOnly && (
        <span className="text-sm text-muted-foreground">{t('field.none', 'None')}</span>
      )}
    </div>
  );
}

function ObjectIdMultiSelectPill({
  id,
  objectName,
  schema,
  listOptions,
  readOnly,
  canRemove,
  onRemove,
}: {
  id: string;
  objectName: string;
  schema: Schema;
  listOptions: ObjectOption[];
  readOnly: boolean;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const fromList = listOptions.find((o) => o.id === id)?.label;
  const { label: cheapLabel, loading } = useObjectLabel(objectName, fromList ? null : id, schema);
  const display = fromList ?? cheapLabel ?? id;
  return (
    <Badge variant="secondary" className="gap-1 pr-1.5 text-sm">
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : display}
      {!readOnly && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!canRemove}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}

function MapEntryKeyLabel({ keyClass, keyValue, schema }: { keyClass: ScalarType; keyValue: string; schema: Schema }) {
  if (keyClass.type === 'enum') {
    const variants = schema.enums[keyClass.enumName] ?? [];
    const variant = variants.find((v) => v.name === keyValue);
    return <>{variant?.label ?? keyValue}</>;
  }
  if (keyClass.type === 'objectId') {
    return <ObjectIdKeyLabel objectName={keyClass.objectName} keyValue={keyValue} schema={schema} />;
  }
  return <>{keyValue}</>;
}

function ObjectIdKeyLabel({ objectName, keyValue, schema }: { objectName: string; keyValue: string; schema: Schema }) {
  const list = useObjectList(objectName, schema);
  const fromList = list.options.find((o) => o.id === keyValue)?.label;
  const { label: cheapLabel, loading } = useObjectLabel(objectName, fromList ? null : keyValue, schema);
  const display = fromList ?? cheapLabel;
  if (loading && !display) {
    return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
  }
  return <>{display ?? keyValue}</>;
}

interface MapFieldProps {
  keyClass: ScalarType;
  valueClass: MapValueType;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
  schema: Schema;
  formField: FormField;
  minItems?: number;
  maxItems?: number;
}

function MapField({ keyClass, valueClass, value, onChange, readOnly, schema, minItems, maxItems }: MapFieldProps) {
  const { t } = useTranslation();
  const mapValue = (value as Record<string, unknown>) ?? {};
  const entries = Object.entries(mapValue);

  const [newKey, setNewKey] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const addEntry = () => {
    const key = newKey.trim();
    if (!key || key in mapValue) return;
    if (maxItems != null && entries.length >= maxItems) return;

    let defaultValue: unknown = '';
    if (valueClass.type === 'number') {
      defaultValue = 0;
    } else if (valueClass.type === 'object') {
      defaultValue = {};
    }

    onChange({ ...mapValue, [key]: defaultValue });
    setExpandedKeys((prev) => new Set(prev).add(key));
    setNewKey('');
  };

  const removeEntry = (key: string) => {
    const copy = { ...mapValue };
    delete copy[key];
    onChange(copy);
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const updateValue = (key: string, val: unknown) => {
    onChange({ ...mapValue, [key]: val });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEntry();
    }
  };

  const existingKeys = new Set(Object.keys(mapValue));

  return (
    <div className="space-y-3">
      {entries.length > 0 && (
        <div className="space-y-3">
          {entries.map(([key, val]) => (
            <Collapsible key={key} defaultOpen={expandedKeys.has(key)}>
              <div className="rounded-md border">
                <div className="flex items-center">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-2 p-3 text-sm font-medium hover:bg-accent/50 rounded-t-md transition-colors [&[data-state=closed]>svg]:rotate-0 [&[data-state=open]>svg]:rotate-90"
                    >
                      <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200" />
                      <MapEntryKeyLabel keyClass={keyClass} keyValue={key} schema={schema} />
                    </button>
                  </CollapsibleTrigger>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 mr-2 shrink-0"
                      onClick={() => removeEntry(key)}
                      disabled={minItems != null && entries.length <= minItems}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <CollapsibleContent>
                  <div className="px-4 pb-4 pt-1">
                    {valueClass.type === 'object' ? (
                      <EmbeddedObjectField
                        objectName={valueClass.objectName}
                        value={val}
                        onChange={(v) => updateValue(key, v)}
                        readOnly={readOnly}
                        schema={schema}
                        formField={{ name: '', label: '' }}
                      />
                    ) : (
                      <MapValueWidget
                        valueClass={valueClass}
                        value={val}
                        onChange={(v) => updateValue(key, v)}
                        readOnly={readOnly}
                        schema={schema}
                      />
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      )}
      {!readOnly && (maxItems == null || entries.length < maxItems) && (
        <div className="flex items-center gap-2">
          <MapKeyInput
            keyClass={keyClass}
            value={newKey}
            onChange={setNewKey}
            onKeyDown={handleKeyDown}
            schema={schema}
            existingKeys={existingKeys}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addEntry}
            disabled={!newKey.trim() || newKey.trim() in mapValue}
            className="gap-1 shrink-0"
          >
            <Plus className="h-4 w-4" />
            {t('field.add', 'Add')}
          </Button>
        </div>
      )}
    </div>
  );
}

function MapKeyObjectIdInput({
  objectName,
  value,
  onChange,
  schema,
  existingKeys,
}: {
  objectName: string;
  value: string;
  onChange: (v: string) => void;
  schema: Schema;
  existingKeys?: Set<string>;
}) {
  const list = useObjectList(objectName, schema);
  const noPermissionMessage = useNoPermissionMessage(schema, objectName);
  const filteredOptions = existingKeys ? list.options.filter((o) => !existingKeys.has(o.id)) : list.options;
  const fromList = list.options.find((o) => o.id === value)?.label;
  const { label: cheapLabel, loading: labelLoading } = useObjectLabel(
    objectName,
    fromList ? null : value || null,
    schema,
  );
  const display = fromList ?? cheapLabel;

  return (
    <div className="flex items-center gap-2 flex-1">
      {value &&
        (labelLoading ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : (
          <span className="text-sm">{display ?? value}</span>
        ))}
      <ObjectIdSearchPopover
        options={filteredOptions}
        loading={list.loading}
        ensureLoaded={list.ensureLoaded}
        onSelect={onChange}
        disabledMessage={noPermissionMessage}
      />
    </div>
  );
}

interface MapKeyInputProps {
  keyClass: ScalarType;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  schema: Schema;
  existingKeys: Set<string>;
}

function MapKeyInput({ keyClass, value, onChange, onKeyDown, schema, existingKeys }: MapKeyInputProps) {
  const { t } = useTranslation();
  switch (keyClass.type) {
    case 'string':
      return (
        <BufferedInput
          value={value}
          onCommit={onChange}
          onKeyDown={onKeyDown}
          placeholder={formatPlaceholder(keyClass.format) ?? t('field.key', 'Key...')}
          className="flex-1"
        />
      );
    case 'enum': {
      const variants = (schema.enums[keyClass.enumName] ?? []).filter((v) => !existingKeys.has(v.name));
      return (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={t('field.selectKey', 'Select key...')} />
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
    case 'objectId':
      return (
        <MapKeyObjectIdInput
          objectName={keyClass.objectName}
          value={value}
          onChange={onChange}
          schema={schema}
          existingKeys={existingKeys}
        />
      );
    default: {
      const _: never = keyClass;
      void _;
      return (
        <BufferedInput
          value={value}
          onCommit={onChange}
          onKeyDown={onKeyDown}
          placeholder={t('field.key', 'Key...')}
          className="flex-1"
        />
      );
    }
  }
}

interface MapValueWidgetProps {
  valueClass: MapValueType;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
  schema: Schema;
}

function MapValueWidget({ valueClass, value, onChange, readOnly, schema }: MapValueWidgetProps) {
  const { t } = useTranslation();
  switch (valueClass.type) {
    case 'string': {
      const strVal = (value as string) ?? '';
      if (valueClass.format === 'text' || valueClass.format === 'html') {
        return (
          <BufferedTextarea
            value={strVal}
            onCommit={(v) => onChange(v)}
            disabled={readOnly}
            rows={2}
            className={valueClass.format === 'html' ? 'font-mono text-xs' : ''}
          />
        );
      }
      return (
        <BufferedInput
          type="text"
          value={strVal}
          onCommit={(v) => onChange(v)}
          disabled={readOnly}
          placeholder={formatPlaceholder(valueClass.format)}
        />
      );
    }
    case 'number': {
      const numVal = value as number | null | undefined;
      return (
        <BufferedNumberInput
          value={numVal ?? null}
          format={valueClass.format}
          step={valueClass.format === 'float' ? 0.01 : 1}
          min={valueClass.min}
          max={valueClass.max}
          nullable={true}
          disabled={readOnly}
          onCommit={(v) => onChange(v)}
        />
      );
    }
    case 'enum': {
      const variants = schema.enums[valueClass.enumName] ?? [];
      const strVal = (value as string) ?? '';
      return (
        <Select value={strVal} onValueChange={onChange} disabled={readOnly}>
          <SelectTrigger>
            <SelectValue placeholder={t('field.selectEllipsis', 'Select...')} />
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
    case 'object': {
      return (
        <EmbeddedObjectField
          objectName={valueClass.objectName}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          schema={schema}
          formField={{ name: '', label: '' }}
        />
      );
    }
    default: {
      const _: never = valueClass;
      void _;
      return null;
    }
  }
}

export default FieldWidget;
