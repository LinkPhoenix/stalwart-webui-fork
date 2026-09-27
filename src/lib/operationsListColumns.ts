/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { Schema } from '@/types/schema';

function hasSchemaProperty(schema: Schema, objectName: string, propertyName: string): boolean {
  const objectSchema = schema.schemas[objectName];
  if (!objectSchema) return false;

  if (objectSchema.type === 'single') {
    return propertyName in (schema.fields[objectSchema.schemaName]?.properties ?? {});
  }

  return objectSchema.variants.some(
    (variant) => variant.schemaName && propertyName in (schema.fields[variant.schemaName]?.properties ?? {}),
  );
}

function addRealPropertyColumn(
  schema: Schema,
  listName: string,
  propertyName: string,
  label: string,
  afterColumn: string,
): Schema {
  const list = schema.lists[listName];
  if (!list || !hasSchemaProperty(schema, listName, propertyName)) return schema;
  if (list.columns.some((column) => column.name === propertyName)) return schema;

  const columns = [...list.columns];
  const afterIndex = columns.findIndex((column) => column.name === afterColumn);
  columns.splice(afterIndex + 1, 0, { name: propertyName, label });

  return { ...schema, lists: { ...schema.lists, [listName]: { ...list, columns } } };
}

// SCHEMA-DEVIATION: listener-tls-enabled-column (see SCHEMA_DEVIATIONS.md)
export function withNetworkListenerColumns(schema: Schema): Schema {
  return addRealPropertyColumn(schema, 'x:NetworkListener', 'useTls', 'TLS Enabled', 'protocol');
}

// SCHEMA-DEVIATION: dns-provider-description-column (see SCHEMA_DEVIATIONS.md)
export function withDnsServerColumns(schema: Schema): Schema {
  return addRealPropertyColumn(schema, 'x:DnsServer', 'description', 'Description', '@type');
}

// SCHEMA-DEVIATION: directory-description-column (see SCHEMA_DEVIATIONS.md)
export function withDirectoryColumns(schema: Schema): Schema {
  return addRealPropertyColumn(schema, 'x:Directory', 'description', 'Description', '@type');
}

// SCHEMA-DEVIATION: webhook-configuration-columns (see SCHEMA_DEVIATIONS.md)
export function withWebhookColumns(schema: Schema): Schema {
  const withEnabled = addRealPropertyColumn(schema, 'x:WebHook', 'enable', 'Enabled', 'url');
  const withPolicy = addRealPropertyColumn(withEnabled, 'x:WebHook', 'eventsPolicy', 'Event Policy', 'enable');
  return addRealPropertyColumn(withPolicy, 'x:WebHook', 'events', 'Events', 'eventsPolicy');
}
