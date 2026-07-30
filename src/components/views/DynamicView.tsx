/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Check, X, HelpCircle, ChevronRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { jmapMapToArray, SECRET_MASK } from '@/lib/jmapUtils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { resolveSchema, resolveVariantForm, resolveForm } from '@/lib/schemaResolver';
import { useObjectList, useObjectLabel } from '@/lib/objectOptions';
import { formatSize, formatDuration } from '@/lib/durationFormat';
import type { Schema, Field, FieldType, FormField, Form, Fields, EnumVariant, ScalarType } from '@/types/schema';

export interface DynamicViewProps {
  schema: Schema;
  objectName: string;
  viewName: string;
  data: Record<string, unknown>;
  visibleFields?: Set<string>;
}

export function DynamicView({ schema, objectName, viewName, data, visibleFields }: DynamicViewProps) {
  const resolved = useMemo(() => {
    const sch = resolveSchema(schema, objectName);
    if (!sch) return null;

    let fields: Fields | null = null;
    let form: Form | null = null;
    let variantSchemaName: string | undefined;

    if (sch.type === 'single') {
      fields = sch.fields;
      form = resolveForm(schema, viewName, objectName, sch.schemaName);
    } else {
      const variantName = typeof data['@type'] === 'string' ? data['@type'] : undefined;
      if (variantName) {
        const variant = sch.variants.find((v) => v.name === variantName);
        if (variant?.schemaName) {
          variantSchemaName = variant.schemaName;
          fields = schema.fields[variant.schemaName] ?? null;
          form = resolveVariantForm(schema, viewName, objectName, variant.schemaName);
        }
      }
      const parentForm = resolveForm(schema, viewName, objectName, objectName);
      if (parentForm && form) {
        form = { ...form, sections: [...parentForm.sections, ...form.sections] };
      } else if (parentForm) {
        form = parentForm;
      }
    }

    return { sch, fields, form, variantSchemaName };
  }, [schema, objectName, viewName, data]);

  if (!resolved) return null;
  const { fields, form, sch } = resolved;

  const sections: { title?: string; items: { ff: FormField; field: Field }[] }[] = [];

  if (form) {
    for (const section of form.sections) {
      const items: { ff: FormField; field: Field }[] = [];
      for (const ff of section.fields) {
        if (ff.name === '@type') continue;
        if (visibleFields && !visibleFields.has(ff.name)) continue;
        const field = fields?.properties[ff.name];
        if (!field) continue;
        if (isEmptyValue(data[ff.name])) continue;
        items.push({ ff, field });
      }
      if (items.length > 0) {
        sections.push({ title: section.title, items });
      }
    }
  } else if (fields) {
    const items: { ff: FormField; field: Field }[] = [];
    for (const [name, field] of Object.entries(fields.properties)) {
      if (visibleFields && !visibleFields.has(name)) continue;
      if (isEmptyValue(data[name])) continue;
      items.push({ ff: { name, label: name }, field });
    }
    if (items.length > 0) {
      sections.push({ items });
    }
  }

  const variantLabel =
    sch.type === 'multiple' && typeof data['@type'] === 'string'
      ? sch.variants.find((v) => v.name === data['@type'])?.label
      : undefined;

  return (
    <div className="space-y-4">
      {variantLabel && (
        <Badge variant="secondary" className="text-xs">
          {variantLabel}
        </Badge>
      )}
      {sections.map((section, si) => (
        <Card key={si}>
          {section.title && (
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{section.title}</CardTitle>
            </CardHeader>
          )}
          <CardContent className={section.title ? 'pt-0' : ''}>
            <dl className="space-y-2">
              {section.items.map(({ ff, field }) => (
                <ViewField key={ff.name} label={ff.label} field={field} value={data[ff.name]} schema={schema} />
              ))}
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ViewField({ label, field, value, schema }: { label: string; field: Field; value: unknown; schema: Schema }) {
  const isBlock = isBlockType(field.type, value);

  return (
    <div className={isBlock ? 'space-y-1' : 'flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2'}>
      <dt className="flex items-center gap-1 text-sm text-muted-foreground shrink-0 sm:min-w-[140px]">
        {label}
        {field.description && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="text-xs prose prose-sm dark:prose-invert">
                  <ReactMarkdown>{field.description.replace(/\\n/g, '\n')}</ReactMarkdown>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </dt>
      <dd className="text-sm min-w-0 break-words">
        <ViewValue type={field.type} value={value} schema={schema} />
      </dd>
    </div>
  );
}

function isBlockType(type: FieldType, value: unknown): boolean {
  if (type.type === 'object' || type.type === 'objectList') return true;
  if (type.type === 'map') return true;
  if (type.type === 'string' && (type.format === 'text' || type.format === 'html')) return true;
  if (type.type === 'set' && value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 5;
  }
  return false;
}

function ViewValue({ type, value, schema }: { type: FieldType; value: unknown; schema: Schema }) {
  if (value === null || value === undefined) {
    return <span className="italic text-muted-foreground">-</span>;
  }

  switch (type.type) {
    case 'string':
      return <StringValue value={value} format={type.format} />;

    case 'number':
      return <NumberValue value={value} format={type.format} />;

    case 'utcDateTime':
      return <DateTimeValue value={value} />;

    case 'boolean':
      return value === true ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-red-500" />;

    case 'enum':
      return <EnumValue value={value} enumName={type.enumName} schema={schema} />;

    case 'blobId':
      return <span className="font-mono text-xs">{String(value)}</span>;

    case 'objectId':
      return <span>{String(value)}</span>;

    case 'object':
      return <ObjectValue value={value} objectName={type.objectName} schema={schema} />;

    case 'objectList':
      return <ObjectListValue value={value} objectName={type.objectName} schema={schema} />;

    case 'set':
      return <SetValue value={value} classType={type.class} schema={schema} />;

    case 'map':
      return <MapValue value={value} keyClass={type.keyClass} valueClass={type.valueClass} schema={schema} />;

    default:
      return <span>{JSON.stringify(value)}</span>;
  }
}

function StringValue({ value, format }: { value: unknown; format: string }) {
  const str = String(value);
  if (!str) return <span className="italic text-muted-foreground">-</span>;

  if (format === 'text' || format === 'html' || str.includes('\n')) {
    return <pre className="whitespace-pre-wrap break-all rounded bg-muted/50 p-2 text-xs font-mono">{str}</pre>;
  }
  if (format === 'secret' || format === 'secretText') {
    return <span className="text-muted-foreground">{SECRET_MASK}</span>;
  }
  return <span className="break-all">{str}</span>;
}

function NumberValue({ value, format }: { value: unknown; format: string }) {
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) return <span>{String(value)}</span>;

  switch (format) {
    case 'size':
      return <span>{formatSize(num)}</span>;
    case 'duration':
      return <span>{formatDuration(num)}</span>;
    default:
      return <span>{num.toLocaleString()}</span>;
  }
}

function DateTimeValue({ value }: { value: unknown }) {
  if (!value) return <span className="italic text-muted-foreground">-</span>;
  const str = String(value);
  const d = new Date(str);
  const formatted = !isNaN(d.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
    : str;
  return <span>{formatted}</span>;
}

function EnumValue({ value, enumName, schema }: { value: unknown; enumName: string; schema: Schema }) {
  const str = String(value);
  const variants = schema.enums[enumName] ?? [];
  const variant = variants.find((v: EnumVariant) => v.name === str);
  if (variant) {
    return (
      <Badge variant="secondary" style={variant.color ? { backgroundColor: variant.color, color: '#fff' } : undefined}>
        {variant.label}
      </Badge>
    );
  }
  return <span>{str}</span>;
}

function ObjectValue({
  value,
  objectName,
  schema,
  defaultOpen = false,
}: {
  value: unknown;
  objectName: string;
  schema: Schema;
  defaultOpen?: boolean;
}) {
  if (!value || typeof value !== 'object') {
    return <span className="italic text-muted-foreground">-</span>;
  }

  const data = value as Record<string, unknown>;

  const sch = resolveSchema(schema, objectName);
  let fields: Record<string, Field> | undefined;
  let form: Form | null = null;
  let variantLabel: string | undefined;

  if (sch?.type === 'multiple') {
    const variantName = typeof data['@type'] === 'string' ? data['@type'] : undefined;
    if (variantName) {
      const variant = sch.variants.find((v) => v.name === variantName);
      variantLabel = variant?.label;
      if (variant?.schemaName) {
        fields = schema.fields[variant.schemaName]?.properties;
        form = schema.forms[variant.schemaName] ?? null;
      }
    }
  } else if (sch?.type === 'single') {
    fields = schema.fields[sch.schemaName]?.properties;
    form = schema.forms[sch.schemaName] ?? schema.forms[objectName] ?? null;
  }

  const entries = buildViewEntries(data, fields, form);

  if (entries.length === 0 && !variantLabel) {
    return null;
  }

  const triggerLabel = variantLabel ?? findDisplayValue(data) ?? objectName.replace(/^x:/, '');

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm hover:text-foreground text-muted-foreground transition-colors [&[data-state=open]>svg]:rotate-90"
        >
          <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200" />
          <span>{triggerLabel}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-5 mt-2 border-l-2 border-muted/40 pl-4 space-y-2">
          {entries.map(({ key, label, field, value: val }) => {
            if (!field) {
              return (
                <div key={key} className="flex items-baseline gap-2">
                  <span className="text-sm text-muted-foreground shrink-0 min-w-[120px]">{label}</span>
                  <span className="text-sm">{typeof val === 'object' ? JSON.stringify(val) : String(val ?? '-')}</span>
                </div>
              );
            }
            const block = isBlockType(field.type, val);
            return (
              <div key={key} className={block ? 'space-y-1' : 'flex items-baseline gap-2'}>
                <span className="flex items-center gap-1 text-sm text-muted-foreground shrink-0 min-w-[120px]">
                  {label}
                  {field.description && <FieldTooltip description={field.description} />}
                </span>
                <span className="text-sm min-w-0">
                  <ViewValue type={field.type} value={val} schema={schema} />
                </span>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ObjectListValue({ value, objectName, schema }: { value: unknown; objectName: string; schema: Schema }) {
  const items = jmapMapToArray<Record<string, unknown>>(value);
  if (items.length === 0) {
    return <span className="italic text-muted-foreground">-</span>;
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <ObjectValue key={i} value={item} objectName={objectName} schema={schema} />
      ))}
    </div>
  );
}

function SetValue({
  value,
  classType,
  schema,
}: {
  value: unknown;
  classType: { type: string; enumName?: string };
  schema: Schema;
}) {
  if (!value || typeof value !== 'object') {
    return <span className="italic text-muted-foreground">-</span>;
  }

  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length === 0) {
    return <span className="italic text-muted-foreground">-</span>;
  }

  const labels = keys.map((k) => {
    if (classType.type === 'enum' && classType.enumName) {
      const variants = schema.enums[classType.enumName] ?? [];
      const v = variants.find((e: EnumVariant) => e.name === k);
      return v?.label ?? k;
    }
    return k;
  });

  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((label, i) => (
        <Badge key={i} variant="secondary" className="text-xs">
          {label}
        </Badge>
      ))}
    </div>
  );
}

function MapValue({
  value,
  keyClass,
  valueClass,
  schema,
}: {
  value: unknown;
  keyClass: ScalarType;
  valueClass: { type: string; objectName?: string };
  schema: Schema;
}) {
  if (!value || typeof value !== 'object') {
    return <span className="italic text-muted-foreground">-</span>;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return <span className="italic text-muted-foreground">-</span>;
  }

  return (
    <div className="space-y-2">
      {entries.map(([k, v]) => {
        const keyLabel = <MapKeyLabel keyClass={keyClass} keyValue={k} schema={schema} />;

        if (valueClass.type === 'object' && valueClass.objectName) {
          return (
            <div key={k}>
              <span className="text-sm font-medium">{keyLabel}</span>
              <div className="ml-2">
                <ObjectValue value={v} objectName={valueClass.objectName} schema={schema} />
              </div>
            </div>
          );
        }

        return (
          <div key={k} className="flex items-baseline gap-2">
            <span className="text-sm text-muted-foreground shrink-0 min-w-[120px]">{keyLabel}</span>
            <span className="text-sm">{typeof v === 'object' ? JSON.stringify(v) : String(v ?? '-')}</span>
          </div>
        );
      })}
    </div>
  );
}

function MapKeyLabel({ keyClass, keyValue, schema }: { keyClass: ScalarType; keyValue: string; schema: Schema }) {
  if (keyClass.type === 'enum') {
    const variants = schema.enums[keyClass.enumName] ?? [];
    const variant = variants.find((e: EnumVariant) => e.name === keyValue);
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

function FieldTooltip({ description }: { description: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-xs prose prose-sm dark:prose-invert">
            <ReactMarkdown>{description.replace(/\\n/g, '\n')}</ReactMarkdown>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface ViewEntry {
  key: string;
  label: string;
  field: Field | undefined;
  value: unknown;
}

function buildViewEntries(
  data: Record<string, unknown>,
  fields?: Record<string, Field>,
  form?: Form | null,
): ViewEntry[] {
  const entries: ViewEntry[] = [];
  const seen = new Set<string>();

  if (form) {
    for (const section of form.sections) {
      for (const ff of section.fields) {
        if (ff.name === '@type') continue;
        if (isEmptyValue(data[ff.name])) continue;
        seen.add(ff.name);
        entries.push({
          key: ff.name,
          label: ff.label,
          field: fields?.[ff.name],
          value: data[ff.name],
        });
      }
    }
  }

  for (const [key, val] of Object.entries(data)) {
    if (key === '@type' || key === 'id' || seen.has(key)) continue;
    if (isEmptyValue(val)) continue;
    entries.push({
      key,
      label: key,
      field: fields?.[key],
      value: val,
    });
  }

  return entries;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value as Record<string, unknown>).length === 0;
  }
  return false;
}

function findDisplayValue(data: Record<string, unknown>): string | null {
  for (const key of [
    'name',
    'domain',
    'headerFrom',
    'envelopeFrom',
    'sourceIp',
    'orgName',
    'organizationName',
    'email',
    'from',
    'to',
    'subject',
    'policyDomain',
  ]) {
    const val = data[key];
    if (typeof val === 'string' && val.length > 0) return val;
  }
  for (const val of Object.values(data)) {
    if (typeof val === 'string' && val.length > 0 && val.length <= 80) return val;
  }
  return null;
}
